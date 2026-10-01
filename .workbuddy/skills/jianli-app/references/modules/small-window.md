# 小窗（smallWindow）通用壳 · 四件套

> 本文档由旧 `mini-window.md`（核心机制）与 `small-window.md`（模块文档）合并而来，是「小窗四件套」的唯一权威说明。

## 职责
「小窗」是渐离 App 的核心交互范式：番茄钟、剪贴板、待办、记账等以常驻浮动小窗口形态存在。本模块文档描述**小窗四件套架构**（如何新增/维护一个小窗），而非某个具体业务小窗。`src/views/smallWindow.vue` 是其中之一的壳组件（当前承载番茄钟第二窗口展示）。

## 核心实现（主进程 createOtherWindow）
- `electron/main/module/newWindow.ts` 的 `createOtherWindow(arg, ops)`：用 `arg` 直接拼 hash 路由（`#${arg}?isSecondWindow=true`）；默认透明无边框、置顶（`screen-saver`）、跳过任务栏。
- ⚠️ **关键坑**：`!ops.mouseEvents` 时 `setIgnoreMouseEvents(true, {forward:true})` 进入鼠标穿透——常驻可点击 / 可拖拽的小窗必须显式传 `mouseEvents:true`（habit 已示范；`clipboardWindow` 没带靠快捷键绕过，别照抄）。
- 关闭走 `hide-new-window`（隐藏复用不 destroy），与 quickNote 一致；**禁 window blur 自动关闭**。
- 小窗内开关走直接发 IPC，不要依赖 store watcher（各小窗是独立渲染进程，各有 Pinia）。
- 位置记忆：`POSITION_MEMORY_WINDOWS` 中 move 防抖 400ms 回写 `window-mode:{arg}`；唤出强制 `bottom-right`。
- 拖拽纯 CSS `-webkit-app-region:drag`；input/button 显式 `no-drag` + `user-select:text`。

## 关键文件（小窗四件套）
- 配置清单：`src/views/windowMode/config/wwindowSections.ts`（`WINDOW_SECTIONS` 数据驱动，新增小窗只加一条记录）
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

## 新增小窗「四件套」步骤（数据驱动，纯配置零改页面）
1. `src/views/windowMode/config/windowSections.ts`：`WINDOW_SECTIONS` 追加一条 `{ key, title, icon, storeKey, fields, sizeOptions, skinOptions? }`。`storeKey` 必须 = `window-mode:{arg}`。
2. `src/views/windowMode/composables/useWindowModeSetting.ts` 三个映射图各加一行：`storeConfigMap` → store 的 config ref；`showSetterMap` → `setShowXxx`；`storeVisibleMap` → `showXxxC`。
3. `src/store/useWindowMode.ts`：新增 `showXxxWindow` ref + `xxxWindowConfig` ref（默认含 `mouseEvents` 决策）+ `watch` 调 `send('open-new-window' / 'close-new-window' / 'hide-new-window')`。参考 `habitWindowConfig` / `openHabitWindow()`。
4. `src/router/index.ts`：新增路由（path + `import` 组件 + `RouteNames` 枚举项），**路径名必须与主进程 `arg` 一致**（见 `router/index.ts:47-49` 注释）。

## 可选增强
- `electron/main/module/registerShortcut.ts` 的 `globalShortcutFn` 增加 `open_xxx_window` 分支 + `src/views/registerShortcut/index.vue` 常用功能列表加项；菜单入口：只改 `src/constants/menu.ts` 的 `menuGroupDefs` 分组 `names`（侧边栏与路由配置页自动同步，不再分别改两个 vue）。

## 复用 / 集成点
- 新增小窗四步即上述「四件套」步骤；菜单四件套（路由 / iconMap / 侧边栏 / routeSetting）与业务模块一致。
- 常驻小窗（钉屏类，如 sticker）须在 `createOtherWindow` 的 `ops` 带 `mouseEvents:true`，否则鼠标点击穿透到桌面。

## 特有坑 / 注意
- **路径一致性**：`createOtherWindow(arg)` 直接拼 hash 路由（`#${arg}?isSecondWindow=true`），路由 path 必须与 `arg` 完全相同（如 `habitMiniWindow`），否则小窗白屏。
- **常驻穿透**：未在 `ops` 设 `mouseEvents:true` 的常驻小窗会穿透点击（`newWindow.ts:193` 判定）。
- 小窗是独立渲染进程，共享状态需经 `sync-data-to-other-window` 或 `basic_info`（`window-mode:*`）同步，不能假设与主窗口共用同一 Vue 实例。
- `smallWindow.vue` 当前内容偏番茄钟专属，若作为「通用壳」复用需抽离业务依赖（useTipsRuntime 等）。

## 何时读本文档
需要新增任何「小窗」形态功能时（打卡窗、待办窗、快速记录等）。
