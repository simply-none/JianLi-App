# 思维导图 (mindmap)

## 职责
基于已有 `@vue-flow/core` 自研的**思维导图**：树形结构编辑 + 自研树布局（左右 / 右向 / 左向 / 向下四种方向）+ 折叠展开 + 内联改名 + 撤销重做 + 节点备注与分支色 + 搜索定位 + JSON / Markdown 导入导出 + 多文档保存。
**P2 增补**：SVG / PNG 图像导出 + OPML / FreeMind / XMind 互转 + 从「待办 / 笔记 / 主题对话」一键生成导图。
**P3 增补**：连线锚点修正（`nodeHandles()` 单点真相）+ **拖拽固定节点坐标并持久化**（`node.pos`，可撤销、可「整理布局」一键还原）。
与「流程图」(flow) 共用 vue-flow 渲染层，但**数据模型、布局算法、store 全部独立**。

## 关键文件
目录：`src/views/mindmap/`（严格按「纯逻辑 / 状态 / 视图」三层拆分，单文件职责单一；P3 后共 34 个 .ts/.vue + 1 个 .scss）

| 层 | 文件 | 职责 |
|---|---|---|
| 类型 | `types.ts` | 纯类型；语义结构 + **唯一位置字段 `MindNode.pos`（可选，仅手动拖过的节点有）** |
| 常量 | `constants.ts` | 尺寸 / 间距 / Handle id / **`nodeHandles()` 与 `edgeHandles()`** / 分支色板 / 布局选项 / 快捷键文案 |
| 样式 | `styles/palette.scss` | 分支色板 `--mm-branch-*`（非 scoped，**画布与节点属性弹窗共用**） |
| 纯逻辑 | `utils/tree.ts` | immutable 树操作（增删改折叠 / 备注 / 分支色 / **pos 读写与清空** / 展开到节点 / 平铺 / 导航 / 反序列化兜底） |
| 纯逻辑 | `utils/measure.ts` | 首帧尺寸估算（中文 1em、半角 0.55em） |
| 纯逻辑 | `utils/layout.ts` | 自研树布局算法（水平类 / 垂直类两趟递归，O(n)；**`pos` 优先于算法结果**） |
| 纯逻辑 | `utils/markdown.ts` | Markdown 大纲互转（导出缩进列表；导入吃标题或列表） |
| 纯逻辑 | `utils/exchange.ts` | JSON 交换文件包封 / 解析 / **全部导出文件名**（json/md/svg/png/opml/mm/xmind） |
| 纯逻辑 | `utils/xml.ts` | XML 转义 + `DOMParser` 解析 + 子元素遍历（OPML / FreeMind / XMind 共用） |
| 纯逻辑 | `utils/opml.ts` | OPML 互转（`<outline text>` / `_note`） |
| 纯逻辑 | `utils/freemind.ts` | FreeMind `.mm` 互转（`<node TEXT>` / `FOLDED` / `richcontent`） |
| 纯逻辑 | `utils/xmind.ts` | XMind `.xmind` 互转（zip + `content.json`，走**已在依赖里的** `jszip`） |
| 纯逻辑 | `utils/svgExport.ts` | **由树 + 布局结果直接生成独立 SVG**（换行、几何、主题色归一化） |
| 纯逻辑 | `utils/generate.ts` | 待办 / 笔记 / 主题对话 → 树（**只读**映射） |
| 状态 | `composables/useMindDoc.ts` | 模块级单例文档状态 + **全部树操作唯一写入口 `commit`** |
| 状态 | `composables/useMindHistory.ts` | 撤销 / 重做快照栈（上限 80，模块级单例） |
| 状态 | `composables/useMindView.ts` | 一次性视图信号：`requestFit/consumeFit`、`requestFocus/consumeFocus`、`nodePanelId` |
| 状态 | `composables/useMindPersist.ts` | newSql 三件套薄封装（list/load/save/remove） |
| 状态 | `composables/useMindActions.ts` | 动作编排：状态 + 持久化 + 提示/确认策略 |
| 状态 | `composables/useMindTransfer.ts` | 导入导出编排（7 种格式；导出菜单 `EXPORT_ITEMS` 也在这里定义） |
| 状态 | `composables/useMindExport.ts` | SVG / PNG 导出（**同一份 SVG 两种产物**；PNG 经 `Image → canvas`） |
| 状态 | `composables/useMindSearch.ts` | 节点搜索（`searchNodes` 纯函数 + 单例 open/query/hits/activeIndex） |
| 状态 | `composables/useMindShortcuts.ts` | 键盘 → 意图映射（IME 安全） |
| 画布 | `composables/useMindGraph.ts` | 树 ⇄ vue-flow 元素编译 + 两段式布局 + 分支色继承 + 拖动整棵子树（**松手时把坐标写进树**）+ `centerOn` |
| 视图 | `components/MindCanvas.vue` | **唯一持有 `<VueFlow>` 的地方**；定义 `--mm-*` 主题变量 |
| 视图 | `components/MindNode.vue` | 自定义节点（Handle 由 **`nodeHandles()` 派生**、折叠钮、选中环、分支色条、备注浮标） |
| 视图 | `components/MindNodeEditor.vue` | 内联文本编辑（原子，不碰树） |
| 视图 | `components/MindNodeDialog.vue` | 节点属性弹窗（备注 + 分支色 + **位置状态与「恢复自动」**） |
| 视图 | `components/MindGenerateDialog.vue` | 「从待办 / 笔记 / 主题对话生成导图」弹窗（只读查询 + 预览节点数） |
| 视图 | `components/MindSearchBox.vue` | 搜索按钮 + 下拉结果面板（自己接管 ↑↓/Enter/Esc） |
| 视图 | `components/MindZoomBar.vue` | 右下角悬浮缩放条（自取 vue-flow 视口助手） |
| 视图 | `components/MindToolbar.vue` | 顶部工具条（文档 / 布局 + **整理布局** / 撤销 / 导入 + 导出下拉 / 生成 / 节点 / 搜索帮助） |
| 视图 | `components/MindDocDialog.vue` | 文档管理弹窗（打开 / 删除 / 新建） |
| 视图 | `components/MindHelpDialog.vue` | 快捷键速查（按 `SHORTCUT_GROUPS` 分组渲染） |
| 页面 | `index.vue` | 装配层：拼装 + 弹窗开关 + 挂载快捷键 |

