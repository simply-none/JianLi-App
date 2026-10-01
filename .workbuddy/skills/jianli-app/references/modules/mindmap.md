# 思维导图 (mindmap)

## 职责
基于已有 `@vue-flow/core` 自研的**思维导图**：树形结构编辑 + 自研树布局（左右 / 右向 / 左向 / 向下四种方向）+ 折叠展开 + 内联改名 + 撤销重做 + 节点备注与分支色 + 搜索定位 + JSON / Markdown 导入导出 + 多文档保存。
**P2 增补**：SVG / PNG 图像导出 + OPML / FreeMind / XMind 互转 + 从「待办 / 笔记 / 主题对话」一键生成导图。
**P3 增补**：连线锚点修正（`nodeHandles()` 单点真相）+ **拖拽固定节点坐标并持久化**（`node.pos`，可撤销、可「整理布局」一键还原）。
**P4 增补**：**节点右键菜单**（新增子 / 同级 / 复制 / 重命名 / 折叠 / 备注 / 删除 + 三类颜色内联色板）+ **节点背景色 / 文字色**（与分支色共用同一套 6 色 key，主题自适应、零迁移）。
**P5–P13 增补（2026-10-01）**：剪切 / 粘贴子树（模块级内存剪贴板，跨文档可用）+ **双击空白「就近新建」** + **分支聚焦**（把子树当整张图渲染）+ **左侧大纲面板**（树的第二种渲染，零新写路径）+ **框选多选与批量操作** + **拖到目标节点换父**（一个拖动手势、靠落点分两种语义）+ **导出子树为待办**（唯一一处写别的模块的表）+ **节点图标（emoji）与链接（http/https 白名单）** + **MiniMap 缩略图（自研，零新依赖）** + **鱼骨 / 时间轴两种新布局** + **命令面板打开指定导图**（跨窗口走主进程 store，零主进程改动）。
**P14 增补（2026-10-01）**：**画布右上角「设置」浮层（字体 / 字号，文档级版式）** —— 字体列表复用设置页那一套（`get-fonts` IPC + `globalFontOpsC`，**零新主进程通道**）；字号是「**基准 + 层级增量**」（`fontSizeOf`），单一滑杆、可撤销、随 JSON / SVG 导出带走（见坑 54）。
与「流程图」(flow) 共用 vue-flow 渲染层，但**数据模型、布局算法、store 全部独立**。

## 关键文件
目录：`src/views/mindmap/`（严格按「纯逻辑 / 状态 / 视图」三层拆分，单文件职责单一；2026-10-01 实测共 **45** 个 .ts/.vue（19 `.vue` + 26 `.ts`）+ 1 个 .scss）

| 层 | 文件 | 职责 |
|---|---|---|
| 类型 | `types.ts` | 纯类型；语义结构 + **唯一位置字段 `MindNode.pos`（可选，仅手动拖过的节点有）**；`MindColorKey`（分支 / 背景 / 文字色共用）；`MindNode.icon?`（emoji ≤4 码点）/ `link?`（http/https）；**文档级版式 `MindDocData.fontFamily?` / `fontSize?`（可选 ⇒ 零迁移）** |
| 常量 | `constants.ts` | 尺寸 / 间距 / Handle id / **`nodeHandles()` 与 `edgeHandles()`** / 色板 `MIND_COLORS` + `toneVar()`·`toneSoftVar()`·`branchVar()` / 布局选项（含 `fishbone`·`timeline`）/ **`isStraightEdge()`** / 快捷键文案 / `MINIMAP_STORAGE_KEY` · `OPEN_DOC_STORE_KEY` · `MINIMAP_NODE_LIMIT` · `MIND_MENU_TEXT` / **字号：`DEFAULT_FONT_SIZE`(13)·`FONT_SIZE_RANGE`·`FONT_INHERIT_VALUE`·`clampFontSize()`·`fontSizeOf(level, base)`（基准+增量）** |
| 样式 | `styles/palette.scss` | 色板 `--mm-tone-*`（实色）与 `--mm-tone-*-soft`（低透铺底）+ `--mm-branch-*`（实色别名）；非 scoped，**画布 / 属性弹窗 / 右键菜单 / 色板行共用** |
| 纯逻辑 | `utils/tree.ts` | immutable 树操作（增删改折叠 / 备注 / 分支色 / **背景色 / 文字色** / pos 读写与清空 / **`cloneSubtree()` 复制子树** / 展开到节点 / 平铺 / 导航 / 反序列化兜底；**`normalizeIcon`·`normalizeLink`（协议白名单）**；**`normalizeFontFamily()`·`normalizeFontSize()`（文档级字体 / 字号归一，UI 写入与反序列化共用，`initial`/`inherit`/空串折成「不覆盖」）** / **`removeMany()` 批量删（先滤掉祖先已选中的后代）** / **`reparent()` 换父（防环、清 pos、展开新父、一次变换）** / **`setNodeColorMany`·`setNodeBgMany`·`setNodeTextColorMany`·`setCollapsedMany`**） |
| 纯逻辑 | `utils/measure.ts` | 首帧尺寸估算（中文 1em、半角 0.55em；**额外计入图标宽度 `NODE_ICON_WIDTH`**；**高度按 `baseFontSize / DEFAULT_FONT_SIZE` 等比缩放 ⇒ 与文档字号一致**） |
| 纯逻辑 | `utils/layout.ts` | 自研树布局算法（水平类 / 垂直类两趟递归，O(n)；**`pos` 优先于算法结果**；**新增 `fishbone`（主轴 + 交替上下斜支骨）与 `timeline`（主轴 + 上下交错里程碑）**） |
| 纯逻辑 | `utils/geometry.ts` | **画布几何**：`rectsIntersect`（相交面积 > 0，贴边不算）/ `rectsIntersecting` / `pointInRect`（闭区间）/ `nearestRectId`（按**矩形最近边缘**算距离）；框选与「就近新建」共用，纯算术可断言 |
| 纯逻辑 | `utils/markdown.ts` | Markdown 大纲互转（导出缩进列表；导入吃标题或列表） |
| 纯逻辑 | `utils/exchange.ts` | JSON 交换文件包封 / 解析 / **全部导出文件名**（json/md/svg/png/opml/mm/xmind） |
| 纯逻辑 | `utils/xml.ts` | XML 转义 + `DOMParser` 解析 + 子元素遍历（OPML / FreeMind / XMind 共用） |
| 纯逻辑 | `utils/opml.ts` | OPML 互转（`<outline text>` / `_note`） |
| 纯逻辑 | `utils/freemind.ts` | FreeMind `.mm` 互转（`<node TEXT>` / `FOLDED` / `richcontent`） |
| 纯逻辑 | `utils/xmind.ts` | XMind `.xmind` 互转（zip + `content.json`，走**已在依赖里的** `jszip`） |
| 纯逻辑 | `utils/svgExport.ts` | **由树 + 布局结果直接生成独立 SVG**（换行、几何、主题色归一化；**图标偏移 / 链接徽标 / 备注浮标**；**鱼骨主轴与时间轴里程碑骨架层**；鱼骨连线走直线；**节点 `font-size` 走 `fontSizeOf(level, options.fontSize)`，字号随导出带走**） |
| 纯逻辑 | `utils/generate.ts` | 待办 / 笔记 / 主题对话 → 树（**只读**映射）；**反向：`treeToTodos()`（子树 → 待办写入载荷，父子映射成新 key 的 `parentIds`，空文本节点跳过但不吞子树，超 `max` 截断）** |
| 纯逻辑 | `utils/popup.ts` | **浮层定位几何**：`placePopup()`（光标落点 → 越界翻转 → 夹视口）+ `clampInto()`；纯算术、可断言，右键菜单与将来的浮层共用 |
| 状态 | `composables/useMindDoc.ts` | 模块级单例文档状态 + **全部树操作唯一写入口 `commit`**（含 `duplicateById` / `setNodeBg` / `setNodeTextColor`）；**多选 `selectedIds`（不变式：`selectedId` 恒为「最后加入者」＝主选中）+ `setSelection` / `selectionList` / `removeSelectionByIds` / `reparentById` / `setNodeIcon` / `setNodeLink` / `snapshotById` / `pasteChild` / `pasteTargetId`**；**`commitData()`（整份 `doc.data` 一次替换，`setLayout` / `setFontFamily` / `setFontSize` 共用）+ 文档级 `fontFamily` / `fontSize` 计算属性与写入口（传 `undefined` ⇒ 删键）** |
| 状态 | `composables/useMindHistory.ts` | 撤销 / 重做快照栈（上限 80，模块级单例） |
| 状态 | `composables/useMindView.ts` | 一次性视图信号：`requestFit/consumeFit`、`requestFocus/consumeFocus`、浮层单例 `nodePanelId`（属性弹窗）与 `menuNodeId`/`menuX`/`menuY`/`menuAnchor`（右键菜单）；**分支聚焦 `focusRootId` + `enterFocus/exitFocus`**、**大纲 `outlineOpen` / `outlineEditingId`**、**MiniMap `minimapOpen`（localStorage 持久化）**、**`pendingOpenId` + `requestOpen/consumeOpen`（含跨窗口主进程 store 桥）** |
| 状态 | `composables/useMindClipboard.ts` | **模块级内存剪贴板**（不碰系统剪贴板）：`copy` / `cut` / `paste` / `hasClipboard`；快照每次粘贴重新 `cloneSubtree` ⇒ 可连贴多次、模块级单例 ⇒ **跨文档可用** |
| 状态 | `composables/useMindPersist.ts` | newSql 三件套薄封装（list/load/save/remove） |
| 状态 | `composables/useMindActions.ts` | 动作编排：状态 + 持久化 + 提示/确认策略 |
| 状态 | `composables/useMindTransfer.ts` | 导入导出编排（7 种格式；导出菜单 `EXPORT_ITEMS` 也在这里定义） |
| 状态 | `composables/useMindExport.ts` | SVG / PNG 导出（**同一份 SVG 两种产物**；PNG 经 `Image → canvas`）；**导出带上文档级字体 / 字号**（`readTheme().fontFamily` 优先取文档字体；布局回落的估算与 `buildSvg()` 都传 `fontSize`） |
| 状态 | `composables/useMindSearch.ts` | 节点搜索（`searchNodes` 纯函数 + 单例 open/query/hits/activeIndex） |
| 状态 | `composables/useMindShortcuts.ts` | 键盘 → 意图映射（IME 安全） |
| 画布 | `composables/useMindGraph.ts` | 树 ⇄ vue-flow 元素编译 + 两段式布局 + 分支色继承 + 拖动整棵子树（**松手时把坐标写进树**）+ `centerOn`；**聚焦子树作根渲染**（id 失效回落全图）、**`visibleRects()` / `toFlowPoint()` / `nearestNodeId()`**、**拖动中命中测试（中心点包含 + 排除自身后代与根 + `dropTarget` 高亮）与落点分流（换父 / 记坐标）**；第二段的 **`updateNodeInternals()` 只是「无重渲染的 DOM 尺寸变化」的保险，不是字号重排的承重件**（真库实测，见坑 54） |
| 视图 | `components/MindCanvas.vue` | **唯一持有 `<VueFlow>` 的地方**；定义 `--mm-*` 主题变量；挂载右键菜单、缩放条、**分支聚焦浮条、MiniMap、框选矩形、画布设置浮层**；**双击空白「就近新建」+ Shift 拖拽框选（捕获阶段 pointerdown 抢手势）** |
| 视图 | `components/MindSettingBar.vue` | **画布右上角「设置」浮层**（字体 / 字号，文档级）：`el-popover`（teleport 到 body，避开容器 `overflow: hidden`）；字体下拉复用 `get-fonts` + `globalFontOpsC`（首次打开才拉），首项「跟随应用字体」；字号滑杆**只在松手 `change` 时写文档**，带三档比例预览与「字号恢复默认」 |
| 视图 | `components/MindNode.vue` | 自定义节点（Handle 由 **`nodeHandles()` 派生**、折叠钮、选中环、分支色条、备注浮标、**链接徽标**、**图标 emoji**、**拖放候选虚线高亮**、右键上报坐标 + 节点锚点矩形、背景 / 文字色 fallback 链；**字号 / 字体族走行内 `nodeStyle`（文档级 `fontSizeOf(level, base)`），层级字号不再写死在 CSS 类里**） |
| 视图 | `components/MindNodeEditor.vue` | 内联文本编辑（原子，不碰树） |
| 视图 | `components/MindNodeMenu.vue` | **节点右键菜单**（teleport 到 body 的浮层；结构操作 + **剪切 / 粘贴** + 三行内联色板 + **聚焦此分支 / 导出为待办** + 删除；落点交给 `utils/popup.ts` 算；**定位完成前 `visibility: hidden` 防闪**；点外 / Esc / 滚轮 / 失焦关闭） |
| 视图 | `components/MindColorRow.vue` | **一行色板**（分支 / 背景 / 文字三处共用；`variant` 决定色块画实色还是低透铺底色） |
| 视图 | `components/MindNodeDialog.vue` | 节点属性弹窗（备注 + **图标 / 链接** + 分支色 / 背景色 / 文字色三行色板 + 位置状态与「恢复自动」；图标与链接走 `@change` 提交，**不是每次按键**） |
| 视图 | `components/MindOutline.vue` | **左侧大纲面板**（树的第二种渲染）：`flattenVisible` 拍平 + `v-for` 行组件；可见性语义与画布同源 |
| 视图 | `components/MindOutlineRow.vue` | 大纲单行（折叠箭头 / 图标 / 色点 / 行内改名 `<input>` / 备注与链接标记；右键复用节点菜单，anchor 传**行矩形**） |
| 视图 | `components/MindFocusBar.vue` | **分支聚焦浮条**（画布顶部胶囊：聚焦节点文本 + 「返回全图」） |
| 视图 | `components/MindMiniMap.vue` | **自研缩略图（零新依赖）**：`getNodes` 实测坐标 + 当前视口等比映射；点选 / 拖动跳转；**内容包围盒 = 节点盒 ∪ 视口盒**（视野里没节点时视口框也不会跑丢） |
| 视图 | `components/MindSelectionBox.vue` | 框选矩形（纯展示、`pointer-events: none`；命中计算在画布层） |
| 视图 | `components/MindGenerateDialog.vue` | 「从待办 / 笔记 / 主题对话生成导图」弹窗（只读查询 + 预览节点数） |
| 视图 | `components/MindSearchBox.vue` | 搜索按钮 + 下拉结果面板（自己接管 ↑↓/Enter/Esc；命中聚焦子树外的节点时先退出聚焦） |
| 视图 | `components/MindZoomBar.vue` | 右下角悬浮缩放条（自取 vue-flow 视口助手） |
| 视图 | `components/MindToolbar.vue` | 顶部工具条（文档 / 布局（含**鱼骨·时间轴**）+ 整理布局 / 撤销 / 导入 + 导出下拉 / 生成 / 节点 / **大纲·缩略图开关** / 搜索帮助）。**窄窗口可横向滚动，且鼠标竖向滚轮会被转成横向滚动**（`onWheel`）：结构为 `__scroll`（滚动区，只装 button）+ `__tail`（固定区，装搜索 + 帮助）—— 浮层绝不能进滚动区，见坑 22 |
| 视图 | `components/MindDocDialog.vue` | 文档管理弹窗（打开 / 删除 / 新建） |
| 视图 | `components/MindHelpDialog.vue` | 快捷键速查（按 `SHORTCUT_GROUPS` 分组渲染） |
| 页面 | `index.vue` | 装配层：工具条 + **左侧大纲（可开合，flex row）** + 画布 + 弹窗开关 + 挂载快捷键 + **大纲开合后 `nextTick` 再 `fit()`** |

