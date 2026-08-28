# 通用习惯打卡 · 技术方案

> 定位：不是又一个孤立页面，而是「建在已 id 泛化的 stateful 提醒引擎之上的 **复合提醒 + 记录 + 链式动作**」系统。
> 真正的能力来自与现有模块（待办 / 笔记 / 番茄钟 / 记账）串接，习惯核心保持很薄、可扩展。

---

## 0. 目标与范围

- **通用**：习惯定义、频率、提醒复用现有提醒引擎，与番茄钟共用一套调度 / 免打扰 / 空闲挂起 / realign 能力。
- **可串接**：一次「打卡」可派发到多个目标模块（完成待办、写笔记日志、联动番茄钟、回写记账），通过「链式动作注册表」解耦。
- **不污染现有红线**：延续既有约束——**除番茄钟（多状态提醒）外，其他提醒均不隐式写库**。习惯记录必须走自己的表、显式 `new-sql:execute`。

---

## 1. 总体架构（四层）

| 层 | 职责 | 复用 / 新建 |
|----|------|------------|
| 触达面 | 用户入口：命令面板 `!`、打卡小窗、系统通知 | 复用命令面板注册表、小窗基础设施、提醒通知通道 |
| 习惯核心 | 定义 / 调度 / 打卡动作 / 连击统计 / 链式动作引擎 | 新建 `Habit Core`（薄层） |
| 复用基座 | stateful 引擎、数据层、小窗、面板注册表 | 全部复用既有能力 |
| 串接目标 | 待办 / 笔记 / 番茄钟 / 记账 / 统计 | 每个目标 = 一个可注册 `HabitChainAction` |

数据流：触达 → 核心（调度到点触发）→ 派发链式动作 → 串接目标；目标可回写状态（如完成待办更新习惯进度）形成闭环。

---

## 2. 数据模型

### 2.1 `habit_def`（习惯定义）

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | TEXT PK | 习惯唯一 id，建议 `habit:<name>` |
| `name` | TEXT | 显示名 |
| `freqType` | TEXT | `daily` / `weekly` / `custom` |
| `freqConfig` | TEXT(JSON) | 频率配置（如每周一三五、自定义 cron 表达式） |
| `reminderTime` | TEXT | 每日提醒时间，逗号分隔多个 |
| `linkedTargets` | TEXT(JSON) | 关联目标 id 列表（待办项 key、笔记分类等） |
| `chainActions` | TEXT(JSON) | 启用哪些链式动作及参数，如 `[{"type":"todo","onCheckIn":"complete"},{"type":"note","template":"今日打卡：{name}"}]` |
| `enabled` | INTEGER | 是否启用（1/0） |
| `createTime` | TEXT | |
| `updateTime` | TEXT | |

### 2.2 `habit_checkin`（打卡记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `habitKey` | TEXT | 关联 `habit_def.key` |
| `date` | TEXT | 打卡日期 `YYYY-MM-DD` |
| `time` | TEXT | 打卡时刻 |
| `value` | TEXT | 可选量化值（如时长/次数） |
| `note` | TEXT | 备注 |
| `source` | TEXT | 来源：`manual` / `miniWindow` / `palette` / `notification` |

唯一约束：`(habitKey, date)` 一天一条，重复打卡视为更新或累计。

### 2.3 持久化约束（红线）

- 习惯记录 **只** 通过 `new-sql:execute`（`{sql, params, primaryKey:'id'}`）显式写入自己的两张表。
- **绝不** 走番茄钟的 `tips-save` 隐式写库路径；`useTipsBridge` 的 `shouldPersist(arg)` 逻辑继续只对 `pomodoro` 生效，习惯不走那条分支。
- 复用现有 DB（路径：`C:\Users\风起\Downloads\测试\db.sqlite`），与 `note_book` / 待办等共用同一 sqlite。

---

## 3. 引擎复用（stateful 提醒引擎）

### 3.1 一个习惯 = 一个 stateful reminder

