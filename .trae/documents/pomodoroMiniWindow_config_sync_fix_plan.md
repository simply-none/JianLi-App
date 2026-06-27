# 番茄钟小窗口配置同步问题修复计划

## 问题清单

### 问题1：设置页面改皮肤后，小窗口时间变成 NaN:NaN:NaN

**现象**：在设置页面（windowMode）点击皮肤按钮切换皮肤后，小窗口皮肤变了，但倒计时显示 `NaN:NaN:NaN`。

**根因**：设置页面修改皮肤时，`pomodoroMiniWindowConfig` 变化触发 watch，通过 `sync-data-to-other-window` 只发送了 `{ pomodoroMiniWindowConfig }`，没有 `curStatus`、`startWorkTime`、`workTimeGap` 等时间相关数据。

小窗口收到数据后执行：
```typescript
// 没有 curStatus，走 else 分支
nextTime.value = moment(arg.closeWorkTime + arg.restTimeGapUnit * arg.restTimeGap).format(...)
// arg.closeWorkTime = undefined, undefined * undefined = NaN
// moment(NaN) → invalid date → 显示 NaN:NaN:NaN
```

同时 `sysData.value = arg || {}` 把 sysData 覆盖成只有 `pomodoroMiniWindowConfig` 的对象，导致后续 `countDown()` 里读取 `data.startWorkTime` 也是 undefined。

### 问题2：小窗口切换皮肤后，下次打开位置等参数恢复默认

**现象**：在小窗口内点击皮肤切换按钮换了皮肤，关闭后重新打开，窗口位置回到右下角（默认值），其他配置也恢复默认。

**根因**：小窗口的 `saveConfig` 直接通过 `sendSync('set-store', ...)` 写入 electron-store，但**没有通知主窗口的 Pinia store 更新**。

主窗口的 `pomodoroMiniWindowConfig` 是 Pinia 管理的，`initPiniaStatus` 只在初始化时从 store 读一次。之后小窗口修改了 store 的值，但主窗口的 Pinia 状态不知道。

下次打开小窗口时：
```typescript
send("open-new-window", "pomodoro", getWindowConfig("pomodoro"))
```
`getWindowConfig` 从 electron-store 读取，应该是对的。但窗口创建后，主窗口的 `sync-data-to-other-window` 会把主窗口 Pinia 里的旧配置发过去，覆盖掉正确的。

更关键的是：小窗口切换皮肤/布局时，只保存了单个字段，没有把完整配置同步回主窗口，导致主窗口 Pinia 状态和 electron-store 不一致。

---

## 修复方案

### 修复问题1：NaN:NaN:NaN

**文件**：`src/views/pomodoroMiniWindow/index.vue`

**修改**：在 `sync-data-to-other-window` 事件处理中，只有当收到的数据包含 `curStatus` 时才更新时间相关逻辑（nextTime、进度等）。如果只是配置变更（只有 pomodoroMiniWindowConfig），不触碰时间状态。

同时，`sysData` 的赋值应该是**合并**而不是**替换**，避免已有数据被清空。

### 修复问题2：配置不同步

**文件**：`src/views/pomodoroMiniWindow/index.vue`

**修改**：
1. `saveConfig` 保存后，通过 `sync-data-to-other-window` 将完整配置发送给主窗口
2. 或者更简单：小窗口不直接操作 store，而是发事件通知主窗口来更新配置

考虑到现有架构（主窗口通过 watch pomodoroMiniWindowConfig 自动同步），更稳妥的方式是：
- 小窗口保存配置到 electron-store 后，发送一个自定义事件通知主窗口重新读取配置
- 或者小窗口直接通过 `sync-data-to-other-window` 把完整的 pomodoroMiniWindowConfig 发回去，让主窗口的 watch 自动处理

但主窗口的 `sync-data-to-other-window` 监听收到后如何更新 Pinia？让我看看... 目前主窗口似乎没有监听这个事件来更新自己的配置，只是发送。