关联主进程：**无独立 module**，数据走 newSql 三件套；导入导出走既有 `export-text-to-cache` / `export-buffer-to-cache`；跨窗口「打开指定导图」复用既有 `get-store` / `set-store` 与 `palette-navigate`（**P0–P13 全程零主进程改动，改完热重载即生效、不需要重启 Electron**）。

## 数据模型（核心决策）
```
表 mindmap：id INTEGER 自增 PK | name TEXT | type TEXT('mindmap') | data TEXT(树 JSON) | create_time TEXT | update_time TEXT
data = { version: 1, layout: 'both'|'right'|'left'|'down'|'fishbone'|'timeline', root: MindNode,
         fontFamily?: string, fontSize?: number }   // 文档级版式（可选；老数据没有 = 跟随应用字体 / 默认 13）
MindNode = { id: string, text: string, collapsed?: boolean, note?: string, color?: ColorKey,
             bgColor?: ColorKey, textColor?: ColorKey, icon?: string, link?: string,
             pos?: { x: number, y: number }, children: MindNode[] }   // pos = 手动固定坐标（可选）
ColorKey = 'blue'|'teal'|'green'|'amber'|'coral'|'purple'   // 只存 key，不存色号
```
- **树是唯一真源，坐标默认是派生**：结构操作会重新布局，坐标默认不落库 ⇒ 将来换布局（鱼骨图 / 组织结构图 / 径向）历史数据零迁移。
  **唯一例外 = `MindNode.pos`**（P3 起）：只有**用户手动拖过**的节点才有这个字段，布局算法遇到它就采用该坐标，并让它的子节点**相对它**摆放。
  这样「加节点 / 折叠 / 换布局」不会把手工摆过的位置冲掉，也不会让自动排版被一堆散落的旧坐标绑住；
  老数据没有该字段 ⇒ **零迁移**；「整理布局」（`tree.clearPositions`）一键全部还原。
- **`icon` / `link` 同样是「只存语义、不存渲染」**（P11）：`icon` 是一个 emoji（≤ `MAX_ICON_CODEPOINTS` 个码点），`link` 是**归一化后的 http/https 字符串**（协议白名单在 `utils/tree.ts` 的 `normalizeLink`，非法值 = 清除而不是报错）。两者都参与 `JSON.stringify`，所以导入导出会带着走；清除时字段值为 `undefined` ⇒ 落库 JSON 里干净（零迁移，老数据没有就是没有）。
- **字体 / 字号是「文档级版式」，放 `doc.data` 而不是全局设置 / localStorage**（P14）：同一份图在别人机器上要长得一样、导出的 JSON / SVG 也得带走 ⇒ 不能放只服务本机的设置（对比 MiniMap 开关 —— 那是「这台机器上我喜欢怎么看」，所以走 localStorage）。两字段都可选、`normalizeDocData` **只在合法时保留** ⇒ **零迁移**（老数据不会平白多出键）。`fontSize` 存的是**基准值**，各层级由 `fontSizeOf(level, base)` 现算（根 `+2`、一级 `+0.5`、其余 `+0`），`DEFAULT_FONT_SIZE = 13` 时与旧的写死 15 / 13.5 / 13 **逐像素一致**。
- **`layout` 的合法性由 `LAYOUT_DIR_VALUES` 把关**（P12）：反序列化遇到未知布局一律回落 `both`，不会因为库里有脏值就整张图打不开。
- **不用 dagre**：项目里的 `@dagrejs/dagre` 是**有向图分层**，`rankdir` 只能单向推进，做不出「根居中 + 子树左右分叉 + 各节点尺寸不一」，所以 `utils/layout.ts` 自研。
- 所有树操作 **immutable + 结构共享**，因此可用 `next === prev` 判断「无改动」并短路。
- **三类颜色都只存 key**（P4）：`color` 分支色 / `bgColor` 背景色 / `textColor` 文字色，共用同一套 6 色。
  颜色由 `styles/palette.scss` 用主题令牌 + `color-mix()` 派生，26 套主题自动适配 ⇒ **库里不写死任何色号**。
  - **分支色**管「描边 + 左缘色条 + 连线」，且**沿子树继承**（`useMindGraph.collectBranches` 一次遍历）；
  - **背景色**管底色、**不继承**（颜色是局部强调，继承会很快糊成一片），渲染取**低透铺底** `--mm-tone-*-soft`（实色当背景会把文字吃掉）；
  - **文字色**管字色、**不继承**；三个维度互相独立（选同色系会低对比，交给用户权衡）。
  - 渲染是「**用户变量 + 层级默认值**」的 fallback 链：`background: var(--mm-node-bg-user, var(--mm-root-bg))` —— 层级默认底色按层级分档，只有把默认值放在 fallback 位置才能做到「没设色时与原来逐像素一致」。
- **备注不参与布局**：节点上只有一个绝对定位的浮标，备注正文收在弹窗里 —— 否则长文本会把节点撑到 264px 上限外。
- 独立性：**不复用 `flow` 表** —— `flow.vue:213` 读取时只 `limit 1 + orderBy id desc`、**没有 type 过滤**，共用表会双向串数据。

## 路由 / 菜单
- `RouteNames.MINDMAP` → `/思维导图`（`src/router/index.ts`，紧邻 `/流程图`）
- 菜单：`src/constants/menu.ts` 的「效率工具」组，位于 `categorizableNotes` 与 `themeConversation` 之间
- 图标：`iconMap.mindmap = 'Network'`；`LucideIcon.vue` 的 **import 与 nameMap 两处**都已登记 `Network` / `Redo2` / P2 的 `Database`（生成入口）/ P3 的 `LayoutGrid`（整理布局）与 `Pin`·`Move`（节点属性里的位置状态）/ P5–P13 的 `Scissors`·`ClipboardPaste`（剪切粘贴）、`ListTree`（大纲）、`Map`（缩略图）、`Crosshair`（分支聚焦）、`ListPlus`（导出为待办）（漏一处会静默 fallback 成 CloudAlert）；P14 又添 `Settings`·`RotateCcw`（画布设置面板的按钮与「字号恢复默认」）
- 导出中心：`electron/main/module/backup.ts` 的 `EXPORT_GROUPS` 已加 `{ key:'mindmap', label:'思维导图', tables:['mindmap'] }`
- **命令面板**：`commandPalette/sources/actionSource.ts` 有 `action:new-mindmap`（新建空白图）；**`commandPalette/sources/mindmapSource.ts`（P13 新增）列出 `mindmap` 表里的文档**，选中后写 `OPEN_DOC_STORE_KEY` + `navigate('mindmap')`；`paletteConfig.ts` 的 `PREFERRED_ROUTES` 把 `mindmap` 放在第 4 位，`SCOPE_PREFIX_MAP['/']` 与 `TYPE_META.mindmap` 也已登记
- **未接入**局域网同步白名单（`syncModule.ts` / `src/store/useSync.ts` 都没动）—— 思维导图不参与双端同步

## 用到的 IPC 通道
- `new-sql:query`（列表 / 按 id 读取；`limit/orderBy/orderByDesc` 放顶层，`conditions` 只放等值过滤）
- `new-sql:upsert`（保存；带 `id` 命中 ON CONFLICT 走更新，不带则插入，主键 `id`；**P8 起也用于向 `todo_list` 写待办**）
- `new-sql:delete`（删除；`condition: { id }`）
- `export-text-to-cache`（导出 JSON / Markdown / OPML / FreeMind / **SVG**，`sendSync` + `fileNotify`）
- `export-buffer-to-cache`（导出 **PNG / XMind**，base64 二进制）
- `new-sql:query` **只读** `todo_list` / `note_book` / `conversation_theme` / `conversation`（「一键生成导图」用，`SqlStr` 直查）
- **`get-store` / `set-store`**（`sendSync`，P13 用于跨窗口把「要打开哪份导图」的 id 交给主窗口）
- **`palette-navigate`**（由命令面板小窗发出，主进程转 `open-match-page` 给主窗口 `router.push`；P13 复用）
- ❌ 未用 `new-sql:execute`；**P0–P13 全程未新增任何主进程通道**

