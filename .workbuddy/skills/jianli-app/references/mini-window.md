# 小窗机制与「四件套」（mini-window）

## 核心实现
- `electron/main/module/newWindow.ts` 的 `createOtherWindow(arg, ops)`：用 `arg` 直接拼 hash 路由（`#${arg}?isSecondWindow=true`）；默认透明无边框、置顶（`screen-saver`）、跳过任务栏。
- ⚠️ **关键坑**：`!ops.mouseEvents` 时 `setIgnoreMouseEvents(true, {forward:true})` 进入鼠标穿透——常驻可点击 / 可拖拽的小窗必须显式传 `mouseEvents:true`（habit 已示范；`clipboardWindow` 没带靠快捷键绕过，别照抄）。
- 关闭走 `hide-new-window`（隐藏复用不 destroy），与 quickNote 一致；**禁 window blur 自动关闭**。
- 小窗内开关走直接发 IPC，不要依赖 store watcher（各小窗是独立渲染进程，各有 Pinia）。
- 位置记忆：`POSITION_MEMORY_WINDOWS` 中 move 防抖 400ms 回写 `window-mode:{arg}`；唤出强制 `bottom-right`。
- 拖拽纯 CSS `-webkit-app-region:drag`；input/button 显式 `no-drag` + `user-select:text`。

## 新增小窗「四件套」（设置页数据驱动，纯配置零改页面）
1. `src/views/windowMode/config/windowSections.ts`：`WINDOW_SECTIONS` 追加一条 `{ key, title, icon, storeKey, fields, sizeOptions, skinOptions? }`。`storeKey` 必须 = `window-mode:{arg}`。
2. `src/views/windowMode/composables/useWindowModeSetting.ts` 三个映射图各加一行：
   - `storeConfigMap` → 指向 store 的 config ref
   - `showSetterMap` → 指向 `setShowXxx`
   - `storeVisibleMap` → 指向 `showXxxC`
3. `src/store/useWindowMode.ts`：新增 `showXxxWindow` ref + `xxxWindowConfig` ref（默认含 `mouseEvents` 决策）+ `watch` 调 `send('open-new-window' / 'close-new-window' / 'hide-new-window')`。参考 `habitWindowConfig` / `openHabitWindow()`。
4. `src/router/index.ts`：新增路由（path + `import` 组件 + `RouteNames` 枚举项），**路径名必须与主进程 `arg` 一致**（见 `router/index.ts:47-49` 注释）。

## 可选增强
- `electron/main/module/registerShortcut.ts` 的 `globalShortcutFn` 增加 `open_xxx_window` 分支 + `src/views/registerShortcut/index.vue` 常用功能列表加项；侧边栏 `src/layout/index.vue` 与 `src/views/routeSetting/index.vue` 的 `names` 数组加名。

## 何时读本文档
需要新增任何「小窗」形态功能时（打卡窗、待办窗、快速记录等）。