关联主进程：**无独立 module**，数据走 newSql 三件套；导入导出走既有 `export-text-to-cache` / `export-buffer-to-cache`（**P0/P1/P2 全程零主进程改动，不需要重启 Electron**）。

## 数据模型（核心决策）
```
表 mindmap：id INTEGER 自增 PK | name TEXT | type TEXT('mindmap') | data TEXT(树 JSON) | create_time TEXT | update_time TEXT
data = { version: 1, layout: 'both'|'right'|'left'|'down', root: MindNode }
MindNode = { id: string, text: string, collapsed?: boolean, note?: string, color?: BranchColor,
             pos?: { x: number, y: number }, children: MindNode[] }   // pos = 手动固定坐标（可选）
BranchColor = 'blue'|'teal'|'green'|'amber'|'coral'|'purple'   // 只存 key，不存色号
```
- **树是唯一真源，坐标默认是派生**：结构操作会重新布局，坐标默认不落库 ⇒ 将来换布局（鱼骨图 / 组织结构图 / 径向）历史数据零迁移。
  **唯一例外 = `MindNode.pos`**（P3 起）：只有**用户手动拖过**的节点才有这个字段，布局算法遇到它就采用该坐标，并让它的子节点**相对它**摆放。
  这样「加节点 / 折叠 / 换布局」不会把手工摆过的位置冲掉，也不会让自动排版被一堆散落的旧坐标绑住；
  老数据没有该字段 ⇒ **零迁移**；「整理布局」（`tree.clearPositions`）一键全部还原。
- **不用 dagre**：项目里的 `@dagrejs/dagre` 是**有向图分层**，`rankdir` 只能单向推进，做不出「根居中 + 子树左右分叉 + 各节点尺寸不一」，所以 `utils/layout.ts` 自研。
- 所有树操作 **immutable + 结构共享**，因此可用 `next === prev` 判断「无改动」并短路。
- **分支色只存 key**：颜色由 `styles/palette.scss` 用主题令牌 + `color-mix()` 派生，26 套主题自动适配；节点与连线同色。子树默认继承父级（`useMindGraph.collectBranches` 一次遍历）。
- **备注不参与布局**：节点上只有一个绝对定位的浮标，备注正文收在弹窗里 —— 否则长文本会把节点撑到 264px 上限外。
- 独立性：**不复用 `flow` 表** —— `flow.vue:213` 读取时只 `limit 1 + orderBy id desc`、**没有 type 过滤**，共用表会双向串数据。