## 快捷键（`constants.SHORTCUT_HINTS` 与 `useMindShortcuts` 必须保持一致）
| 分组 | 按键 | 行为 |
|---|---|---|
| 节点 | **节点上右键** | **打开节点操作菜单**（新增子节点 / 新增同级 / 复制 / **剪切 / 粘贴** / 重命名 / 折叠展开 / 备注与属性 / 三类颜色 / **聚焦此分支 / 导出为待办** / 删除） |
| 节点 | `Tab` | 为选中节点添加子节点（无选中则以根为父） |
| 节点 | `Enter` | 添加同级节点（根节点退化为添加子节点） |
| 节点 | `F2` / 双击 | 重命名（进入内联编辑） |
| 节点 | `Delete` / `Backspace` | 删除选中节点及其子树（**多选带数量确认；混选根时跳过根并提示**） |
| 节点 | `Space` | 折叠 / 展开选中节点 |
| 节点 | `↑` / `↓` | 在**可见**兄弟节点间移动选中 |
| 节点 | `←` / `→` | 跳父节点 / 第一个子节点 |
| 节点 | `Ctrl/Cmd + C` / `X` / `V` | 复制 / 剪切子树、粘贴为选中节点的子节点（剪贴板跨文档共享） |
| 节点 | **双击空白处** | 在**最近的**节点下新建子节点 |
| 节点 | **`Shift` + 拖拽空白** | **框选多个节点**（替换选中集合；`Delete` 批量删除、色板批量改色） |
| 节点 | **拖到目标节点上松手** | 把该节点（含子树）**换父**为目标节点的子节点 |
| 文档 | `Ctrl/Cmd + S` | 保存 |
| 文档 | `Ctrl/Cmd + Z` | 撤销 |
| 文档 | `Ctrl/Cmd + Shift + Z`、`Ctrl + Y` | 重做 |
| 视图 | `Ctrl/Cmd + F` | 打开 / 关闭节点搜索 |
| 视图 | `Ctrl/Cmd + 0` | 适应画布 |
| 视图 | `Ctrl/Cmd + A` | 折叠全部 / 再按展开全部（切换语义；工具条上「折叠全部 / 展开全部」按当前折叠态**互斥出现**，见坑 53） |
| 视图 | `Ctrl/Cmd + Shift + O` | 打开 / 关闭左侧大纲 |

## 导出 / 导入格式一览
| 格式 | 方向 | 出口 | 说明 |
|---|---|---|---|
| JSON `.mindmap.json` | 双向 | `exportTextToCache` | 完整往返（含备注 / 三类颜色 / 布局 / 折叠 / 手动坐标） |
| Markdown `.md` | 双向 | `exportTextToCache` | 只含层级与文本 |
| OPML `.opml` | 双向 | `exportTextToCache` | 含 `_note` 备注 |
| FreeMind `.mm` | 双向 | `exportTextToCache` | 含 `FOLDED` 折叠与 `richcontent` 备注 |
| XMind `.xmind` | 双向 | `exportBufferToCache` | zip + `content.json`（**只支持新版**） |
| SVG `.svg` | 只导出 | `exportTextToCache` | 真矢量，可在 AI / Inkscape 继续编辑（**含背景 / 文字色**，见「特有坑」36） |
| PNG `.png` | 只导出 | `exportBufferToCache` | 由同一份 SVG 栅格化，2 倍图 |

## 特有坑 / 注意

1. **vue-flow store 必须显式指定 id**：`MINDMAP_FLOW_ID = 'mindmap'`。不指定 id 时 `useVueFlow()` 会拿到**默认 store**，与「流程图」模块共用，节点会串到对方画布上。
   反向确认：`useVueFlow('mindmap')` 先在 `useMindGraph()` 里预建 store 是**安全的** —— `<VueFlow :id="'mindmap'">` 会复用同一实例，且 `useWatchProps` 内部的 `watchRest()` 用 `immediate: true` 把每个 props 写回 store（守卫是 `isDef` = `typeof v !== 'undefined'`，**`null` 也算已定义**，所以 `:delete-key-code="null"` 能生效）。

2. **两段式布局是必须的**：vue-flow 是「先渲染后测量」，首帧所有节点 `dimensions` 都是 0，直接布局会全部叠在原点。
   `useMindGraph.sync()` 的流程 = 用（实测 ?? 估算）排一遍 → `setNodes/setEdges` → `nextTick` → 轮询等实测尺寸（`requestAnimationFrame`，**320ms 超时**）→ 拿实测值再排一遍 → `syncToken` 防止过期重排覆盖。

3. **折叠后代要从数组里剔除，不能用 `hidden: true`**：否则 `fitView` 的包围盒仍包含隐藏节点，折叠后画布留一大片空白。见 `flattenVisible()`。

4. **`fitView` 只能「按需」触发**：不能每次 `revision` 变化都 fit，否则每敲一个字画布都重新居中，用户正在看的位置被不断拽走。用 `useMindView` 的「请求 → 消费」一次性信号：打开 / 新建 / 导入 / 切布局 / **一键生成**时 `requestFit()`，画布重排时 `consumeFit()`。

5. **内联编辑必须做三件事**：编辑框加 `nodrag` / `nowheel` 类（否则划选会拖节点、滚轮会缩放画布）+ 节点根元素在编辑态加 `nodrag` + `@keydown.stop`。另外 `deleteKeyCode` 已在 `<VueFlow>` 上置 `null`，删除完全由 `useMindShortcuts` 接管。

6. **Handle id 必须与边共用同一套常量**（`constants.HANDLE` + `edgeHandles(dir, side)`）。对不上时 vue-flow **不报错，那条边静默消失**。
   渲染矩阵：左右类 —— 根 = 两侧 `source`；右侧子节点 = 左 `target` + 右 `source`；左侧子节点 = 左 `source` + 右 `target`。`down` 类 —— 子节点 = 上 `target`（`t-in`）+ 下 `source`（`b-out`）。
   ⚠️ `edgeHandles()` 的签名是 `(dir, side)`：`down` 时忽略 `side` 直接返回上下 Handle；改签名时 `MindNode.vue` 与 `useMindGraph.ts` 必须一起改。
   ⚠️ `layout.ts` 在 `down` 模式下把 `sides` 统一填 `'right'`（该值无意义），避免下游拿到 `undefined`。

7. **Handle 视觉必须用 `!important` 压掉**：`flow.vue` 有一份**非 scoped** 的全局 `.vue-flow__handle { ... !important }`（灰色药丸），只要用户访问过「流程图」页，那份样式会一直挂在文档上，把思维导图的连线锚点染成可见灰块。`MindNode.vue` 用 `.mind-node__handle`（2 类选择器）+ `!important` 压回。同理 `.vue-flow__node.draggable { cursor: inherit }` 也会吃掉抓手光标，已在 `MindCanvas.vue` 非 scoped 块里以更高特异性覆盖。

8. **vue-flow 的 CSS 要在本模块自己引一遍**：`MindCanvas.vue` 的非 scoped 样式块 `@import '@vue-flow/core/dist/style.css'` + `theme-default.css`。思维导图页可能**先于**「流程图」页被访问，不能依赖 `flow.vue` 里的那份 import。

9. **`MindCanvas.vue` 的样式块必须非 scoped**：vue-flow 自己渲染的节点 / 边 / 背景网格都在它的内部 DOM，拿不到本组件 scoped 样式的作用域属性；用 `.mind-canvas` 前缀圈定范围即可（`--mm-*` 变量定义在这里，靠 DOM 继承对子组件与 SVG 都生效，边用 `stroke: var(--mm-line)` 跟随主题）。

10. **自定义节点插槽只透传 `id` / `data`**：不要 `v-bind="nodeProps"` 全量铺开，`position` / `events` 这类对象会作为属性落到根 div 上（`position="[object Object]"`）。

11. **`<VueFlow>` 上不要写不存在的 props**：vue-flow 1.48 没有 `selectionOnDrag`（正确的是 `selectNodesOnDrag`）；写错不会报错，只会作为普通属性挂到根 div。可用的 props 清单见 `node_modules/@vue-flow/core/dist/container/VueFlow/VueFlow.vue.d.ts`。

12. **主题只用 `--bg-* / --text-* / --border-* / --color-*` 令牌 + `color-mix()` 派生**，不写死颜色（26 套主题自动适配）。节点尺寸常量与 `MindNode.vue` 的 CSS 存在数值耦合（字号 / 内边距 / max-width），改一侧要同步另一侧。

13. **模块级单例 composable 的返回值必须绑定单例本体**：`useMindDoc()` 返回的 `doc` / `computed(...)` 全部直接返回。❌ 不能写 `ref(singleton.value.x)` —— 那是取值拷贝，会静默失效（本项目已踩过）。

14. **页面卸载不销毁状态**：`useMindDoc` 是模块级单例，路由切走再回来仍在现场；「启动恢复最近文档」用模块级 `bootstrapPromise` 做闸门，整个会话只恢复一次。
   ⚠️ 但 `MindCanvas` 是**新挂载**的，所以 `onMounted` 里**无条件**调一次 `graph.sync({ fit: true })` —— 早先「恢复成功就 return」的写法会让重进页面时画布停在旧坐标上。

15. **撤销重做的埋点只在 `commit()` 一处**：所有树操作都经过 `useMindDoc.commit()`，因此「撤销粒度」只定义一次，不会出现某个操作忘了入栈。例外只有 `setLayout()`（不走 commit 但同样记快照）。
    - 快照存**整份 `MindDocData`**（含 layout），所以切布局也能撤销；
    - **拖动节点不入栈**（坐标是派生数据）；
    - `replaceDoc` / `newDoc`（打开 / 新建 / 导入 / **一键生成**）**必须 `history.clear()`**，否则 Ctrl+Z 会撤进上一份文档；
    - `useMindHistory` **不 import `useMindDoc`**（避免循环依赖）：`record(prev)` / `undo(current)` / `redo(current)` 都由持有状态的一方传入；
    - `applyData()` 在恢复快照后会把失效的 `selectedId` 回落到根节点，否则之后按 Tab 会「什么都没发生」。

16. **搜索定位是「三件事 + 一个合并信号」**：顺序必须是「展开祖先 → 选中 → 请求画布居中」，不先展开的话画布上没有那个节点。
    为此 `MindCanvas` 把 `revision` 与 `focusToken` **拼成一个监听键**（`` `${revision}:${focusToken}` ``）—— 展开祖先改 `revision`、定位改 `focusToken`，发生在同一次点击里；拼成一个键，Vue 只触发一次回调，否则会跑两遍同步，其中一遍还可能抢在重排前定位到旧坐标。
    ⚠️ 若只监听 `revision`：「命中一个本来就可见的节点」不会改树 → 定位静默不生效。
    `centerOn()` 用 `setCenter(x+w/2, y+h/2, { zoom })`，缩放夹在 `[0.8, 1.4]` 而不是硬回 100%。

17. **色板必须单独放 `styles/palette.scss`**：`--mm-tone-*` / `--mm-branch-*` 原本定义在 `.mind-canvas` 上，但「节点属性」弹窗是 el-dialog、右键菜单是 `Teleport to="body"` 的浮层，**都拿不到 `.mind-canvas` 的自定义属性**，色块会全部变透明。抽成共用文件后，浮层里给内容根节点加 `.mind-palette-scope` 类即可；`MindNodeDialog.vue` / `MindColorRow.vue` 的 scoped 样式块里各 import 一次（作用域选择器正好落在各自的根节点上），依赖关系写在明面上。

18. **Markdown 导入刻意不做「标题 + 列表混排」解析**：文档里有 `#` 标题行就走标题模式（只认标题），否则走列表模式（缩进决定层级）。
    混排时某个列表项属于上一级还是同级全靠猜，猜错了比不解析更让人困惑。
    另外：折叠态 / 备注 / 分支色**都不参与 Markdown 交换**（表达不了），要完整往返请用 JSON。
    行首的 `-` / `*` / `+` 导出时转义成 `\-` 等、导入时反转义 —— 否则「以减号开头的文本」会被自己的解析器当成新的子节点。
    列表模式的层级单位取「最小的非零缩进」（`tab` 先折算 2 空格），所以 2 空格 / 4 空格 / tab 混用都能算对。

19. **`normalizeDocData` 对垃圾输入会静默回落成空白图**，所以 JSON 导入前必须先过 `exchange.looksLikeDocData()` 挡一道 —— 否则导入一个毫不相关的 JSON 会把当前导图悄悄清空。`parseExchangeJson` 读不出导图数据时返回 `undefined`，调用方据此报错。

20. **导入一律作为新文档载入**（`id` 置空 → 另存为新记录），不覆盖当前文档；当前有未保存改动时先 `ElMessageBox` 确认。导入只有「工具条一个按钮」这条路径（没有快捷键），所以确认策略就写在 `useMindTransfer` 里，不像「删除」那样需要在 `useMindActions` 再集中一次。

21. **读盘用 `<input type="file">` + FileReader，不用 `dialog.showOpenDialog`**：项目里 `QrDropZone` / `devToolbox` 都是这个模式，**零主进程改动**（不需要重启 Electron）。
    取消选择时 `change` 不会触发，所以 `pickFile` 用「窗口重新获得焦点 + 1.2s 延迟」兜底收尾 —— 延迟是留给 FileReader 的（小文件毫秒级，绝不会被兜底抢跑）。
    **`.xmind` 必须用 `readAsArrayBuffer`**（zip 二进制），其余格式走 `readAsText`。分流只按扩展名，认不出的当 Markdown 大纲试一次。

