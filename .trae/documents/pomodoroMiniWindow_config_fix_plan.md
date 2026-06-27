# 番茄钟小窗口配置修复与组件化改造计划

## 一、问题分析

### 1.1 配置不同步问题
当前存在两套独立的配置存储，导致小窗口读取不到 windowmode 页面的设置：

- **windowmode 页面**：皮肤/排版配置存储在 `window-mode:pomodoro` 中（通过 `setStore`）
- **小窗口**：皮肤/排版配置存储在 `pomodoro_mini_config` SQL 表中
- 两者没有同步机制，小窗口启动时读取不到 windowmode 的配置

### 1.2 数据同步机制
现有同步流程：
1. 主窗口通过 `send('sync-data-to-other-window', ...)` 发送数据
2. 主进程广播到所有子窗口
3. 子窗口通过 `sync-data-to-other-window` 事件接收

但当前同步的数据不包含 `pomodoroMiniWindowConfig`（皮肤和排版配置）。

### 1.3 排版样式耦合
当前5种排版样式（default、simple、circle、compact、classic）全部写在一个文件的 scoped style 中，通过 CSS 类切换，代码臃肿且难以维护。

---

## 二、修改方案

### 2.1 统一配置存储

**目标**：小窗口的皮肤和排版配置统一从 `window-mode:pomodoro` 读取，与 windowmode 页面保持一致。

**修改点**：
1. 小窗口启动时通过 `getStore('window-mode:pomodoro')` 读取配置
2. 移除 `pomodoro_mini_config` 表的读写逻辑
3. 小窗口内切换皮肤/排版时，也通过 `setStore('window-mode:pomodoro')` 保存

### 2.2 实时配置同步

**目标**：windowmode 页面修改配置后，已打开的小窗口实时更新。

**修改点**：
1. 在 `useWindowMode.ts` 中监听 `pomodoroMiniWindowConfig` 变化
2. 变化时通过 `send('sync-data-to-other-window', ...)` 发送到子窗口
3. 小窗口监听同步事件，更新皮肤和排版

### 2.3 排版组件化

**目标**：将5种排版封装为独立组件，通过动态组件切换。

**新增组件**（位于 `src/views/pomodoroMiniWindow/layouts/`）：
- `LayoutDefault.vue` - 默认布局（状态+倒计时+进度条）
- `LayoutSimple.vue` - 简约布局（大倒计时，隐藏进度条）
- `LayoutCircle.vue` - 圆形布局（环形进度条+倒计时）
- `LayoutCompact.vue` - 紧凑布局（横向排列）
- `LayoutClassic.vue` - 经典布局（标题+倒计时+进度百分比）

**组件设计**：
- 每个组件接收相同的 props：`status`、`countdown`、`progress`、`statusLabel`、`statusSubtitle`
- 每个组件 emit 相同的事件：`cycle-theme`（点击切换皮肤）
- 父组件通过 `<component :is="currentLayoutComponent" />` 动态切换

---

## 三、文件修改清单

### 3.1 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/views/pomodoroMiniWindow/index.vue` | 重构主组件，移除内联排版样式，使用动态组件，修复配置读取逻辑 |
| `src/store/useWindowMode.ts` | 添加配置变化监听，实时同步到子窗口 |

### 3.2 新增文件

| 文件 | 说明 |
|------|------|
| `src/views/pomodoroMiniWindow/layouts/LayoutDefault.vue` | 默认布局组件 |
| `src/views/pomodoroMiniWindow/layouts/LayoutSimple.vue` | 简约布局组件 |
| `src/views/pomodoroMiniWindow/layouts/LayoutCircle.vue` | 圆形布局组件 |
| `src/views/pomodoroMiniWindow/layouts/LayoutCompact.vue` | 紧凑布局组件 |
| `src/views/pomodoroMiniWindow/layouts/LayoutClassic.vue` | 经典布局组件 |

---

## 四、详细修改步骤

### 步骤1：创建排版组件目录和基础组件
- 创建 `src/views/pomodoroMiniWindow/layouts/` 目录
- 将现有排版的模板和样式拆分到5个独立组件中
- 统一 props 接口：`status`, `countdown`, `progress`, `statusLabel`, `statusSubtitle`
- 统一事件：`@cycle-theme`

### 步骤2：重构 pomodoroMiniWindow/index.vue
- 移除内联的5种排版样式
- 引入5个布局组件，使用动态组件 `<component :is="..." />`
- 修复配置读取：从 `window-mode:pomodoro` 读取 skin 和 layout
- 修复配置保存：切换皮肤/排版时写入 `window-mode:pomodoro`
- 监听 `sync-data-to-other-window` 事件中的配置更新

### 步骤3：修改 useWindowMode.ts
- 添加 `pomodoroMiniWindowConfig` 的 watch 监听
- 配置变化时通过 `send('sync-data-to-other-window', { pomodoroMiniWindowConfig: ... })` 同步
- 确保小窗口能实时收到配置更新

### 步骤4：验证与测试
- 运行 TypeScript 类型检查
- 验证小窗口启动时正确读取配置
- 验证 windowmode 页面修改后小窗口实时更新
- 验证小窗口内切换皮肤/排版后 windowmode 页面同步更新

---

## 五、风险与注意事项

### 5.1 配置兼容性
- 旧用户可能已有 `pomodoro_mini_config` 表中的配置
- 处理方式：启动时如果 `window-mode:pomodoro` 中没有 skin/layout，且 `pomodoro_mini_config` 中有，则迁移过去（可选）
- 简化处理：直接使用 `window-mode:pomodoro` 的默认值，用户重新设置即可

### 5.2 组件通信
- 动态组件切换时需要确保所有功能正常（状态指示、倒计时、进度条、皮肤切换按钮）
- 皮肤切换按钮在不同布局中的位置可能不同，需在每个布局组件中正确放置

### 5.3 响应式适配
- 所有布局组件必须保持响应式设计，使用 `clamp()`、`vmin`、`em` 等单位
- 确保在 108x81 到 300x150 等不同尺寸下都能正常显示

---

## 六、成功标准

1. ✅ 小窗口启动时正确读取 windowmode 页面设置的皮肤和排版
2. ✅ windowmode 页面修改皮肤/排版后，已打开的小窗口实时更新
3. ✅ 小窗口内切换皮肤/排版后，windowmode 页面同步更新
4. ✅ 5种排版样式功能完整，与改造前一致
5. ✅ TypeScript 类型检查通过
6. ✅ 所有布局在不同窗口尺寸下正常显示，无溢出
