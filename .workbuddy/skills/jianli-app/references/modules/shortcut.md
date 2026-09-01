# 快捷键注册页 (registerShortcut)

## 职责
配置并注册全局快捷键（globalShortcut），把组合键绑定到「显示应用 / 打开某路由 / 打开某小窗 / 打开命令面板」等动作；落库后通知主进程注册。

## 关键文件
- 页面：`src/views/registerShortcut/index.vue`（卡片列表 + 注册逻辑；`shortcutGroups` 为 computed 引用合并后的列表，页面进入即直接渲染，右上角「刷新」按钮调 `getShortcut()` 从库重拉）。**页头与开发工具箱对齐**：`.head`（标题渐变淡出下划线 + 副标题 + 右侧刷新按钮，无卡片底、无图标块），使用说明用共享组件 `@/components/ToolHint.vue` 放在**标题下方**（`usageTips` 字符串数组），原底部 tips 卡片已删除；卡片样式保持不变
- 输入组件：`src/views/registerShortcut/shortcut.vue`（键盘捕获/下拉）
- 懒挂载：`src/views/registerShortcut/lazyMount.vue`（IntersectionObserver 视口内才挂载卡片内容，摊平渲染成本）
- 主进程：`electron/main/module/registerShortcut.ts`（`ipcMain.on('register-shortcut'):327`、`globalShortcutFn():333`）

## 路由
- `RouteNames.REGISTER_SHORTCUT` → `/registerShortcut`

## 用到的 IPC 通道
- `new-sql:query`（渲染→主，拉已存快捷键，表 `register_shortcut`，`:104` 实际 upsert 用此表）
- `new-sql:upsert`（渲染→主，primaryKey=`key`，`:104`）
- `register-shortcut`（渲染→主，落库成功后 `send('register-shortcut', shortcut):116`，主进程据此 `globalShortcut.register`）

## 复用 / 集成点
- **数据源来自路由表**：`originShortcuts`（常用功能）+ 基于 `layoutRouters` 动态生成的 `routeShortcuts`（`:285`），所有布局内路由都能注册快捷键（复用 `open_match_page` 链路：主进程 `openMatchPage` → 渲染端 `open-match-page` → `router.push({name:url})`）。
- **命令面板/习惯小窗**：列表里含 `commandPaletteShortcut`(type=`open_command_palette`) 与 `habitWindowShortcut`(type=`open_habit_window`)，由主进程 `registerShortcut.ts:353/...` 分支处理。
- **命令面板触发**：`Ctrl+Space` 默认唤出命令面板（见 `command-palette` 文档）。

## 特有坑 / 注意
- **⚡ 渲染卡顿（重点）**：整页有 ~78 张卡片（18 常用 + 全部路由），每卡 3 个 `el-select`，每个下拉含 ~70 个 `el-option`。若选项常驻渲染 = 上万个组件实例，直接渲染会停滞卡顿。两层优化：① `shortcut.vue` 的 `el-select` 加 `:persistent="false"`，下拉收起即销毁选项（EP 内置懒渲染，源码 `shouldRender = persistent ? true : open`）；② `index.vue` 每张卡片内容用 `lazyMount.vue`（IntersectionObserver）包裹，滚动接近视口才实例化，摊平渲染成本。改回常驻或去掉懒挂载都会复现卡顿。
- **全局监听器泄漏**：`shortcut.vue` 的 `document` 级 `keydown`/`click` 监听必须只在「激活输入」时挂载、`deactivateInput`/`onUnmounted` 里移除；曾出现每实例常驻注册 `click` 且不清理，导致上百实例的监听风暴。
- **至少 2 键组合**：`canRegister():313` 校验 `shortcut.filter(s=>s!=='').length >= 2`，单键注册会被拒。
- **快捷键字符串归一化**：库里以 `+` 连接存字符串，渲染端 `normalizeShortcut()`:332 拆成长度 3 数组，写入时 `item.shortcut.join('+')`，读写两端格式必须对齐。
- **主进程注册须重启生效**：改 `registerShortcut.ts` 要重启 Electron；改渲染端（卡片/列表展示）热重载即可。
- **与主进程逻辑耦合**：`open_command_palette` 等分支在 `electron/main/module/registerShortcut.ts` 内，新增动作类型需同时改主进程，否则注册了也不响应。