22. **工具条的横向滚动必须与浮层「分层」—— 滚动只能加在 `__scroll`，浮层只能放 `__tail`**（2026-10-01 支持窄窗口滚动时重构）。
    - 铁律：**`overflow` 祖先会裁掉一切绝对定位后代**（`overflow-x: auto` 还会把 `overflow-y` 一并算成 `auto`，两个方向都裁）。搜索面板 `.mind-search__panel` 就是 `position: absolute`，所以**只要它和滚动容器在同一棵子树里，就必然被裁** —— 没有 CSS 技巧能绕过（`elementFromPoint` 实测：放进滚动层后中心点命中不到面板，见「验证方式」D1）。
    - 因此结构改成：`.mind-toolbar = [ .mind-toolbar__scroll（可滚动，只装 button）+ .mind-toolbar__tail（不滚动，装搜索 + 帮助 + 未来任何浮层）]`。
    - 三组内容（`__doc` / `__layout` / `__actions`）必须都 `flex: none` —— 否则它们会被**压缩**而不是溢出，滚动条根本不出现（`__doc` 原来只写了 `min-width: 0`，会被挤扁）。
    - `__scroll` 需要 `flex: 1; min-width: 0`（可以缩小到内容以下才会溢出）；`justify-content: space-between` 在溢出时退化为 `flex-start`，是安全的（**危险的是 `center`**：两端都会被裁且滚不到）。
    - 滚动条用 `::-webkit-scrollbar { height: 6px }` 收窄（Windows 默认 ~15px 会明显撑高工具条）。副作用：**滚动条出现时工具条会高 6px、且 `__tail` 与按钮群有 3px 垂直错位**（`__tail` 没有那 6px gutter）—— 只在「已经窄到需要滚动」时发生，不修。
    - 教训推广：**判断「能不能加 overflow」不要看容器，要看它内部有没有绝对定位后代**。若将来必须在滚动区里放浮层，只有两条路：① 移到不滚动的兄弟节点（本方案）；② `position: fixed` + JS 按触发元素矩形算坐标 + teleport 到 body（`utils/popup.ts` 那条路，代价是写 JS 与监听 resize/scroll）。
    - ⚠️ 顺带纠正旧结论：导出下拉一直是 `el-dropdown`（默认 teleport 到 body），**它本来就不受工具条 `overflow` 影响**；旧注释把它和搜索面板混为一谈是错的。
    - **`overflow-x: auto` 不等于「滚轮能滚」**：它只让「横向滚动条 / 触控板横向手势 / Shift + 滚轮」生效；**普通鼠标的竖向滚轮对「只有横向溢出」的容器默认什么都不做**。工具条恰恰是这种容器（按钮一行排开），所以必须手写 `onWheel`（2026-10-01 追加）：
      - 监听挂在**工具条根节点**上（`@wheel="onWheel"`），不用挂 `__scroll` —— 这样鼠标停在右侧「搜索/帮助」那一小段固定尾部上也能滚，不会出现「挨着的两个区域行为不一致」。
      - 三条守卫，缺一不可：① `scrollWidth > clientWidth`（没溢出就一个字节都不碰）；② `event.clientY` 必须落在**工具条自身矩形**内 —— 搜索面板虽挂在 `__tail` 下，但浮在工具条**下方**（视觉上在盒外），且面板里的结果列表自己会竖向滚动，不挡就会「滚结果列表反而推动工具条」；③ `|deltaX| >= |deltaY|` 时交给原生（触控板横向手势）。
      - 到边（`next === scrollLeft`）时**不 `preventDefault`**，让事件继续冒泡；其余被接管的才 `preventDefault`。
      - `deltaMode` 要归一化：`1`（行）`× 16`、`2`（页）`× clientWidth`、默认按像素。（真机鼠标多为像素，但个别环境/驱动会给行。）
      - ⚠️ 写测试时注意：`onWheel` 是 **TS 源码**，抽出来直接注进浏览器会报 `Unexpected token ':'` —— 要先用项目自带 `typescript.transpileModule` 转成 JS（同 `references/tools` 的纯逻辑断言套路）。

23. **SVG 导出刻意不克隆画布 DOM**（不走 `html-to-image` / `foreignObject`）：
    布局坐标**本来就是 `utils/layout.ts` 自己算的**，画布只是把它渲染出来 —— 既然树与尺寸都在手上，直接生成 SVG 更短更可控。
    另外三条收益：① `<rect>` + `<text>` 是**真矢量**，Illustrator / Inkscape / Word 都能读，而 `foreignObject` 它们基本读不了；② 由数据生成可以导出**整张图**，不受当前视口裁切与缩放影响；③ **零新依赖**。
    PNG 复用同一份 SVG 经 `Image → canvas → toDataURL` 栅格化，不另写一套 canvas 绘制代码。
    ⚠️ 代价：文本用系统字体渲染（不内嵌 webfont），且折行靠 `measureText` 复刻 —— 与屏幕可能有极小差异。

24. **导出坐标取「画布实测值」而不是现算布局**：`useMindExport.buildSceneNodes()` 优先用 vue-flow store 里节点的 `position` / `dimensions`（即用户屏幕上看到的样子，**包括手动拖过的位置**），只有画布尚未同步（有节点缺失）时才回落到 `layoutTree()` 现算一遍，避免导出一坨叠在原点的方块。
    ⚠️ **不要用 `useMindGraph()` 拿节点**：它的 `nodes` / `edges` 是**每次调用新建的 ref**（不是模块级单例），在别处调 `useMindGraph()` 只会拿到空数组 —— 必须直接 `useVueFlow(MINDMAP_FLOW_ID).getNodes`（`ComputedRef<GraphNode[]>`，元素带 `position` / `dimensions` / `data`）。

25. **导出用的颜色必须归一化成 sRGB 字面量**：主题色走的是 `color-mix(in srgb, var(--color-primary) 16%, var(--bg-card))` 这种表达式，直接写进 SVG 只有 Chromium 认。`svgExport.resolveCssColor()` 借 canvas 的 `fillStyle` 当「颜色计算器」把它折算成 `#rrggbb` / `rgba(...)`，这样导出的文件**脱离宿主环境**也能正确显示。
    ⚠️ 顺带：自定义属性 `getComputedStyle().getPropertyValue()` 会做 `var()` 替换，但**不会**求值 `color-mix()` —— 必须再过一次 `resolveCssColor`。

26. **SVG 生成器里的坐标要用「节点的坐标 + 平移量」**：节点绘制在 `x + dx` / `y + dy`（`dx/dy` 由包围盒与 padding 推出），连线锚点也必须一起平移 —— 否则整张图的线会偏出 `(dx, dy)`，看着像「线没连上节点」。（这条是 P2 写测试时真踩到的 bug。）

27. **文本折行要自己实现**（`svgExport.wrapText`）：中文没有词边界，只能逐字断行；英文尽量退到最近一个空格处断。断行点正好落在空格上时会产生「行首空格」，必须显式 `replace(/^\s+/,'')` 摘掉，否则导出文本会比屏幕上多一个缩进。

28. **`utils/xml.ts` 的 `childElements` 刻意不用 `parent.children`**：它是 DOM4 属性，浏览器有、部分 XML 实现没有（如 `@xmldom/xmldom`）。走 `childNodes` + `nodeType === 1` 在哪儿都成立，也让这段逻辑能在 Node 里跑断言。
    同理 `findElements` 用 `getElementsByTagName('*')` 再按 `tagName.toLowerCase()` 过滤 —— XML 文档里 `getElementsByTagName` 是**大小写敏感**的，而这些格式（尤其 XMind）在不同版本里大小写并不统一。
    ⚠️ `DOMParser.parseFromString(..., 'application/xml')` 解析失败**不抛异常**，而是返回带 `<parsererror>` 的文档，所以 `parseXml` 必须显式检查。

29. **OPML / FreeMind 导入必须「读不出就返回 undefined」**：`normalizeDocData` 会把垃圾输入静默变成空白图，所以三者都用「缺 `<body>` / `<outline>` / `<map>` / `content.json` → `undefined`」的硬校验，调用方据此报错。
    OPML 允许多根（用 `<head><title>` 造合成根）、FreeMind 与 XMind 同理用兜底根；这与「一键生成」一律套合成根保持一致。

30. **XMind 只支持新版 `content.json`**（XMind Zen / 2020+，已与用户确认）：包内没有 `content.json` 时**明确报错**，而不是退化成空图。
    打包/解包走 **已在依赖里的 `jszip`**（原本还没被用过），**零新增依赖**。写入内容：`content.json`（sheet 数组）+ `metadata.json` + `manifest.json`。
    映射：`sheet.title` → 文档名、`topic.title` → 文本、`topic.children.attached` → 子节点、`topic.notes.plain.content` → 备注、`topic.branch === 'folded'` → 折叠。
    ⚠️ 刻意**不写** `POSITION` / `STYLE`：布局由我们的算法现场算，写进去下次打开反而对不上。

31. **FreeMind 的备注是 `<richcontent TYPE="NOTE">` 里的 HTML**：读的时候只取 `textContent`，并先把 `</p>` / `<br>` 换成换行再取 —— 直接 `textContent` 会把两段粘成一行。
    ⚠️ 片段往往**不是良构 XML**（如未自闭合的 `<img>`），`DOMParser` 会失败，所以 `plainFromHtml` 要有正则去标签的兜底路径。

32. **「一键生成导图」全部入口都在本模块内部**（`MindGenerateDialog.vue`），只对别的模块的表做**只读 `SELECT`** —— 待办 / 笔记 / 主题对话三个模块**一行都没改**，跨模块回归风险接近零。
    映射依据：待办 `todo_list.parentIds`（多父只取第一个有效父）、笔记 `note_book.mdText`（复用 `markdownToTree`）、主题 `conversation_theme.parent_id`。
    ⚠️ 环形 / 断链数据一律**降级为根节点**（`generate.linkByParent`）—— 树是唯一真源，造环会让整支子树从画布上消失，比少一层父关系糟糕得多。
    ⚠️ 节点 id 一律由 `createNode` 现场生成，**不沿用来源表主键**，避免「导图 id 与业务表 id 混为一谈」。
    ⚠️ `parseParentIds` 与 `views/todoList/api/todoApi.ts` 的读法**必须保持一致**（那边是权威），但刻意不 import 过来 —— 跨模块只走数据库，不走代码。
    ⚠️ 数据量兜底：笔记取最近 200 条、对话取 500 条，上限写在弹窗预览区里让用户看得见。

33. **共享 scss 片段必须用 `@use`，且写在样式块里所有规则之前**（本项目 `netRequest` / `highPerfSql` / `backup` 都是这个写法，本模块是最后的例外，已改齐）。
    - 原因：Sass 的 `@import` 已标记弃用、**Dart Sass 3.0 将移除**，引入 scss 时会打 `Deprecation Warning [import]`（`sass ^1.80.5` 开始）。
    - ⚠️ **`@use` 不能出现在其它规则之后，连 plain-CSS `@import` 也算**。`MindCanvas.vue` 的 `<style>` 块原本是「先 `@import '@vue-flow/core/dist/style.css'` + `theme-default.css`，再 `@import '../styles/palette.scss'`」⇒ 改成 `@use` 后**必须把 palette 前移到两条 css 引入之前**，否则 Sass 直接报 `@use rules must be written before any other rules.`。
    - 前移不改变层叠：palette 只声明 12 支 `--mm-tone-*` 与 6 支 `--mm-branch-*` 别名；两个 vue-flow 样式文件**既不声明也不消费任何 `--mm-*`**（已实测 grep 确认），无同名覆盖、无先后依赖。
    - ⚠️ **`.css` 的 `@import` 不用动**，也不会报弃用警告 —— Sass 对 `.css` 走 plain-CSS 路径、原样保留，交给 Vite 内联。
    - ⚠️ scoped 场景（`MindNodeDialog.vue`）迁移前后产物**逐字节一致**：`@use` 同样把模块 CSS 内联到该位置，Vue 的 scoped 变换照旧给它加 `[data-v-xxx]`，`@import` 与 `@use` 在这点上无差别。
    - ⚠️ 别用 `vite.config.ts` 的 `silenceDeprecations` 把 `import` 静音 —— 那是把真问题推到 Dart Sass 3.0（`legacy-js-api` 静音是另一回事，那个没有替代方案）。