- 主进程 `electron/main/module/newReminder.ts` 已按 `id` 参数化（`statefulRT: Record<string, StatefulRT>`），习惯直接注册为新 id，如 `habit:read`。
- 类型标记 `kind: 'checkin'`，调度逻辑复用既有 `scheduleReminder` / `realign` / 免打扰 `idleTime` / 空闲挂起。
- 渲染端用已做的工厂 `useRuntime(id)`（`src/store/useTipsRuntime.ts`）按 `habit:<name>` 取状态，零改造接入。

### 3.2 通道

- `tips-state-change`（A：进入/到点，弹通知 + 写记录起点）
- `tips-state-sync`（B：同步/恢复/停止，仅刷 UI）
- 复用 `src/hooks/useTipsBridge.ts` 的 `setupTipsBridge`，但**仅 `pomodoro` 走 DB 记录分支**，习惯走独立的 `check-in` 流程。

### 3.3 提醒触发

- 到点 → 系统通知（复用提醒通知通道）+ 唤起打卡小窗（见 §6）。
- 复用 `useGlobalSetting.ts` 的 `isIdleNow`（已聚合所有 stateful 提醒的免打扰窗口），习惯自动纳入免打扰。

---

## 4. 打卡动作与统计

### 4.1 `check-in` IPC

- 渲染端调用 `habit:check-in` → 主进程写入 `habit_checkin`（显式 `new-sql:execute`）+ 计算连击。
- 连击 / 连续天数 / 完成率：纯计算函数，输入 `habit_checkin` 历史，输出统计，放 `habit` 模块内。

### 4.2 统计展示

- 独立「习惯」视图内嵌日历热力图 + 连击卡片，复用记账 / 电子书已有的图表组件（Chart / 自绘 SVG），不重复造轮子。

---

## 5. 链式动作引擎（核心可扩展性点）

仿照命令面板 `src/views/commandPalette/useCommandSources.ts` 的 `REGISTRY` 模式，做 `habitChainActions` 注册表。

```ts
// src/habit/chainActions/types.ts
export interface HabitChainAction {
  type: string;                       // 'todo' | 'note' | 'pomodoro' | 'account'
  onCheckIn(ctx: {
    habit: HabitDef;
    record: HabitCheckin;
    linkedTargets: any[];
  }): Promise<void> | void;
  onRollback?(ctx: { habit: HabitDef; record: HabitCheckin }): void; // 撤销打卡时回滚
}

// src/habit/chainActions/registry.ts
export const habitChainActions: Record<string, HabitChainAction> = {};
export function registerHabitChainAction(a: HabitChainAction) {
  habitChainActions[a.type] = a;
}
```

- 打卡后按顺序派发 `habit.chainActions` 列表里的动作；新增串接只注册一个新 action，**习惯核心零改动**。
- 这是「通用 + 串接」真正落地的枢纽。

---

## 6. 触达面（入口）

| 入口 | 实现 | 复用点 |
|------|------|--------|
| 命令面板 `!` | 新增作用域前缀 `!` 搜索/触发打卡 | 仿 `@`笔记 / `#`待办，在 `paletteConfig.ts` 的 SCOPE 增加 `!` → `habitSource` |
| 打卡小窗 | 到点弹出的 frameless 小窗，一键打卡 | `createOtherWindow` + `useWindowMode.ts` + `windowMode/index.vue`，参考 quickNote 纯 CSS 拖拽 |
| 系统通知 | 到点提醒 + 点通知直接打卡 | 复用提醒通知通道 |

---

## 7. 串接契约（最小可用 4 个）

| 目标 | 动作 | 实现要点 |
|------|------|----------|
| 待办 | 完成联动 | `onCheckIn` 调待办完成接口，勾掉 `linkedTargets` 中的待办项；`onRollback` 取消勾选 |
| 笔记 | 自动日志 | 调 `query-data` 写 `note_book`（字段：key / html / createTime / updateTime / tags / whereStr / content），追加带日期的打卡日志 |
| 番茄钟 | focus 习惯 | `kind:'checkin'` 且 `freqType` 为 focus 时，直接复用 pomodoro 状态机，不新建状态 |
| 记账 | 花费 / 省钱 | 调记账写接口，按 `chainActions` 参数回写一条账目（如「戒烟省下 ¥X」） |