## 路由 / 菜单
- `RouteNames.MINDMAP` → `/思维导图`（`src/router/index.ts`，紧邻 `/流程图`）
- 菜单：`src/constants/menu.ts` 的「效率工具」组，位于 `categorizableNotes` 与 `themeConversation` 之间
- 图标：`iconMap.mindmap = 'Network'`；`LucideIcon.vue` 的 **import 与 nameMap 两处**都已登记 `Network` / `Redo2` / P2 的 `Database`（生成入口）/ P3 的 `LayoutGrid`（整理布局）与 `Pin`·`Move`（节点属性里的位置状态）（漏一处会静默 fallback 成 CloudAlert）
- 导出中心：`electron/main/module/backup.ts` 的 `EXPORT_GROUPS` 已加 `{ key:'mindmap', label:'思维导图', tables:['mindmap'] }`
- **命令面板**：`commandPalette/sources/actionSource.ts` 有 `action:new-mindmap`；`paletteConfig.ts` 的 `PREFERRED_ROUTES` 把 `mindmap` 放在第 4 位（空关键词的默认推荐会展示）
- **未接入**局域网同步白名单（`syncModule.ts` / `src/store/useSync.ts` 都没动）—— 思维导图不参与双端同步

## 用到的 IPC 通道
- `new-sql:query`（列表 / 按 id 读取；`limit/orderBy/orderByDesc` 放顶层，`conditions` 只放等值过滤）
- `new-sql:upsert`（保存；带 `id` 命中 ON CONFLICT 走更新，不带则插入，主键 `id`）
- `new-sql:delete`（删除；`condition: { id }`）
- `export-text-to-cache`（导出 JSON / Markdown / OPML / FreeMind / **SVG**，`sendSync` + `fileNotify`）
- `export-buffer-to-cache`（导出 **PNG / XMind**，base64 二进制）
- `new-sql:query` **只读** `todo_list` / `note_book` / `conversation_theme` / `conversation`（「一键生成导图」用，`SqlStr` 直查，**一个字段都不写回**）
- ❌ 未用 `new-sql:execute`；未新增任何主进程通道

## 快捷键（`constants.SHORTCUT_HINTS` 与 `useMindShortcuts` 必须保持一致）
| 分组 | 按键 | 行为 |
|---|---|---|
| 节点 | `Tab` | 为选中节点添加子节点（无选中则以根为父） |
| 节点 | `Enter` | 添加同级节点（根节点退化为添加子节点） |
| 节点 | `F2` / 双击 | 重命名（进入内联编辑） |
| 节点 | `Delete` / `Backspace` | 删除选中节点及其子树（**有子节点时二次确认**） |
| 节点 | `Space` | 折叠 / 展开选中节点 |
| 节点 | `↑` / `↓` | 在**可见**兄弟节点间移动选中 |
| 节点 | `←` / `→` | 跳父节点 / 第一个子节点 |
| 文档 | `Ctrl/Cmd + S` | 保存 |
| 文档 | `Ctrl/Cmd + Z` | 撤销 |
| 文档 | `Ctrl/Cmd + Shift + Z`、`Ctrl + Y` | 重做 |
| 视图 | `Ctrl/Cmd + F` | 打开 / 关闭节点搜索 |
| 视图 | `Ctrl/Cmd + 0` | 适应画布 |
| 视图 | `Ctrl/Cmd + A` | 折叠全部 / 再按展开全部（切换语义） |

## 导出 / 导入格式一览
| 格式 | 方向 | 出口 | 说明 |
|---|---|---|---|
| JSON `.mindmap.json` | 双向 | `exportTextToCache` | 完整往返（含备注 / 分支色 / 布局 / 折叠） |
| Markdown `.md` | 双向 | `exportTextToCache` | 只含层级与文本 |
| OPML `.opml` | 双向 | `exportTextToCache` | 含 `_note` 备注 |
| FreeMind `.mm` | 双向 | `exportTextToCache` | 含 `FOLDED` 折叠与 `richcontent` 备注 |
| XMind `.xmind` | 双向 | `exportBufferToCache` | zip + `content.json`（**只支持新版**） |
| SVG `.svg` | 只导出 | `exportTextToCache` | 真矢量，可在 AI / Inkscape 继续编辑 |
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

17. **分支色板必须单独放 `styles/palette.scss`**：`--mm-branch-*` 原本定义在 `.mind-canvas` 上，但「节点属性」弹窗是 el-dialog，内容被 teleport 到 body 下，**拿不到 `.mind-canvas` 的自定义属性**，色块会全部变透明。抽成共用文件后，弹窗里给内容根节点加 `.mind-palette-scope` 类即可；`MindNodeDialog.vue` 的 scoped 样式块里也 import 了一次（作用域选择器正好落在它的根节点上），依赖关系写在明面上。

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