34. **Handle 的「唯一真相」是 `constants.nodeHandles(isRoot, side, dir)`**（P3 修复，此前是隐性 bug）。
    - 症状：**每个非根节点的入线都挂在它的上边缘正中**，被贝塞尔曲线拉成一个大弧、从节点头顶绕过去；出线同理挂在下边缘正中。
    - 根因链（在 `node_modules/@vue-flow/core/dist/vue-flow-core.mjs` 逐行核对过）：边指定的 `targetHandle` id 在节点上不存在 → `getEdgeHandle()`（4293 行）写法是 `bounds.find(d => d.id === handleId) || null` ⇒ 得到 `null` → `getEdgePosition` 里 `targetPosition = targetHandle?.position || Position.Top`（8910 行），而 `getHandlePosition()`（4274 行）在 handle 为 `null` 时 x/y 归零 ⇒ 落点 = **节点顶部正中**（source 侧兜底成 `Position.Bottom` = 底部正中）。
      **全程不报错、不告警** —— 所以本模块早期注释写的「对不上时那条边静默消失」是**错的**，兜底比消失更难排查。
    - 具体写反的是 `MindNode.vue` 的 `showLeftTarget` / `showRightTarget`：两者都用了与语义相反的条件，导致左侧子节点只渲染 `l-in`、右侧子节点只渲染 `r-in`，而 `edgeHandles()` 要的恰好相反。
    - 修法：把「节点渲染哪些 Handle」抽成 `nodeHandles()`，`edgeHandles()` 与 `MindNode.vue` 共用它；并补了一条不变量断言 —— **所有 `(isRoot, side, dir)` 组合下，`edgeHandles()` 返回的两个 id 必须出现在对应节点的 `nodeHandles()` 里**，外加「非根节点的 source 与 target 必须在不同侧」。这类 bug 只有这条断言靠得住。
    - ⚠️ 记住这条最容易写反的规则：**左右类里「子节点的 target 在**父所在的那一侧**」** —— 右侧子节点的父在左边 ⇒ target 是 `l-in`；左侧子节点反之。

35. **「手动固定坐标」的语义边界**（P3 新增；用户拍板「拖拽后固定并持久化」）。
    - **只给被拖的那一个节点记 `pos`**，它的后代由布局**相对它**摆放 ⇒ 拖父节点时子树跟着走，而**兄弟与祖先完全不受影响**（三条都有断言）。
    - ⚠️ 由此推出两条必须遵守的推论：
      ① `useMindGraph.onNodeDragStop` 的**即时位移要跳过「自身已有 pos 的后代」** —— 否则它们先被推开、松手后又被重排拉回，表现成一次可见抖动；
      ② 坐标只在**松手时**写入，拖动中间态不入栈、不触发重排。
    - ⚠️ **拖动现在会进撤销栈**（`setNodePos` 走 `commit()`）：这**推翻了 P1 的旧约定**「拖动不进撤销栈」。那时坐标是派生数据、取消拖动本就不留痕迹；现在坐标会落库，把它排除在撤销之外反而不符合直觉。
    - ⚠️ **`normalizeDocData` 必须校验坐标**：`pos` 只接受 `{x, y}` 且两个都是 `Number.isFinite`，其余（null / 字符串 / 缺字段 / NaN / Infinity / 数组）一律丢弃 ⇒ 回落自动排版。**别用 `!pos` 这类假值判断 —— `{x:0,y:0}` 是合法坐标**（已写断言）。
    - ⚠️ `clearPositions()` 在「一个 pos 都没有」时必须**返回同一引用**，否则会塞给用户一步空的撤销记录。
    - 入口三处：工具条的 `LayoutGrid`「整理布局」（全局，带确认、`fixedPositionCount === 0` 时禁用）· 节点属性弹窗的「位置」药丸 + 「恢复自动」（只影响该节点）· `useMindDoc.setNodePos(id, undefined)`。
    - **已知取舍**：XMind / SVG 等导出仍**不写坐标**（XMind 刻意不写 `POSITION`），导入一律自动排版 —— 跨软件的位置语义对不上，宁可重排。

36. **右键菜单必须 `Teleport to="body"`，且只存视口坐标**（P4；关闭路径在坑 42 重写过一次）。
    - **不能把菜单画在节点里**：节点在 `.vue-flow__viewport` 内部，而 viewport 带 `transform: translate(...) scale(...)` —— 菜单会跟着画布一起缩放 / 平移，还会被 `.mind-canvas { overflow: hidden }` 裁掉（缩到 0.5 倍时菜单字都糊了）。
    - 因此 `openNodeMenu(id, clientX, clientY)` 存的是 **`clientX / clientY`**，菜单用 `position: fixed`。⚠️ **不要混用两套坐标**：存画布坐标就得在打开时反算一次 viewport 变换，而菜单本身又跟着视口走，早晚错位。
    - **打开 / 换位置都要重新定位**，所以 watcher 的键是 `` `${menuNodeId}@${menuX},${menuY}` `` —— 同一个节点**再右键一次**（比如往上挪一点）时 id 没变，只监听 id 会让菜单停在旧位置。
    - **越界要「翻转」而不是「夹进视口」**：菜单高 ~400px，若按 `innerHeight - height` 去夹 y，窗口下半部分右键时菜单左上角会被拽到光标上方几百像素、整个盖住刚右键的节点。翻转规则见坑 43（**基准是节点矩形，不是光标**）；只有菜单比视口还大才退化成夹边界。量尺寸必须**渲染之后**（高度取决于有没有子节点、是不是根节点）⇒ 先按光标渲染一帧再 `nextTick` 后量。
    - 几何已抽到 `utils/popup.ts` 的 `placePopup()`（纯算术、33 条断言覆盖），组件只负责「量真实尺寸 → 调它 → 写 style」。
    - `place()` 末尾有一次**实测自检**：拿 `getBoundingClientRect()` 与期望落点比对，差超过 1px 就按实测差值（除以实测缩放比）拉回 —— 防「祖先带 transform / 系统缩放让 fixed 改基准」这类运行时才暴露的偏移，正常情况零开销。⚠️ **必须 `await nextTick()` 之后再量**，否则读到上一帧（坑 43）。
    - 关闭路径：**window 捕获阶段 `pointerdown` 判「点在面板外」**（替代全屏遮罩，见坑 42）+ 面板外 `wheel` + `Esc`（捕获阶段）+ `resize` / window `blur` + 节点消失（`watch(node)`）+ **组件 `onUnmounted` 时清 `menuNodeId`**（否则路由切走再回来会「凭空弹出一个菜单」）。

37. **菜单项的动作 id 必须在「关菜单」之前取出来**（P4 真踩到的静默 bug）。
    `run()` 的顺序是「**取 id → 关菜单 → 执行**」：`view.closeNodeMenu()` 会把 `menuNodeId` 清空，所以 `MenuItem.run` 的签名是 `(id: string) => void`、由 `run()` 把 id 传进去。
    ❌ 如果让菜单项在闭包里读 `view.menuNodeId.value`，读到的是**空串** ⇒ 「新增子节点 / 复制 / 重命名 / 折叠」全部静默失效（不报错、不提示）。
    - 唯一例外是**颜色点选**：它刻意**不关菜单**（设完背景往往还想调文字色，每点一次都关掉极难用），所以那三个 handler 直接读 `menuNodeId` 是安全的。
    - 删除项**不复用 id**：走 `actions.deleteSelected()`（读 `selectedId`），与工具条按钮 / `Delete` 快捷键同一条路径 ⇒ 确认策略只有一份。

38. **右键要先 `select`，编辑态要放行原生右键**（P4）。
    - `MindNode.vue` 的处理 **不能挂 `.prevent` 修饰符** —— 那会无条件 `preventDefault`，连「内联编辑时想复制自己刚敲的字」都做不到。改成在函数里先判 `isEditing` 再 `preventDefault()`。
    - 顺序必须是「**先 `mind.select(id)` → 再开菜单**」：菜单里的删除 / 重命名读的是 `selectedId`，不先选中就会出现「右键 A、删掉的是 B」这类最说不清的 bug。
    - 还要 `stopPropagation()`：`<VueFlow>` 根上挂了 `@contextmenu.prevent`（在画布范围内屏蔽浏览器原生菜单），不拦住的话画布处理也会收到这一次右键。
    - 菜单项**按节点状态置灰**而不是「点了再弹提示」：根节点没有同级（`addSibling` 对根会**退化成加子节点**，两种语义混在一个按钮里更让人困惑）⇒ `新增同级` / `删除` 对根置灰；`折叠` 在无子节点时置灰。

39. **`cloneSubtree()` 必须丢掉 `pos`**（「复制节点」）。
    - 坐标是派生数据，副本应该交回布局算法重新摆。若把坐标一起抄过来，副本会**严丝合缝地盖在原件上**（坐标逐个相同），看起来就像「右键没反应」。
    - 保留：文本 / 折叠态 / 备注 / 三类颜色；**每个节点都换新 id**（递归）。
    - ⚠️ 副本的折叠态是**照抄**的：复制一个折叠节点，得到的也是一个折叠节点（与原件并排、外观一致，符合直觉）；让副本可见靠的是 `insertSibling` 顺手展开**容纳它的父级**（不是被复制的那个节点）。
    - 对**根节点**复制 = 把整棵树复制一份挂到根下（根没有同级）—— 与 `insertSibling(root, root.id, x)` 的既有退化行为一致。

40. **色板是「一族主名 + 一族别名」**（P4）。
    - 主名 `--mm-tone-{key}`（实色）与 `--mm-tone-{key}-soft`（低透铺底，= 实色 22% 混 `--bg-card`）；`--mm-branch-{key}` 保留为**实色的别名**。改别名而不是改消费方，避免一次改名动到五个文件（也保证导出侧读旧名照样拿得到值）。
    - ⚠️ `-soft` 变量引用的是**同一元素上**先声明的 `--mm-tone-*` —— 自定义属性的引用在**计算值阶段**解析，不依赖声明顺序，但**不能**把这些声明拆到别的选择器里。
    - ⚠️ **`MindColorRow.vue` 的根节点自带 `.mind-palette-scope`** 并在样式里 `@use` 一次 palette：scoped 后选择器是 `.mind-palette-scope[data-v-xxx]`，正好落在它自己的根上 ⇒ 色板就地生效，**不依赖**父级（弹窗 / 菜单）有没有引来色板。浮层是 teleport 到 body 的，「自带变量」比「靠父级挂载顺序」可靠。
    - `variant` 决定色块画什么：`branch` 画实色 / `bg` 画**低透铺底色**（画成实色会让人误以为节点会变成那样重）/ `text` 画实色。背景色色块**必须**画低透色，否则预览与真实效果不一致。

41. **导出必须同时解析 `tone` 与 `toneSoft`**（P4）。
    - `SvgTheme` 增 `tone: Record<MindColorKey, string>` 与 `toneSoft: Record<MindColorKey, string>`；`SvgExportNode` 增 `bg` / `fg`。
    - 节点填充改为 `node.bg ? theme.toneSoft[node.bg] : (按层级取 rootBg / l1Bg / nodeBg)`，文字色改为 `node.fg ? theme.tone[node.fg] : theme.nodeText` —— 与 `MindNode.vue` 的 fallback 链**一一对应**（否则屏幕上有色、导出后没色）。
    - ⚠️ 低透铺底色是 `color-mix()` 算出来的，**必须**过 `resolveCssColor()` 折算成 sRGB（见坑 25），否则脱离宿主打开会变成透明。
    - ⚠️ `bg` / `fg` **直接读树节点**（`item.node.bgColor` / `.textColor`）而不是走 flow data：它们没有「继承」，从树里取更稳（画布尚未同步、flow 缺节点时照样拿得到）。`branch` 仍走 flow data，因为它要在 `useMindGraph.collectBranches` 里做继承计算。