实际上更简单的方案是：
- 小窗口 `saveConfig` 时，先读取完整配置，修改后保存到 store
- 然后通过 `sendSync` 或新的 ipc 事件，让主窗口重新从 store 加载配置

或者，最直接的方案：
- 小窗口切换皮肤/布局时，通过 `sync-data-to-other-window` 把完整的 `pomodoroMiniWindowConfig` 对象发给主窗口
- 主窗口需要在收到这个事件时，更新自己的 `pomodoroMiniWindowConfig`

但主窗口目前没有监听 `sync-data-to-other-window` 来更新配置。需要在 useWindowMode 中添加监听。

**更简洁的方案**：
- 小窗口保存配置到 store 后，发送一个自定义事件（如 `pomodoro-config-updated`）
- 主进程收到后，通知主窗口重新加载配置
- 或者，直接让小窗口用 `sendSync` 调用主窗口的更新逻辑

**最终选择**：在 `useWindowMode.ts` 中添加对 `sync-data-to-other-window` 的监听，当收到 `pomodoroMiniWindowConfig` 时，更新自身的 Pinia 状态。这样小窗口只需要发 `sync-data-to-other-window`，主窗口会自动同步，保持现有架构一致。

---

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/views/pomodoroMiniWindow/index.vue` | 1. sync-data 处理中分离配置更新和时间更新，没有 curStatus 时不更新时间；2. sysData 合并而非替换；3. 切换皮肤/布局后，发送完整配置同步到主窗口 |
| `src/store/useWindowMode.ts` | 添加对 sync-data-to-other-window 的监听，收到 pomodoroMiniWindowConfig 时更新自身状态 |

---

## 修改步骤

### 步骤1：修复小窗口 NaN 问题（index.vue）

在 `sync-data-to-other-window` 回调中：
- 把 `sysData.value = arg || {}` 改为 `Object.assign(sysData.value, arg)`（合并，不覆盖已有字段）
- 把 `curStatusC.value = arg.curStatus` 改为 `if (arg.curStatus) curStatusC.value = arg.curStatus`
- 把时间计算和 `countDown()` 调用包裹在 `if (arg.curStatus)` 条件内

### 步骤2：修复配置同步（index.vue）

修改 `saveConfig` 函数：
- 保存后，读取完整配置对象
- 通过 `window.ipcRenderer.send('sync-data-to-other-window', { pomodoroMiniWindowConfig: 完整配置对象 })` 发送给主窗口

### 步骤3：主窗口接收配置更新（useWindowMode.ts）

在 `init()` 中添加监听：
- 监听 `sync-data-to-other-window` 事件
- 如果收到 `pomodoroMiniWindowConfig`，则更新 `pomodoroMiniWindowConfig.value`
- 注意：要避免循环触发（自己发的又被自己收到）

### 步骤4：运行 TypeScript 类型检查

---

## 风险评估

- **风险低**：修改范围小，都是在现有数据流上做增强
- **循环同步风险**：需要注意主窗口和小窗口互相发 sync-data 可能导致循环。主窗口的 watch 触发 send 时，如果数据没变就不会触发（其实 watch deep 会触发，但值一样的话...）。需要加个判断：如果收到的配置和当前值相同，就不更新。
- **回归点**：确保设置页面改配置、小窗口改配置、重新打开小窗口这三条路径都正常

---

## 验证方法

1. **验证问题1**：
   - 打开番茄钟小窗口，确认时间正常显示
   - 在设置页面切换皮肤，观察小窗口皮肤变化，时间是否保持正常（不变为 NaN）

2. **验证问题2**：
   - 在设置页面将位置改为左上角
   - 打开小窗口，确认在左上角
   - 在小窗口内切换皮肤
   - 关闭小窗口，重新打开
   - 确认位置仍然是左上角，没有回到右下角
