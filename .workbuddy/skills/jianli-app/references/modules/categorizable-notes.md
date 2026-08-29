# 可归类笔记 (categorizableNotes)

## 职责
带标签/分类的笔记管理（列表 + 详情弹窗 + 标签选择器），支持分页加载。数据表 `note_book`，被命令面板 `noteSource` 索引，是「命令面板可搜索笔记」的本体来源。

## 关键文件
- 主页面：`src/views/categorizableNotes/index.vue`、`NoteList.vue`、`NoteDetailDialog.vue`、`TagSelector.vue`
- 关联主进程：**无独立 module**；走旧通道 `query-data`/`set-data`/`delete-data`（payload `tableName:'note_book'`，`index.vue:273` 用 `SqlStr` 传原始 SQL）
- 无专用 store（仅 `useTheme` 用于主题）；命令面板侧读取见 `src/views/commandPalette/sources/noteSource.ts`（同表 `note_book`）

## 路由
- `RouteNames.CATEGORIZABLE_NOTES` → `/categorizableNotes`
- 无小窗（`windowSections` 无 categorizable 条目）

## 用到的 IPC 通道
- `query-data`（`index.vue:273`，`conditions:{ SqlStr: <原生SQL> }` 分页/筛选）
- `set-data`（`index.vue:396`、`NoteDetailDialog.vue:165`，旧透传）
- `delete-data`（`NoteList.vue:144`，旧透传）
- 命令面板：`new-sql:execute`（`commandPalette/utils/db.ts` 以 `note_book` 表做 LIKE 搜索）

## 复用 / 集成点
- **命令面板 REGISTRY**：`useCommandSources.ts:13` 的 `noteSource` 索引本模块 `note_book` 表，命中后跳 `/categorizableNotes`（`navigate('categorizableNotes')`）。新增笔记字段后请同步 `noteSource` 的预览/搜索列。
- 不接小窗四件套、VirtualList、AppDialog。

## 特有坑 / 注意
- **未迁移新数据层**：沿用旧 `query-data`/`set-data`/`delete-data` 透传，且分页 SQL 以字符串（`SqlStr`）内插拼接，与「业务表走 new-sql:query/upsert/delete」约定不符；命令面板 `noteSource` 也裸用 `new-sql:execute` 做 `LIKE` 内插（存在注入风险，关键词已做单引号转义）。
- 与 notebook 模块数据不通（不同表/不同入口），命令面板只覆盖本模块。