42. **右键菜单的关闭**不能用「全屏遮罩 + 遮罩上 `@contextmenu` 关菜单」**（P4 实测真 bug：「右键菜单偏移太远」的元凶）。
    - **现象**：菜单开着时再右键另一个节点，菜单被钉在**窗口左上角**（截图实测 `pos ≈ (6,6)`，而光标在画布另一头）。
    - **链路**：遮罩盖住全屏 ⇒ 第二次右键的 `contextmenu` 先落到遮罩上 ⇒ 遮罩的处理是立刻把自己 `v-if` 掉 ⇒ **事件派发到一半目标元素被移除**，Chromium 重新命中测试、给底下的节点**补发一个 `clientX/Y = 0` 的 contextmenu** ⇒ 节点拿着 `(0,0)` 开菜单 ⇒ `place()` 的 clamp 把它钉到 `EDGE_GAP` 角上。静态看代码完全看不出来（`clientX` 语义、`position: fixed`、clamp 全都「正确」），只有实机复现才抓得到。
    - **修复**：拆掉遮罩，改 **window 捕获阶段 `pointerdown` 判「点在面板外」**（面板内不关）—— 全程不改 DOM，菜单先关、随后的 contextmenu 正常落到节点上、带真实光标坐标重新打开。副产品：**「开着菜单换一个节点右键」一步到位**（旧方案只会把菜单关掉，得再右键一次）。
    - **双保险**：`MindNode.anchorOf()` 对**没有坐标的 contextmenu**（键盘 Menu 键 / Shift+F10、以及任何被重发的合成事件，`clientX/Y` 均为 0）退回到**节点卡片自身的 rect**（卡片右缘偏下），保证这类事件也把菜单开在节点旁边而不是左上角。

43. **翻转的基准是「节点矩形」，不是光标；且自检必须等下一帧再量**（P4 第二次修「右键菜单偏移太远」）。
    - **现象（用户报）**：节点在**右下角**右键 ⇒ 菜单「直接到顶部」；节点在**右侧边缘**右键 ⇒ 菜单「偏移左侧好远」。
    - **链路（实测复现，不是推理）**：`place()` 写完新坐标后**立刻**读 `getBoundingClientRect()` —— 而 Vue 的 DOM 更新排在下一次微任务里，此刻 `style.left/top` 还是**上一帧（光标处）**的值。于是 `dx/dy` 正好等于这一次的翻转位移，自检把它当成「fixed 基准偏了」又**再翻一次** ⇒ 菜单被推到光标外侧**两个菜单宽 / 高**处（右下角 ⇒ 纵向多退 400px，直接飞出视口顶部 / 被 clamp 钉到 y=6）。**静态看每步都「正确」**，`clientX` 语义、`position: fixed`、clamp 全都没问题。
      最小复现（`C:\src\tmp\mm_rect_timing.cjs`，项目自带 puppeteer + `vue.global.js`）：赋新值后立刻量 ⇒ `dx=248, dy=400`；`await nextTick()` 后再量 ⇒ `dx=0, dy=0`。
    - **修复①**：自检前补一次 `await nextTick()`；再加 `placeSeq` 并发保护（快速换节点右键时只让最后一次 `place()` 写坐标）。
    - **修复②（用户要的「常规优化」）**：翻转的基准改成**节点矩形** `menuAnchor`（`MindNode.vue` 右键时顺手量好，随 `openNodeMenu(id, x, y, anchor)` 传上来）：
      `右放不下 ⇒ 浮层右缘 = 节点左缘 - 4`（向左展开）；`下放不下 ⇒ 浮层下缘 = 节点上缘 - 4`（**向上展开，即「以该节点为底部定位点」**）。光标落在节点里的哪个角落是随机的，拿它当基准会让同一个节点在不同角落右键差出大半个菜单的高度。
      ⇒ 不变式（84 个节点位置 × 2 个光标点的网格断言）：**菜单与节点的水平 / 垂直间隙恒 ≤ 4px，且菜单始终完整落在视口内**。
    - **修复③**：定位完成前挂 `visibility: hidden`（**不能用 `display: none`**，那会把 `offsetWidth/Height` 量成 0）⇒ 消灭「先在光标处闪一下再跳走」。
    - ⚠️ 由此推论：**凡「写完响应式样式 → 立刻读 DOM 几何」的自检，都读的是上一帧**。要么 `await nextTick()`，要么读 `offsetWidth/Height` 这种不依赖本次写入的量。
    - ⚠️ 由此推论：**凡是「浮层 + 全屏遮罩 + 遮罩上关浮层」的组合，只要浮层打开期间用户还会再触发同一种指针事件，都有同样的重发风险** —— 优先用「捕获阶段监听 + 点外即关」，而不是改 DOM 的遮罩。

44. **`Shift` + 拖拽框选与 vue-flow 的 `panOnDrag` 抢同一个手势**（P9）。
    - 拖拽平移的监听在 vue-flow 内部的 pane 上（`.mind-canvas` 的**后代**）。只在外层容器的**捕获阶段** `pointerdown` 里 `preventDefault() + stopPropagation()` 才拦得住 —— 捕获阶段先于目标元素的监听执行，vue-flow 与节点都收不到这次事件，因此既不平移也不拖动。
    - **不按 `Shift` 时一个字节都不碰**（连 `preventDefault` 都不做），保证既有交互零变化。
    - 3px 死区：手抖不该把一次「`Shift` + 单击」变成 0 面积框选（那会清空选中）。没拖出距离就按「`Shift` + 单击」处理：命中节点则选中它、否则清空。
    - 自绘选框（不用 vue-flow 内建 selection）的三条理由：① 与 `panOnDrag` 抢手势；② 内建选中态会与自管的 `selectedIds` 形成**两个真源**；③ 内建 selection 对自定义节点的表现不可控。选框组件必须 `pointer-events: none`，否则拖到刚画出来的框上就断了。
45. **框选矩形是「容器内像素」，命中判定是「画布坐标」—— 两套坐标绝不能混用**（延伸坑 36）。
    - 画框用 `clientX - 容器 rect.left`（纯像素，直接喂 style）；命中则必须把**两个对角点**都过 `graph.toFlowPoint()`（= `screenToFlowCoordinate`）换算再取包围盒 —— **不要**自己「减平移、除缩放」，那是 vue-flow 的内部规则，手写一份迟早漂移。
    - `useMindGraph` 因此对外暴露了 `visibleRects()`（**必须走 `getNodes` store**：只有 `GraphNode` 带 `dimensions`）与 `toFlowPoint()`。
46. **MiniMap 自研，且 `viewport` 必须用 store 的 ref**（P10 对原方案的刻意偏离）。
    - `@vue-flow/core@1.48` 的 `dist/components/MiniMap` 有实现但**没从 `index.d.ts` 导出**，要用官方子包 `@vue-flow/minimap`；本模块坚持零新依赖，而「树 + 布局 → 矩形」的能力本来就有（`utils/layout.ts`），画缩略图只差等比缩小 ⇒ 自研约 200 行。
    - ⚠️ 视口要用 `const { viewport } = useVueFlow(id)` 的 **ref**，**不要用 `getViewport()`** —— 后者是一次性快照、不参与响应式，平移画布时视口框不会跟着动。
    - 内容包围盒 = **节点盒 ∪ 视口盒**：只按节点算的话，把画布平移到远处（视野里没节点）时视口框会跑出缩略图，用户看着「小方框凭空消失」。
    - 位置：右下角 `bottom: 66px` —— 与缩放条（`bottom: 12px`）**纵向错开**，比去覆盖另一个组件 scoped 样式里的 `bottom` 稳得多。
47. **换父（P7）：命中用中心点、排除自身 + 全部后代 + 根；一次变换一次 commit**。
    - 用被拖节点的**中心点**做包含测试（不是左上角）：半挂在别的节点上时中心点最能代表「放到哪儿了」，左上角会让大节点偏得离谱。
    - 排除三类的理由：自身、**自身全部后代**（`collectSubtreeIds` —— 光比 id 挡不住「挂到自己的孙子下」，这是防环的唯一可靠手段）、根（根不能被换父）。命中多个时取**层级最浅**的那个（`visibleRects()` 是先序，取第一个即可）。
    - `reparent()` 必须**一次变换**（`utils/tree.ts`）⇒ 一步撤销；写成「先删再插」两次 commit 的话，用户按一次 Ctrl+Z 只回来一半。
    - 换父**清掉被拖节点的 `pos`**（交回布局算法），并让目标折叠时先展开；两条路径（换父 / 记坐标）**互斥**，否则「结构变了」与「位置钉死了」两笔账对不上。
48. **跨窗口传「要打开哪份导图」（P13）：只能走主进程 store，且消费点必须在唯一的载入闸门里**。
    - 命令面板跑在**独立小窗**（`commandPalette/index.vue`），与主窗口**不共享 JS 运行时** ⇒ 在小窗里写 `useMindView.requestOpen` 主窗口根本看不见。链路：小窗 `setStore(OPEN_DOC_STORE_KEY, id)`（`get-store`/`set-store` 是现成通道，两窗读写同一份）→ `navigate('mindmap')`（既有 `palette-navigate`）→ 导图页挂载时 `getStore` 取回。
    - 读取函数全程 `globalThis.window?.ipcRenderer?.sendSync?.` + `try/catch`：`useMindView` 会被**纯逻辑单测**在 Node 里 require，那里没有 `window`，不能让它抛错。
    - ⚠️ 消费点在 **`useMindActions.bootstrap()`** 而不是 `index.vue`：`bootstrap` 是唯一的载入闸门（模块级 OncePromise）。若在 `index.vue` 里单独 `openDoc()`，两次 `applyRecord` 会并发跑、谁后到谁赢 ⇒ 表现成「有时打开指定文档、有时跳回最近文档」。
    - 一次性语义：`consumeOpen()` 取完即清（ref 与 store 两边都清），连开两次不重入；非法值（非数字 / 0 / 负数）返回 `undefined` ⇒ 回落到最近文档 / 空白图。
49. **图标与链接的提交走 `@change`，不是每次按键**（P11）。
    - 每一次成功写入都是一步撤销（`commit`），逐字符提交会把撤销栈刷满 —— 用户按 Ctrl+Z 会变成「一个个字符地退」。
    - 链接只放行 `http` / `https`（`new URL` 白名单）：节点文本可以来自导入的 JSON / Markdown，放行 `javascript:` / `data:` 等于「点一下徽标就执行他人写入的脚本」。徽标按钮上**再校验一次**（它是把字符串交给浏览器执行的出口）。
    - 清除是「**值为 `undefined`**」而不是删键（与 `setNodeNote` 一致）—— 关键是 `JSON.stringify` 会丢弃 `undefined`，所以落库 JSON 里干净。断言要测「序列化后不含该键」，别测 `'x' in node`。
    - 图标宽度要计入 `measure.ts` 的估算（`NODE_ICON_WIDTH`），否则首帧估算与实测差 24px，会看到节点重排时抖一下。
50. **大纲（P6）与画布共用一棵树，但行内改名必须用独立的 `outlineEditingId`**。
    - 复用 `useMindDoc.editingId` 会让**画布上的同一个节点也渲染内联编辑器** ⇒ 两个输入框抢同一份草稿。大纲用自己的 `<input>`（提交走 `renameNode`），状态也必须自己的。
    - 行列表用 `flattenVisible()` 拍平（与 `useMindGraph.buildElements` **同一个函数**）⇒ 大纲里看不到的行画布上也一定看不到，可见性语义天然一致，不会两处实现漂移。
    - 面板开合后画布宽度变了：`index.vue` 在 `watch(outlineOpen)` 里 `await nextTick()` 再 `canvasRef.fit()` —— **只 fit 不重排**（节点坐标与画布多宽无关，重排纯浪费还会把手工摆过的节点重摆一遍）。`nextTick` 不可省（坑 43：写完响应式样式立刻量 = 量到上一帧）。
51. **鱼骨图的连线必须是直线，且这个判断只能有一份**（P12）。
    - `constants.isStraightEdge(dir)` **同源驱动**画布的 `edge.type`（`useMindGraph`）与 SVG 导出（`svgExport.curvePath`）⇒ 不会出现「屏幕上是斜线、导出变成弧线」。贝塞尔会把「骨」画弯，一眼就不像鱼骨。
52. **导出前必须 `exitFocus()`**（P5-3）。
    - 分支聚焦只是视图状态（`useMindView.focusRootId`，不落库、不进撤销栈），但 `buildElements` 会把它当渲染根 ⇒ 若直接导出，界面看着是「当前这张图」，导出的却只有那棵子树。`useMindExport.prepareFullScene()` 在 `exportSvg` / `exportPng` 前先退出聚焦。