> 笔记 / 待办 / 记账的查询与写入**全部复用既有 `query-data` / `new-sql:execute` 通道**，不自己拼 SQL（前次 `@`/`#` 搜索踩过 `extractColumnNames` 的坑）。

---

## 8. 配置化（数据驱动）

- 习惯的「频率 / 提醒 / 链式动作」做成清单式配置，仿 `src/views/windowMode/config/windowSections.ts`：新增习惯类型只加一条记录，不碰核心代码。
- 链式动作清单在 `habitChainActions` 注册；UI 在设置页以开关 + 参数表单呈现。

---

## 9. 接口 / IPC 清单

| 通道 | 方向 | 说明 |
|------|------|------|
| `query-data` | 渲染→主 | 读 `habit_def` / `habit_checkin` / 串接目标数据，复用既有表查询 |
| `new-sql:execute` | 渲染→主 | 写 `habit_def` / `habit_checkin`（显式、带 primaryKey） |
| `habit:check-in` | 渲染→主 | 执行一次打卡 + 派发链式动作 |
| `habit:undo` | 渲染→主 | 撤销打卡 + 回滚链式动作 |
| `tips-state-change` / `tips-state-sync` | 主→渲染 | 复用提醒状态下发（习惯仅用于「到点提醒」，不写库） |
| `createOtherWindow` | 主 | 打卡小窗 |

---

## 10. 回归点（上线前必须验证）

1. **与番茄钟共存**：习惯提醒与番茄钟周期互不影响，主窗口 + 小窗状态同步、不双写。
2. **写库红线**：抓包确认 `habit_checkin` 走 `new-sql:execute` 自有表，`tips-save` 路径仍只对 pomodoro 触发。
3. **免打扰**：习惯纳入 `isIdleNow`，空闲窗口内不弹、不记。
4. **链式动作闭环**：打卡→待办勾选 / 笔记追加 / 记账写账；撤销→对应回滚。
5. **命令面板 `!`**：搜索 / 触发打卡正常，仿 `@`/`#` 的关键词匹配可用。
6. **小窗**：拖拽（纯 CSS）、鼠标穿透切换、唤出即置底右、关闭用 `hide` 复用。
7. **重复打卡**：同日期重复打卡为更新 / 累计，不重复插行。
8. **重启恢复**：进程重启后习惯定义与未打卡状态正确恢复（realign）。

---

## 11. 落地阶段（最小闭环优先）

- **阶段 1**：数据模型（`habit_def` / `habit_checkin`）+ 引擎复用（§2、§3）——习惯能按时提醒。
- **阶段 2**：最小可用打卡小窗 + 系统通知（§6）——用户到点一键打卡。
- **阶段 3**：链式动作注册表 + 1~2 个串接（§5、§7）——先接「待办完成」与「笔记日志」。
- **阶段 4**：统计面板 / 日历热力（§4.2）。
- **阶段 5**：配置化 + 命令面板 `!`（§8、§6）。

---

## 12. 风险与注意

- **写库红线**：任何习惯相关写操作都不得误用番茄钟隐式写库通道。
- **SQL 拼接坑**：串接目标（笔记 / 待办 / 记账）的查询与写入一律走既有 `query-data` / `new-sql:execute`，避免 `extractColumnNames` 把函数当列处理。
- **类型安全**：`useRuntime(id)` 返回 `any` 以兼容任意 id 的 store 工厂；`useTipsRuntime()` 仍作为番茄钟规范入口，习惯用 `useRuntime('habit:xxx')`。
- **小窗生命周期**：关闭用 `hide-new-window` 复用，避免 `close` 销毁后重建；拖拽区 input/button 需显式 `no-drag`。