22. **工具条容器不能加 `overflow`**：搜索面板是绝对定位在工具条内部的，一旦给容器加 `overflow-x: auto`，下拉面板会被裁掉。窄窗口下宁可让按钮组略微溢出。
    ⚠️ 导出改成 `el-dropdown` 后同理 —— 下拉浮层是 teleport 到 body 的，但仍然**不能**给工具条加 `overflow`，否则触发按钮会被裁。

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
    - 前移不改变层叠：palette 只声明 `--mm-branch-*` 六支；两个 vue-flow 样式文件**既不声明也不消费任何 `--mm-*`**（已实测 grep 确认），无同名覆盖、无先后依赖。
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

## 验证方式（沙箱内可跑）
纯逻辑层不依赖 Vue，可直接在 Node 里跑断言：用 `typescript.transpileModule` + 自定义 `require` 扩展直载真实 TS 源码
（`require.extensions['.ts']` + `module._compile`，并把 `@/` 别名映射到 `src/`）。
需要 DOM 的部分（OPML / FreeMind / 旧备注解析）用 `@xmldom/xmldom` 提供 `DOMParser` —— 它**装在 workbuddy 的 node 隔离工作区，没有进项目依赖**。

覆盖：
- P0/P1：Handle 约定 / 树操作 / `expandTo` / 备注与分支色 / 反序列化兜底 / 四种布局方向 / Markdown 往返与四种边界 / 交换文件解析（84 条）
- P2：`wrapText` 五种情形 / SVG 结构（画布尺寸、矩形数、文本数、连线几何、折叠钮、备注浮标、向下布局连线坐标）/ 三源生成（多父、断链、自环、环形、跳过空笔记、对话开关、备注落位）/ OPML 与 FreeMind 往返 / XMind 打包解包往返与三种失败输入（72 条）
- P3：**Handle 不变量**（4 布局 × 2 侧 × 根/非根 / nodeHandles 结构 / 不同侧约束 / id 合法性 / 无重复）/ 布局的 `pos` 行为（基线手算值 / 固定节点采用 pos / 子树跟随 / 兄弟与祖先不受影响 / 换布局仍固定 / down）/ `setNodePos`·`clearPositions`·`countFixedPositions` 的 immutable 与「无改动返回同引用」/ `normalizeDocData` 保留合法 pos（含 `{0,0}`）与丢弃 8 种脏 pos / JSON 往返（79 条）

**合计 235 条断言全通过**（84 + 72 + 79）。

组件层三重扫描（`references/tools/check-renderer.cjs`，Node + `@vue/compiler-sfc`）：
① `parse` + `compileScript` + `compileTemplate` 结构校验；
② 相对 import 与 `@/` 别名是否能解析到真实文件（含 `styles/palette.scss`）；
③ **`<LucideIcon name="...">` 用到的名字是否都在 `LucideIcon.vue` 的 nameMap 里登记**（漏登记会静默 fallback 成 CloudAlert，肉眼极难发现）。

类型校验：`vue-tsc --noEmit -p tsconfig.json`（全项目零报错）。

样式块校验（改 `<style>` 时用，尤其是 Sass 语法迁移）：`@vue/compiler-sfc` 的 `parse` 取出真实 `<style>` 块 → `compileStyleAsync`（`scoped` 按块给、`id: 'data-v-test'`、`preprocessOptions.logger` 收集警告）⇒ 断言「零 error + 零 deprecation 警告 + 目标规则已内联且 scoped 后缀正确」。**这样能在不启动 Electron 的前提下证明「迁移前后产物等价」**（比较 `code` 按空白归一后的字符串即可）。sass 侧的纯语法问题（如 `@use` 位置约束）用 `sass.compileString(..., { url, loadPaths })` 更快 —— ⚠️ 此时**必须给 `url` 并用相对说明符**，绝对路径 `C:/...` 会被 Sass 当成 URL scheme 而解析失败。

## 未做（后续候选）
- 命令面板直接打开某份导图（需要跨窗口通知主窗口载入指定 id —— 属跨窗口 IPC）
- 节点图标 / 超链接 / 附件
- 节点级「挂到待办 / 笔记」的反向联动（当前是单向：别的模块 → 导图）
- XMind 旧版 `content.xml` 兼容
- 导出时带上手动坐标（XMind 的 `POSITION` / SVG；当前刻意不写，导入一律自动排版）
- 双击空白处新建节点、框选多选（当前选中是单选）
- 双端同步（需先确认移动端是否要做思维导图）
