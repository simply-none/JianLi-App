# 习惯打卡 (habit)

## 职责
管理习惯定义与每日打卡记录，并把每个习惯的提醒时刻「同步」成提醒引擎（newReminder）里的定点重复提醒，由主进程统一排程——习惯自身不实现调度器。

## 关键文件
- 主页面：`src/views/habit/index.vue`（薄壳，组装卡片/弹窗，打卡逻辑在 store）
- 核心 store：`src/store/useHabit.ts`（`syncReminders():124`、`saveHabit():185`、`checkIn():234` 派发链式动作）
- 数据层：`src/views/habit/api/habitApi.ts`（`ensureHabitTables():81`，走 `new-sql:query/upsert/delete`）
- 链式动作：`src/views/habit/chainActions/index.ts`（`ACTIONS` 注册表 `:18`）、`registry.ts`
- 小窗：`src/views/habitMiniWindow/index.vue` + `components/HabitCheckinPanel.vue`
- 类型/工具：`src/views/habit/types.ts`、`utils/streak.ts`、`components/*`

## 路由
- `RouteNames.HABIT` → `/habit`（主页面）
- `RouteNames.HABIT_MINI_WINDOW` → `/habitMiniWindow`（小窗；路径须与 `open-new-window` 的 arg 一致）

## 用到的 IPC 通道
- `new-sql:query` / `new-sql:upsert` / `new-sql:delete`（渲染→主，习惯表 `habit_def`/`habit_checkin`，主键 `key`，幂等覆盖）
- `get-tips` / `tips-save` / `tips-delete`（经 `useNewReminder` 复用，把习惯提醒同步进引擎）
- `open-new-window`(`habitMiniWindow`) / `hide-new-window`（小窗开关，由 `useWindowMode.openHabitWindow():150` 触发）

## 复用 / 集成点
- **提醒引擎复用**：`syncReminders()` 把每个提醒时刻建成 `mode='time'` 的提醒，id 形如 `habit:<key>#<序号>`（`useHabit.ts:23` 的 `HABIT_REMINDER_PREFIX`），删除/减时刻会清理旧提醒。
- **链式动作 registry**：打卡成功后 `dispatchChainActions` 派发（todo/note/themeConversation 等），仿命令面板 REGISTRY 模式，新增动作只需在 `chainActions/index.ts` 的 `ACTIONS` 加一行。
- **小窗四件套**：配置在 `windowSections.ts:258`（key=`habit`），store `useWindowMode` 的 `habitWindowConfig:159` 必须带 `mouseEvents:true`（见坑）。

## 特有坑 / 注意
- **严禁裸 `new-sql:execute`**：`habitApi.ts:10-19` 注释说明 execute 会猜列名并 ALTER 污染 `habit_def`/`habit_checkin`，习惯表读写一律走 query/upsert/delete。
- **主键不能用 ALTER 加**：底层用「先 ADD COLUMN key TEXT + CREATE UNIQUE INDEX」等价实现，`ensureHabitTables()` 幂等摆正历史破表。
- **小窗必须 `mouseEvents:true`**：否则 `createOtherWindow` 在缺 `ops.mouseEvents` 时进入鼠标穿透态，面板点不动也拖不动（`useWindowMode.ts:167-170`）。小窗刻意不监听失焦关闭（透明窗口边缘点击会穿透失焦，监听会误关窗口）。
- **小窗同步用 `hide` 而非 `close`**：`useWindowMode.ts:178` 复用窗口，避免重建。
