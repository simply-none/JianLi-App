# 命令面板 (commandPalette)

## 职责
全局命令面板小窗：按作用域前缀（`@`笔记 / `#`待办 / `/`功能 / `!`习惯）模糊搜索并执行动作、跳转路由、打开小窗，数据源可插拔（REGISTRY）。

## 关键文件
- 小窗壳：`src/views/commandPalette/index.vue`（薄壳，仅挂 `CommandPalette`）
- 核心：`src/views/commandPalette/CommandPalette.vue`、`composables/useCommandSources.ts`（`REGISTRY:13`）、`composables/useCommandPalette.ts`、`usePaletteKeyboard.ts`
- 数据源：`src/views/commandPalette/sources/`（routeSource/actionSource/noteSource/todoSource/habitSource）
- 配置：`src/views/commandPalette/config/paletteConfig.ts`（`WINDOW_NAME='commandPaletteMiniWindow':4`、`DEFAULT_SHORTCUT='Ctrl+Space':10`、`SCOPE_PREFIX_MAP:37`）
- 类型/util：`types.ts`、`utils/db.ts`、`utils/score.ts`、`utils/text.ts`

## 路由
- `RouteNames.COMMAND_PALETTE` → `/commandPaletteMiniWindow`（路径须与主进程 `createOtherWindow(arg)` 一致，`router/index.ts:375`）

## 用到的 IPC 通道
- 各 source 内部按需走 IPC：noteSource/todoSource 经 `new-sql:query`；路由/动作类走 `open-new-window`、全局 shortcut 等。
- 小窗四件套：`open/close-new-window`(`commandPaletteMiniWindow`)、`sync-data-to-other-window`、`disable/enable-mouse-click-through`、`get/set-store`
- 快捷键触发：主进程 `registerShortcut.ts:353` 的 `open_command_palette` 类型 → `createOtherWindow('commandPaletteMiniWindow', {...,mouseEvents:true}:223)`

## 复用 / 集成点
- **命令面板 REGISTRY**：新增可搜索模块只需在 `useCommandSources.ts:13` 的 `REGISTRY` 数组追加一个 `CommandSource`，面板本体不动（仿 habit 链式动作注册表模式）。
- **小窗四件套**：配置在 `windowSections.ts:250`（key=`commandPalette`）。注意主进程 `DEFAULT_COMMAND_PALETTE_CONFIG` 兜底尺寸 640×460，因为 `createOtherWindow` 默认只有 108×81。
- **被快捷键注册页纳管**：`registerShortcut` 里有 `commandPaletteShortcut`（type=`open_command_palette`）。

## 特有坑 / 注意
- **`mouseEvents:true` 由主进程兜底**：`registerShortcut.ts:223/235` 在快捷键唤起时显式带 `mouseEvents:true`，但经由设置页 `open-new-window` 路径的 config 也必须含该字段，否则面板点不动。
- **小窗不监听失焦/Esc 由面板自身处理**：`index.vue` 注释说明透明窗口边缘点击会穿透失焦，因此不能监听失焦关闭；Esc 在 `document` 上统一处理。
- **搜索并发与过期**：`useCommandSources.search` 用 `token` 序号丢弃过期结果、`Promise.allSettled` 容错单源失败，新增 source 抛错不影响其它源。
