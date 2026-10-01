# 可归类笔记 (categorizableNotes)

## 职责
带标签/分类的笔记管理，**三栏主从布局**（标签导航 + 笔记列表 + 内联详情/编辑），支持搜索、标签筛选、无限滚动分页。数据表 `note_book`，被命令面板 `noteSource` 索引，是「命令面板可搜索笔记」的本体来源。

> 2026-10-01 UI/交互重构：卡片网格 + 详情弹窗 → 三栏主从布局，编辑一律在右栏内联完成（不再弹窗）。

## 关键文件
```
src/views/categorizableNotes/
├── index.vue                      # 三栏布局容器 + 状态编排（筛选/选中/保存/删除守卫）
├── composables/
│   └── useNotes.ts                # 数据层（唯一数据出口，纯逻辑可断言）
└── components/
    ├── TagSidebar.vue             # 左栏：全部笔记 + 标签导航（计数/hover 删除/废弃分组折叠/内联新建标签）
    ├── NoteListPanel.vue          # 中列：搜索（300ms 防抖）+ 行式列表 + 无限滚动 + 双空态
    ├── NoteDetailPanel.vue        # 右栏：查看态（标题/时间/标签/只读正文）与编辑态（标签选择+富文本）内联切换
    └── TagSelector.vue            # 标签选择器（多选/搜索/下拉内创建/软删），走 useNotes 数据层
```
- 关联主进程：**无独立 module**；数据走 newSql 三件套（payload `tableName:'note_book'`，顶层 `SqlStr` 传原生 SQL）
- 命令面板侧读取见 `src/views/commandPalette/sources/noteSource.ts`（同表 `note_book`）

## 路由
- `RouteNames.CATEGORIZABLE_NOTES` → `/categorizableNotes`
- 无小窗（`windowSections` 无 categorizable 条目）

## 用到的 IPC 通道
- `new-sql:query`：列表分页（`useNotes.ts` 的 `buildListSql` 拼装，关键词单引号转义；**标签条件整体加括号**，否则「关键词 AND tags-a OR tags-b」因优先级漏筛）；标签计数 `SELECT tags FROM note_book`（仅 tags 列，客户端聚合）
- `new-sql:upsert`（`useNotes.ts` 的 `upsertNote`，`config:{primaryKey:'key'}`）
- `new-sql:delete`（`useNotes.ts` 的 `deleteNote`，按 `key` 等值条件）
- 标签存取：store `'note_tags'`（`getStore`/`setStoreAsync`，非 SQL 表）

## 数据契约（重构未动，字段结构不变）
- 表 `note_book`：key / excerpt / content / html / mdText / tags(JSON字符串) / createTime / updateTime
- 标题由 `noteContent.ts` 的 `noteTitle`（正文首行）派生，**无独立标题字段**；老笔记正文在 `mdText`、新笔记在 `content`(HTML)，展示/摘要统一走 `notePlainText`
- 标签项：`{ key, name, color, deleted?, createTime, updateTime }`；删除是软删（`deleted:true`），笔记上已引用的标签数据保留

## 交互约定（重构后）
- **编辑不弹窗**：点击列表行 → 右栏查看态；「编辑」按钮 / 行 hover 铅笔 → 右栏原位编辑；「新建笔记」→ 右栏直接进编辑态
- **脏数据守卫**：编辑态有未保存修改时，切换笔记/新建/取消一律先确认「放弃修改」（`NoteDetailPanel.isDirty` expose 给父级 `guardDirty`）
- 快捷键（编辑态，`NoteDetailPanel` 窗口级 keydown）：`Ctrl/Cmd+S` 保存、`Esc` 取消（同样过脏确认）
- 查看态标签 chip 可点击 → 直接按该标签筛选（再次点击取消）
- 删除标签从三处入口（侧栏 hover / 选择器选项 hover）都走软删确认；已删标签在侧栏「废弃标签」折叠组里仍可筛选
- 搜索防抖 300ms 服务端 LIKE（mdText/content/html/excerpt 四列）；分页 PAGE_SIZE=20，滚动近底部 100px 触发 load-more

## 复用 / 集成点
- **命令面板 REGISTRY**：`useCommandSources.ts:13` 的 `noteSource` 索引本模块 `note_book` 表，命中后跳 `/categorizableNotes`。新增笔记字段后请同步 `noteSource` 的预览/搜索列。
- 不接小窗四件套、VirtualList、AppDialog（旧版弹窗组件已删除）。
- 暗色判定复用全局 `utils/themeMode.ts` 的 `useThemeMode()`（不再手维护暗色主题名单）。

## 特有坑 / 注意
- **已迁移 newSql 数据层**（2026-08-30），重构后数据出口收敛到 `composables/useNotes.ts`（含 IPC 参数契约），UI 组件不直接发 IPC。
- `RichTextEditor` 的只读用 `:editable="false"`（Quill enable 带响应式 watch）；查看态 `:toolbar="false"` 隐藏工具栏；外部内容注入靠其内部 `watch(modelValue) + dangerouslyPasteHTML`，父子各一个实例按 mode v-if 切换即可。
- `ElScrollbar` 无限滚动：判断 `scrollbarRef.wrapRef` 的 scrollTop/scrollHeight/clientHeight；ref 必须显式标类型 `InstanceType<typeof ElScrollbar>`，否则 vue-tsc 下是 `never`。
- 首屏列表不满一屏时滚不到底，不会触发 load-more（同旧版行为）；PAGE_SIZE=20 缓解。
- 与 notebook 模块数据不通（不同表/不同入口），命令面板只覆盖本模块。

## 沙箱自证脚本（可复跑）
- `scripts/check-categorizable-notes.cjs`：SFC 编译 + 图标登记扫描 + 主题红线扫描
- `scripts/assert-categorizable-notes.cjs`：数据层真实 TS 源码断言（IPC 契约 / SQL 转义与组合 / upsert·delete 参数）
