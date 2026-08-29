# 番茄钟与记录 (pomodoroRecord)

## 职责
番茄钟状态机（工作/休息/锁屏/空闲）的常驻小窗展示、记录落库与历史记录回看；另含 job 提示小窗（jobTipWindow）。状态权威由主进程 `newReminder` 的 `pomodoro` 多状态提醒驱动。

## 关键文件
- 记录页：`src/views/pomodoroRecord/index.vue`（列表/图表切换）、`charts.vue`、`segment.ts`
- 小窗：`src/views/pomodoroMiniWindow/index.vue` + `components/`（FlipCard/FlipCountdown）、`layouts/`（Default/Classic/Compact/Circle/Simple/Flip）
- Job 提示小窗：`src/views/jobTipWindow/index.vue`
- 状态 store：`src/store/usePomodoroStatus.ts`、`usePomodoroDisplay.ts`（读写经 `useGlobalSetting` 的 `get/setStore('curStatus')`）
- 记录落库：`src/utils/common.ts` 的 `setPomodoroStatus():139`→`new-sql:record-pomodoro`、`deletePomodoroStatus():151`→`new-sql:delete`（`pomodoro_status` 表）
- 主进程引擎：`electron/main/module/newReminder.ts`（`getStatefulCurrentState()`、`restartStatefulRound()`，id=`pomodoro`）

## 路由
- `RouteNames.POMODORO_RECORD` → `/pomodoroRecord`
- `RouteNames.SECOND` → `/pomodoro`（番茄小窗）
- `RouteNames.JOB_TIP_WINDOW` → `/jobTipWindow`

## 用到的 IPC 通道
- `new-sql:query`（渲染→主，读 `pomodoro_status` 历史；`pomodoroRecord`）
- `new-sql:record-pomodoro`（渲染→主，写记录，主进程带去重防主窗/小窗双写）
- `new-sql:delete`（渲染→主，删记录）
- `tips-state-change` / `tips-state-sync`（主→渲染，小窗监听刷新状态）
- 小窗四件套：`open/close-new-window`、`sync-data-to-other-window`、`disable/enable-mouse-click-through`、`get/set-store`

## 复用 / 集成点
- **提醒引擎复用**：番茄钟本质是 `newReminder` 里 `id='pomodoro'` 的多状态提醒，状态切换/锁屏均由引擎排程。
- **小窗四件套**：配置在 `windowSections.ts:176`（key=`pomodoro`，含 6 种 layout 预设），store `useWindowMode` 的 `pomodoroMiniWindowConfig`。
- **jobTipWindow**：监听 `sync-data-to-other-window` 与鼠标穿透控制，展示 job 待办提示。

## 特有坑 / 注意
- **记录去重**：`setPomodoroStatus` 走专用 `new-sql:record-pomodoro`（带去重），不要用普通 `new-sql:upsert` 写 `pomodoro_status`，否则主窗/小窗双写会产生重复记录（`common.ts:138` 注释）。
- **状态权威在主进程**：`usePomodoroStatus.ts:21` 强调以主进程下发为准，不要用本地 `curStatus` 反推锁屏态，否则启动时会误判。
- **小窗鼠标穿透**：`pomodoroMiniWindow` 用左右两侧 `mouse-* click-through` 控制拖动区，常驻捕获态需 `mouseEvents:true` 否则穿透点不动。
