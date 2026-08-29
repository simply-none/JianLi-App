# 待办事项 (todoList)

## 职责
待办事项的增删改查、完成状态切换与截止提醒管理（主列表 + 小窗），并通过主进程 `job.ts` 把待办截止时间排成提醒。

## 关键文件
- 主页面：`src/views/todoList/index.vue`、`TodoList.vue`、`TodoDetailDialog.vue`、`RecordProgressDialog.vue`、`statusConfig.ts`
- 小窗：`src/views/todoMiniWindow/index.vue`
- 数据：直接走 `new-sql` IPC（**无独立 store**），表名见代码

## 路由
- `RouteNames.TODO_LIST` → `/todoList`
- `RouteNames.TODO_MINI_WINDOW` → `/todoMiniWindow`

## 用到的 IPC 通道
- `new-sql:query` / `new-sql:upsert` / `new-sql:delete`（渲染→主，待办表读写）
- `new-sql:execute`（渲染→主，**见坑**）
- `update-todo-reminders`（渲染→主；`TodoList.vue:233/256`、`TodoDetailDialog.vue:361` 在增改删/完成切换后发送，主进程 `job.ts:174` 的 `applyTodoReminders()` 重排截止提醒）
- 小窗还用 `open-new-window`(`todoMiniWindow`)/`close-new-window`、`sync-data-to-other-window`、`disable/enable-mouse-click-through`、`get-store`/`set-store`

## 复用 / 集成点
- **提醒联动**：编辑/完成待办后发 `update-todo-reminders`，由 `job.ts` 维护「截止提醒」。
- **habit 链式动作目标**：`src/views/habit/chainActions/actions/todoAction.ts` 打卡后改写待办状态并同样发 `update-todo-reminders`。
- **小窗四件套**：配置在 `windowSections.ts:204`（key=`todo`，storeKey=`todoMiniWindow`），store `useWindowMode` 的 `todoWindowConfig` + `setShowTodoWindow`。

## 特有坑 / 注意
- **本模块直接裸用 `new-sql:execute`**（`todoList` 视图里出现）：与 habit 的硬约束相反，待办这里用了 execute——若要重构请确认不会污染列。项目约定「业务表首选 query/upsert/delete，严禁裸 execute」，新增待办逻辑应优先走三件套。
- **无 store**：状态散在组件内，跨组件/小窗同步靠 `sync-data-to-other-window` 广播配置与 `get-store/set-store`，改动需注意主窗口与小窗双写一致性。
- **小窗鼠标穿透**：`todoMiniWindow` 需按需 `disable/enable-mouse-click-through` 控制拖动区，常驻捕获态要带 `mouseEvents`（参考 habit 小窗）。
