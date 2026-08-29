# 通用小窗壳 (smallWindow)

## 职责
「小窗」是渐离 App 的核心交互范式：番茄钟、剪贴板、待办、记账等以常驻浮动小窗口形态存在。本模块文档描述**小窗四件套架构**（如何新增/维护一个小窗），而非某个具体业务小窗。`src/views/smallWindow.vue` 是其中之一的壳组件（当前承载番茄钟第二窗口展示）。

## 关键文件（小窗四件套）
- 配置清单：`src/views/windowMode/config/windowSections.ts`（`WINDOW_SECTIONS` 数据驱动，新增小窗只加一条记录）
- 逻辑层：`src/views/windowMode/composables/useWindowModeSetting.ts`（三映射：`storeConfigMap` / `showSetterMap` / `storeVisibleMap` + `patch()` 落库 `window-mode:{storeKey}`）
- store：`src/store/useWindowMode.ts`（各小窗 config / show 状态）
- 路由：`src/router/index.ts`（每个迷你窗一条 `RouteNames.XXX` + path，路径须与 `createOtherWindow(arg)` 的 `arg` 一致）
- 主进程：`electron/main/module/newWindow.ts`（`createOtherWindow` 行 157、`open-new-window` 289 等）

## 路由
- `RouteNames.SMALL` → path `/small`（当前指向 `src/views/smallWindow.vue`，番茄钟第二窗口壳）
- 各迷你窗：`/pomodoro`、`/todoMiniWindow`、`/clipboardMiniWindow`、`/habitMiniWindow`、`/commandPaletteMiniWindow`、`/accountingMini`、`/stockMini` 等

## 用到的 IPC 通道（newWindow.ts）
- `open-new-window`（`{newWindowName, ops}`）、`close-new-window`、`hide-new-window`
- `sync-data-to-other-window`（主↔小窗同步）、`disable-mouse-click-through` / `enable-mouse-click-through`
- `get-window-bounds` / `set-window-bounds`

## 复用 / 集成点
- 新增小窗四步：① `windowSections.ts` 加 `WINDOW_SECTIONS` 项；② `useWindowModeSetting.ts` 三个映射表加 key；③ `useWindowMode` store 加对应 config/show 状态；④ `router` 加路由（arg 必须一致）。
- 常驻小窗（钉屏类，如 sticker）须在 `createOtherWindow` 的 `ops` 带 `mouseEvents:true`，否则鼠标点击穿透到桌面。

## 特有坑 / 注意
- **路径一致性**：`createOtherWindow(arg)` 直接拼 hash 路由（`#${arg}?isSecondWindow=true`），路由 path 必须与 `arg` 完全相同（如 `habitMiniWindow`），否则小窗白屏。
- **常驻穿透**：未在 `ops` 设 `mouseEvents:true` 的常驻小窗会穿透点击（`newWindow.ts:193` 判定）。
- 小窗是独立渲染进程，共享状态需经 `sync-data-to-other-window` 或 `basic_info`（`window-mode:*`）同步，不能假设与主窗口共用同一 Vue 实例。
- `smallWindow.vue` 当前内容偏番茄钟专属，若作为「通用壳」复用需抽离业务依赖（useTipsRuntime 等）。