53. **「全部折叠 / 展开」的判据必须排除根节点，否则恒为 true ⇒ 只能折叠、永远展不开**（2026-10-01 修复）。
    - 原实现 `hasExpandedBranch(node)` 从根开始判 `!node.collapsed && node.children.length`。而**根永远不会被折叠**（`setAllCollapsed` 对根有 `isRoot` 特判，折叠根会让整图只剩一个点）**且通常必然有子节点** ⇒ 根这一层就直接 `return true`，`toggleFoldAll()` 永远走「折叠」分支，**永远到不了「展开」**。用户看到的现象正是「只有折叠全部、没有展开全部」。
    - 修法：判据进入非根才算数（`isRoot` 参数 + 递归传 `false`），并拆成两个**响应式**、**互斥**的判据驱动工具条：`hasExpanded`（存在「可折叠且当前展开」的节点 → 显示「折叠全部」）与 `hasFolded`（存在折叠态节点 → 显示「展开全部」），两者不会同时为真。
    - 工具条用 `v-if / v-else-if / v-else` 三态：折叠全部 / 展开全部 / **禁用占位**（扁平树，例如刚新建 —— `createDocData` 造的根是 `children: []`，此时两个动作都无意义，落个 grey 按钮保持槽位不抖动，与撤销/删除等按钮「置灰而非消失」的既有惯例一致）。
    - `toggleFoldAll()`（快捷键 `Ctrl + A`）也顺带收了口：两个判据都为假时**返回 false 不 commit** —— 否则 `setAllCollapsed` 每次都会重建对象（引用必变），会给撤销栈塞进一条「看起来没变化」的空历史。

54. **字体 / 字号落「文档级」，字号是「基准 + 增量」模型；且 `updateNodeInternals()` 不是字号重排的承重件**（2026-10-01 新增画布右上角设置面板）。
    - **为什么是文档级**：`fontFamily` / `fontSize` 进 `MindDocData`（**可选**字段），因为它们属于**内容版式** —— 同一份图在别人机器上要长得一样、导出的 JSON / SVG 也得带走 ⇒ 不能放只服务本机的全局设置 / localStorage（对比 MiniMap 开关：那是「这台机器上我喜欢怎么看」，所以它走 localStorage）。两个键都可选 ⇒ 老数据**零迁移**；`normalizeDocData` **只在合法时才保留**，绝不凭空补键（补键会让老文档平白变脏）。
    - **规范化只有一份**：`utils/tree.ts` 的 `normalizeFontFamily` / `normalizeFontSize`，UI 写入与反序列化**共用**。`font-family` 的 `initial` / `inherit` / `''` / 非字符串一律折成「**不覆盖**」（跟随应用字体）—— 尤其 `initial` 会渲染成**衬线体**（UA 默认），与「继承应用字体」不是一回事，字体下拉里也**刻意不展示**它。
    - **字号 = 基准 + 层级增量**：`constants.fontSizeOf(level, base)`（根 `+2`、一级 `+0.5`、其余 `+0`），不是三档写死值。好处：UI 只暴露**一个**滑杆，而 `DEFAULT_FONT_SIZE = 13` 时与旧的 15 / 13.5 / 13 **逐像素一致**（零迁移）；测量估算 `estimateSize` 与导出 `buildMindSvg` 都改成按 `base` 等比缩放（`lineHeight × base / 13`）。
    - **写入**走 `useMindDoc.setFontFamily` / `setFontSize` → `commitData()`（**可撤销**、`revision + 1` ⇒ 画布 `watch` 自动重排并重新量尺寸）；清空 = 传 `undefined` ⇒ **删键**。
    - ⚠️ 滑杆**只在 `change`（松手）时写文档**，拖动过程中只改草稿与预览 —— 否则从 13 拖到 20 会在撤销栈里塞进十几个中间步，Ctrl+Z 要按十几次。
    - ⚠️ 字体列表**复用设置页那一套**（`get-fonts` IPC + `globalFontOpsC` 预设），**零新增主进程通道**；面板用 `el-popover`（teleport 到 body）而非自绘绝对定位块 —— 画布容器 `overflow: hidden`，贴边面板会被裁（同坑 22）。
    - ⭐ **实测纠错（推翻了写代码时的假设）**：原以为「第二段重排里的 `updateNodeInternals()` 是承重的 —— 抽掉它，改字号后 `waitForMeasured()` 会在第一个 rAF tick 拿到**陈旧尺寸**、整图按旧尺寸排一次」。**用真库证伪**（`C:\src\tmp\mm_fontsync_test.cjs`：真 Vue + 真 vue-flow + 真 ResizeObserver）：改字号后，**松序**与**紧序**（改 ref 与同步落在同一次 flush，贴近生产）两种时序下，探测点读到的 store 尺寸**都是新值**。根因 —— 「改字号」必然触发节点组件重渲染 ⇒ DOM 尺寸随之变化 ⇒ **vue-flow 自带的 ResizeObserver 在同一帧内就把 store 刷成了新值**（既不是 `waitForMeasured()` 做的，也不是那行 `updateNodeInternals()` 做的）。
      - 结论订正：`updateNodeInternals()` 在这里是**便宜的显式保险**，不是字号路径的承重件 —— 它用 `offsetWidth/offsetHeight`（`forceUpdate: true`）**同步**重读一遍 DOM，专兜「节点 DOM 尺寸变了、却没走 Vue 重渲染」的将来场景（例如日后加「改内边距 / 改最大宽度」，直接改类名或行内样式）。**删掉它当前任何功能都不会出错**；留着它是对那类改动的一层保护。`useMindGraph.sync()` 与 `types.ts` 的注释已按此改写。
      - 方法论：**「去掉某行会不会坏」不能靠读代码下结论** —— `waitForMeasured()` 的判据只是「**有没有**尺寸」，这句话读起来确实像「改字号会读旧值」，但真库跑一遍就发现库自己的 RO 已经兜住了。这类时序问题一律用真库真渲染的最小复现来判（同坑 43）。

## 验证方式（沙箱内可跑）
纯逻辑层不依赖 Vue，可直接在 Node 里跑断言：用 `typescript.transpileModule` + 自定义 `require` 扩展直载真实 TS 源码
（`require.extensions['.ts']` + `module._compile`，并把 `@/` 别名映射到 `src/`）。
需要 DOM 的部分（OPML / FreeMind / 旧备注解析）用 `@xmldom/xmldom` 提供 `DOMParser` —— 它**装在 workbuddy 的 node 隔离工作区，没有进项目依赖**。

⚠️ **断言要写「期望行为」，不要照抄实现再断言它自己**。2026-10-01 的折叠 bug 就是靠这条抓出来的：测试里如果复用当前 `hasExpandedBranch` 的实现（含根）去断言它，会「全绿但 bug 依旧」；正因为断言写的是「已全折叠时应为 false」这一**期望**，才立刻暴露「判据恒为 true」。凡新增断言，落笔前先问一句「我断的是需求，还是我自己的代码」。

覆盖：
- P0/P1：Handle 约定 / 树操作 / `expandTo` / 备注与分支色 / 反序列化兜底 / 四种布局方向 / Markdown 往返与四种边界 / 交换文件解析（84 条）
- P2：`wrapText` 五种情形 / SVG 结构（画布尺寸、矩形数、文本数、连线几何、折叠钮、备注浮标、向下布局连线坐标）/ 三源生成（多父、断链、自环、环形、跳过空笔记、对话开关、备注落位）/ OPML 与 FreeMind 往返 / XMind 打包解包往返与三种失败输入（72 条）
- P3：**Handle 不变量**（4 布局 × 2 侧 × 根/非根 / nodeHandles 结构 / 不同侧约束 / id 合法性 / 无重复）/ 布局的 `pos` 行为（基线手算值 / 固定节点采用 pos / 子树跟随 / 兄弟与祖先不受影响 / 换布局仍固定 / down）/ `setNodePos`·`clearPositions`·`countFixedPositions` 的 immutable 与「无改动返回同引用」/ `normalizeDocData` 保留合法 pos（含 `{0,0}`）与丢弃 8 种脏 pos / JSON 往返（79 条）
- **P4**：色板函数（`MIND_COLORS` 的 6 个 key、`toneVar` / `toneSoftVar` / `branchVar` 的变量名、旧名 `BRANCH_COLORS` 已不存在）/ `setNodeBg`·`setNodeTextColor` 的写入·清除·同值短路·三者互不干扰 / `normalizeDocData` 保留合法 `bgColor`·`textColor` 并丢弃非法值（含数字型）+ 老数据零迁移 + 往返不丢色 / `cloneSubtree` 的「换新 id、保留六类语义字段、丢掉 pos、不动原件」/ 复制后的插入位置（原节点之后、对根退化为挂到根下、父级折叠会被展开、副本保留自身折叠态）（30 条）
- **P4 补（浮层定位）**：`placePopup` 的四种方向（不翻 / 只翻 x / 只翻 y / 双翻）+ 无锚点退化 + 翻转后仍越界的 clamp + 视口比菜单还小的 `max < min` 退化 + `clampInto` 五种边界 + **84 个节点位置 × 2 个光标点的网格不变式**（菜单始终完整落在视口内、与节点的两个方向间隙恒 ≤ `ANCHOR_GAP`）+ 与旧算法在右下角场景的落点对比（33 条，`C:\src\tmp\mm_popup_test.cjs`）
- **P5–P13（2026-10-01，`C:\src\tmp\mm_ext_test.cjs`，112 条）**：
  - `utils/geometry.ts`：`rectsIntersect`（相交面积 > 0；**贴边不算**；零宽/零高退化不算）/ `rectsIntersecting`（保序、只留相交）/ `pointInRect`（闭区间四角）/ `nearestRectId`（命中即距离 0、否则按最近边缘、`exclude` 生效、空集 ⇒ `undefined`）
  - 图标 / 链接归一化：单 emoji / 2 码点国旗 / **ZWJ 组合 emoji 按 `Array.from` 计码点（5 > 4 丢弃）** / 超 4 码点丢弃 / 纯空白清除 / 同值同引用；`https`·`http` 放行，`javascript:`·`data:`·`ftp:`·`file:`·相对地址丢弃，trim、超长截到 `MAX_LINK_LEN`；**清除后「序列化不含该键」**
  - 批量删除：祖先与后代同选 ⇒ 只按祖先删一次（结果等价于单删祖先）/ 空选择 / 只选根 / 全悬空 ⇒ 同引用 / 根与真实节点混选 ⇒ 跳过根
  - 批量折叠：有子节点的被折叠、叶子与根不参与、已折叠再折叠 ⇒ 同引用、批量展开回落 `undefined`
  - 换父：挂到新父下 + 旧父摘除 / **拖到自己后代 ⇒ 同引用（防环）** / 拖到自己 ⇒ 同引用 / 根不可换父 / 目标或自身不存在 ⇒ 同引用 / **清 pos** / 目标折叠 ⇒ 展开 / 同父末位 ⇒ 同引用 / 同父非末位 ⇒ 挪到末位 / **整棵子树一起走 + 节点总数守恒**
  - `treeToTodos`：7 节点 ⇒ 7 条、先序顺序、key 互不相同且来自注入生成器、**`parentIds` 指向本次新 key（绝不沿用导图 id）**、根任务 `parentIds: '[]'`、tags/priority/时间戳/`sortOrder` 默认值、备注 → 描述（trim）、**空文本节点被跳过但其后代挂到它的父上（不吞子树）**、`max` 截断到先序前 N、只有空文本 ⇒ 0 条
  - `useMindView` 待打开信号：`requestOpen` 同时写 ref 与 store / 一次性消费（连开两次不重入）/ **ref 为空时从 store 取回（跨窗口路径）** / store 里的数字形态也能读 / 非数字·空串·0·负数 ⇒ `undefined` / `requestOpen` 对非法 id 不写任何东西；另断言桥接键名 `mindmap:open-doc` 稳定
