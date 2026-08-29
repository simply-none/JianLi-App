# 提醒管理 (newTips)

## 职责
提醒的增删改查与触发配置页，底层完全复用主进程 `newReminder` 引擎（定点/周期/多状态三种模式 + 免打扰时段），本身不持久化，所有读写经 `useNewReminder` 走主进程。

## 关键文件
- 页面：`src/views/newTips/index.vue`（薄壳，组装 `ReminderList`/`ReminderDialog`）
- 表单组件：`src/views/newTips/components/`（`ReminderDialog.vue`、`TimeRuleForm.vue`、`IntervalForm.vue`、`StatefulForm.vue`、`IdleTimeForm.vue`、`StateRow.vue`）
- 引擎 store：`src/store/useNewReminder.ts`（`get-tips`/`tips-save`/`tips-delete`/`tips-force-state` 等封装）
- 类型：`src/views/newTips/types.ts`（`TipsReminder`、`TipsState`、`IdleTimeSlot`）
- 主进程引擎：`electron/main/module/newReminder.ts`（约 1250 行，所有提醒排程/触发逻辑都在这里）

## 路由
- `RouteNames.NEW_TIPS` → `/newTips`

## 用到的 IPC 通道
- `get-tips`（渲染→主，拉全部提醒；`useNewReminder.ts:13`）
- `tips-save`（渲染→主，增改；`:22`）
- `tips-delete`（渲染→主，删；`:46`）
- `tips-force-state` / `tips-inject-state` / `tips-end-injected-state` / `request-tips-state`（驱动/注入状态，由 `useTipsActions.ts:40-50` 封装）
- `tips-trigger`（主→渲染，到点弹通知；仅主窗口监听，见 `src/App.vue:43`）
- `tips-state-change` / `tips-state-sync`（主→渲染，番茄小窗监听）

## 复用 / 集成点
- **引擎被 habit 复用**：习惯通过 `useHabit.syncReminders()` 把提醒写进同一引擎（id 前缀 `habit:`），删除习惯时联动清理。
- **recordAfter 跳转主题对话**：提醒设 `recordAfter=1` 到点后 `App.vue` 自动 `router.push(THEME_CONVERSATION)` 记录情绪。
- **job 待办提醒**：`electron/main/module/job.ts:174` 的 `update-todo-reminders` 由引擎外的待办截止提醒复用。

## 特有坑 / 注意
- **持久化在主进程**：`newTips` 页面无自有 store 落库，所有数据靠 `newReminder.ts` 的 `get-tips/tips-save/tips-delete` 读写，改动引擎逻辑必须重启 Electron。
- **布尔字段约定**：`enabled/recordAfter/loop/lockScreen` 等在内存与 DB 均以 `1/0` 数值存储（`types.ts` 头部注释），UI 用 `el-switch` 的 `active-value=1/inactive-value=0`，不要传布尔。
- **通知只弹主窗口**：`tips-trigger` 在 `App.vue` 用 `isSecondWindow` 守卫，避免第二窗口重复弹通知/跳转。
- **多状态模式**靠 `states[]` + `loop` 驱动状态机，非序列态用 `continueLoop` 控制循环走向，配置错易卡状态。
