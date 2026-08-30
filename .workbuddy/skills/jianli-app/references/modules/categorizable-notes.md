# 可归类笔记 (categorizableNotes)

## 职责
带标签/分类的笔记管理（列表 + 详情弹窗 + 标签选择器），支持分页加载。数据表 `note_book`，被命令面板 `noteSource` 索引，是「命令面板可搜索笔记」的本体来源。

## 关键文件
- 主页面：`src/views/categorizableNotes/index.vue`、`NoteList.vue`、`NoteDetailDialog.vue`、`TagSelector.vue`
- 关联主进程：**无独立 module**；数据走 newSql 三件套（payload `tableName:'note_book'`，`index.vue:276` 用顶层 `SqlStr` 传原生 SQL）
- 无专用 store（仅 `useTheme` 用于主题）；命令面板侧读取见 `src/views/commandPalette/sources/noteSource.ts`（同表 `note_book`）

## 路由
- `RouteNames.CATEGORIZABLE_NOTES` → `/categorizableNotes`
- 无小窗（`windowSections` 无 categorizable 条目）

## 用到的 IPC 通道
- `new-sql:query`（`index.vue:276`，顶层 `SqlStr` 传分页/筛选 SQL）
- `new-sql:upsert`（`index.vue:398`、`NoteDetailDialog.vue:166`，`config:{primaryKey:'key'}`）
- `new-sql:delete`（`NoteList.vue:145`，按 `key` 删）
- 命令面板：`new-sql:query`（`commandPalette/utils/db.ts` 的 `queryNoteRows`，顶层 `SqlStr`）+ `new-sql:execute`（待办查询）

## 复用 / 集成点
- **命令面板 REGISTRY**：`useCommandSources.ts:13` 的 `noteSource` 索引本模块 `note_book` 表，命中后跳 `/categorizableNotes`（`navigate('categorizableNotes')`）。新增笔记字段后请同步 `noteSource` 的预览/搜索列。
- 不接小窗四件套、VirtualList、AppDialog。

## 特有坑 / 注意
- **已迁移 newSql 数据层**（2026-08-30）：旧 `query-data`/`set-data`/`delete-data` 已切到 `new-sql:query`/`new-sql:upsert`/`new-sql:delete`；分页 SQL 仍以字符串（顶层 `SqlStr`）内插拼接，搜索关键词已做单引号转义（`index.vue:260`）；命令面板待办查询仍裸用 `new-sql:execute`（占位符传参，风险可控）。
- 与 notebook 模块数据不通（不同表/不同入口），命令面板只覆盖本模块。