- **折叠/展开全部互斥（2026-10-01，`C:\src\tmp\mm_foldall_test.cjs`，32 条）**：
  - `setAllCollapsed(true)`：根不被折叠 / 所有「非根且有子节点」的节点 `collapsed=true` / 叶子不带 `collapsed`（不上脏字段）/ 节点总数与根子节点数守恒；`setAllCollapsed(false)`：整树无 `collapsed=true`
  - `hasCollapsible`：根有子 ⇒ true、只有根 ⇒ false
  - **互斥判据**：展开态 `hasExpandedBranch=true`（显示折叠全部）/ 折叠态 `=false`（显示展开全部）/ 两判据不会同时为真 / 可折叠集合不含根
  - **回归（核心）**：修复前的实现（含根）在「已全折叠」的树上**仍误判为 true**（R1），修复后为 false（R2）；扁平树两判据都为 false（R3/R4）；四种树形态的互斥不变式（R5）
  - 往返稳定：展开→折叠、折叠→展开 都回到预期态
- **工具条横向滚动 + 浮层不被裁（2026-10-01，`C:\src\tmp\mm_toolbar_scroll_test.cjs`，6 条，puppeteer 真实 Chromium 跑）**：
  复刻工具条的 `__scroll` / `__tail` 结构与 CSS（含 `.mindmap-page` 的 `overflow: hidden`、浮层的 `position: absolute`），实测：
  - **A1** 宽窗口 1600px：`__scroll` 无横向溢出（`scrollWidth <= clientWidth`，不出滚动条）
  - **B1–B3** 窄窗口 620px：`scrollWidth > clientWidth`（确实溢出）· `scrollLeft` 可推进 · 能滚到最右（`scrollLeft === scrollWidth - clientWidth`，末尾按钮可达）
  - **B4** 滚到最右后，最后一个操作按钮的矩形**完整落在可视区内**（左/右边界都不越界）
  - **C1–C2** 尾部（`__tail`）里的浮层：有实际尺寸（320×120，未被压成 0）· **中心点 `elementFromPoint` 命中面板内部**（未被 overflow 裁掉）
  - **D1（反例对照，本组最有价值的一条）**：同一浮层结构放进 `__scroll` 内 ⇒ **中心点命中不到面板** ⇒ 从运行时证明「浮层必须放滚动区之外」，坑 22 的结论由此实锤
- **工具条「鼠标竖向滚轮 → 横向滚动」（2026-10-01，`C:\src\tmp\mm_toolbar_wheel_test.cjs`，16 条，puppeteer）**：
  做法是把 `MindToolbar.vue` 里的 **`onWheel` / `wheelStep` 真实源码按大括号配平抽出来**、用项目自带 TS 转成 JS 后注入复刻页面执行（测的是真源码，不是重写的一份；顺便断言抽出的文本含 `preventDefault()`）。
  - **W1 / W1b** 窄窗口竖向滚轮 ⇒ `scrollLeft` 前进 `deltaY` 且已 `preventDefault`
  - **W8** 向上滚 ⇒ 后退 `|deltaY|`
  - **W2 / W2b** 未溢出（宽 1700）⇒ `scrollLeft` 不变、**不** `preventDefault`（事件照常冒泡）
  - **W3 / W3b** 指针在工具条矩形**之外**（浮层面板上）⇒ 不接管、不 `preventDefault`
  - **W4 / W4b** 纯横向手势（`|deltaX| > |deltaY|`）⇒ 不接管、不 `preventDefault`
  - **W5 / W5b** 已滚到最右再往下滚 ⇒ `scrollLeft` 不变、不 `preventDefault`（到边不吞事件）
  - **W6** `deltaMode=1`（行）⇒ 步长 `deltaY × 16`
  - **W7** `deltaMode=2`（页）⇒ 步长 `deltaY × clientWidth`（经 `min(max,…)` 钳制）
  - **W0 / W0b** 前置事实：窄窗口确实溢出 · 浮层面板位于工具条矩形之外（否则 W3 不成立）
- **字体 / 字号（文档级版式）（2026-10-01，`C:\src\tmp\mm_font_test.cjs`，94 条，纯逻辑）**：
  - **C** `constants`：`clampFontSize` 边界（10 / 24 / 非有限值回落 13）/ `fontSizeOf(level, base)` 三档（根 `+2`、一级 `+0.5`、其余 `+0`）/ **`fontSizeOf(level, 13)` 与旧的写死 15 / 13.5 / 13 逐值一致（零迁移）** / `FONT_SIZE_RANGE` 与 `FONT_INHERIT_VALUE` 形状
  - **N** `normalizeDocData`：保留合法 `fontFamily` / `fontSize`；丢弃 `''`·`'inherit'`·`'initial'`·非字符串（超长截断）/ 非有限字号；**老数据（无这两个键）零迁移 —— 序列化后不含键**
  - **D** `useMindDoc` 写入口：`setFontFamily` / `setFontSize` 写入 ⇒ `revision+1` + 脏标记；**同值短路（返回 false、不进撤销栈）**；传 `undefined` ⇒ 删键；`setLayout` 改走 `commitData` 后行为不变；撤销能回退字体 / 字号
  - **E** `estimateSize`：省略 `baseFontSize` 时与旧行为**像素等价**（13 时一致）；按 `base / 13` 等比缩放高度；根 / 一级的层级增量仍在
  - **S** `svgExport`：`buildMindSvg({ fontSize })` 的节点 `font-size` 走 `fontSizeOf(level, base)`；缺省回落默认
  - **X** `exchange`：导入导出（JSON）往返**保留** `fontFamily` / `fontSize`；无这两个键的旧文件往返后仍无键
- **字体时序（真 vue-flow）（2026-10-01，`C:\src\tmp\mm_fontsync_test.cjs`，10 条，puppeteer 真库真渲染）**：
  真 Vue + 真 `@vue-flow/core`（IIFE）+ 真 `style.css` + 真 ResizeObserver，复刻 `sync()` 的两段时序（把 `updateNodeInternals` 抽成对照开关）：
  - **E1/E2** 估算公式 vs 真实 `offsetHeight`：默认字号与 22px 下偏差都 ≤ 2px（估算随字号缩放未跑偏）
  - **N0/N4** 前置：改字号确实改变 DOM 宽度（135 → 208）；复位后回到 135
  - **N1/N2/N1b/N3**（核心，**纠错**）：抽掉 `updateNodeInternals()` 后第二段**仍是新尺寸**（208），保留时亦然；探测点（`waitForMeasured` 判定「量好」那一刻）读到的**已是新尺寸**；两组 `waitForMeasured` 都返回 true。⇒ **原始假设「那一行是承重件」被真库证伪**，根因是 vue-flow 自带的 ResizeObserver 在同帧刷了 store（详见坑 54）
  - **N5/N6** 紧序（改 ref 与同步落在同一次 flush，**贴近生产**）下，无 / 有 `updateNodeInternals` 也都是新尺寸

**合计 568 条断言全通过**（84 + 72 + 79 + 30 + 33 + **112** + **32** + **6** + **16** + **94** + **10**）。

组件层三重扫描（`references/tools/check-renderer.cjs`，Node + `@vue/compiler-sfc`）：
```
node .workbuddy/skills/jianli-app/references/tools/check-renderer.cjs src/views/mindmap
```
① `parse` + `compileScript` + `compileTemplate` 结构校验（2026-10-01：mindmap **19 个 .vue** 通过；命令面板改动面 6 个 .vue 亦通过）；
② 相对 import 与 `@/` 别名是否能解析到真实文件，含 `styles/palette.scss`（2026-10-01：mindmap 扫到 **45 个文件**，相对 import 全命中；命令面板 21 个文件全命中）；
③ **`<LucideIcon name="...">` 与 `icon: 'X'` 用到的名字是否都在 `LucideIcon.vue` 的 nameMap 里登记**（漏登记会静默 fallback 成 CloudAlert，肉眼极难发现；2026-10-01：mindmap 用到 **34** 个名字、命令面板 **15** 个，全部已登记，nameMap 共 292 项）。
   ⚠️ `MindNodeMenu.vue` 把图标名写在 `icon: 'Plus'` 这样的对象字面量里，**正是第 ③ 项要覆盖的形态** —— 别只用 `<LucideIcon name="X">` 的正则去扫，会漏掉它们。新增的 `Scissors` / `ClipboardPaste` / `ListTree` / `Map` 就是这么扫出来的。
   ⚠️ 该脚本**只吃目录**（`readdirSync`），传单个 `.vue` 文件路径会 `ENOTDIR`。

类型校验：`vue-tsc --noEmit -p tsconfig.json`（全项目零报错；本机约 48s，超 30s 一律丢后台跑）。

⚠️ **本模块有两类改动无法在沙箱内自动化验证，必须本地 `npm run dev` 人工过一遍**：
   - 浮层的**关闭**路径（点外关闭、Esc、滚轮、窗口 resize/blur）—— 全是 DOM 事件，纯逻辑断言覆盖不到；**且「事件派发中途移除元素 → Chromium 重发零坐标事件」这类坑只有实机才复现得出**（坑 42）。
     （**定位几何**已经抽成 `utils/popup.ts` 并有 33 条断言；「写完响应式样式立刻读 rect 读到上一帧」这类 DOM 时序坑，可用项目自带的 puppeteer + `node_modules/vue/dist/vue.global.js` 起一张本地静态页做最小复现 —— 见坑 43，别靠读代码下结论。）
   - 颜色在 26 套主题下的实际观感（尤其「背景色 + 文字色同色系」的低对比、以及浅色主题下低透铺底是否够淡）。

样式块校验（改 `<style>` 时用，尤其是 Sass 语法迁移）：`@vue/compiler-sfc` 的 `parse` 取出真实 `<style>` 块 → `compileStyleAsync`（`scoped` 按块给、`id: 'data-v-test'`、`preprocessOptions.logger` 收集警告）⇒ 断言「零 error + 零 deprecation 警告 + 目标规则已内联且 scoped 后缀正确」。**这样能在不启动 Electron 的前提下证明「迁移前后产物等价」**（比较 `code` 按空白归一后的字符串即可）。sass 侧的纯语法问题（如 `@use` 位置约束）用 `sass.compileString(..., { url, loadPaths })` 更快 —— ⚠️ 此时**必须给 `url` 并用相对说明符**，绝对路径 `C:/...` 会被 Sass 当成 URL scheme 而解析失败。

## P5–P13 与原方案的偏离（写下来免得以后被「改回去」）
1. **P10 MiniMap 自研，不装 `@vue-flow/minimap`**。原清单里这是**唯一被批准的新依赖**，但实际动手时发现：本模块已有「树 + 布局 → 矩形」的能力，且自研能直接读画布实测坐标与当前视口（子包反而要额外对齐主题变量），代价只有约 200 行。**结果是全程真正零新依赖**（见坑 46）。
2. **P13 不做「二级面板」**。命令面板的契约是「关键词 → 命中项 → 回车执行」（`CommandSource.search`），没有抽屉 / 下钻这一层；为它单独扩一套 UI 状态机不划算。改成 `mindmapSource.ts` 把每份导图**直接作为一条可搜索结果**（搜导图名 → 回车打开），达成同一个目的。
3. **P13 的跨窗口路径没走「小窗置灰」降级**。清单原建议「小窗用不了就在小窗里置灰」，但命令面板**只跑在小窗里**，置灰等于整个功能作废。改用现成的 `get-store` / `set-store`（主进程 store 两窗共享）做桥接 —— 依然**零主进程改动**（见坑 48）。
4. **剪贴板是模块级内存剪贴板**（不碰系统剪贴板）。导图节点不是文本，写进系统剪贴板只有坏处（用户在别处 Ctrl+V 会粘出一段莫名其妙的节点文本）；快照**每次粘贴都重新 `cloneSubtree`** ⇒ 可连贴多次且副本 id 互不相交；模块级单例 ⇒ **跨文档粘贴天然可用**（在 A 图复制、切到 B 图粘贴）。

## 未做（后续候选）
- 节点边框色 / 边框粗细 / 节点形状（当前「分支色」独占描边，背景 / 文字色只覆盖填充与字色）
- 节点**附件**（图标与超链接已在 P11 完成）
- 节点级「挂到笔记」的反向联动（「挂到待办」已在 P8 完成，是单向一次性导出，不同步回写）
- XMind 旧版 `content.xml` 兼容
- 导出时带上手动坐标（XMind 的 `POSITION` / SVG；当前刻意不写，导入一律自动排版）
- 大纲里的拖拽排序 / 换父（已由「拖到目标节点上松手」在画布上解决）与虚拟滚动（数百节点量级用不上）
- 双端同步（需先确认移动端是否要做思维导图）
- **明确不做**：节点外框 / 概要（C2）
