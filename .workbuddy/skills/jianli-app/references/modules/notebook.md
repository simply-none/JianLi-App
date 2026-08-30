# 笔记本 / 富文本 (notebookApp)

## 职责
个人笔记的创建、日历式浏览与富文本编辑（umoEditor），含迷你笔记本小窗。与「可归类笔记」是**两套独立**数据结构。

## 关键文件
- 主页面：`src/views/notebook/index.vue`、`umoEditor.vue`（富文本编辑器封装）
- 小窗：`src/views/miniNotebook/index.vue`
- 关联主进程：**无独立 `electron/main/module/notebook.ts`**；数据经 newSql 三件套落库（表 `note_book`，主键 `key`）
- 无专用 store（状态在组件内）

## 路由
- `RouteNames.NOTEBOOKAPP` → `/notebookApp`
- `RouteNames.MINI_NOTEBOOK` → `/miniNotebook`

## 用到的 IPC 通道
- `new-sql:upsert`（`index.vue:127/164`，写笔记，`config:{primaryKey:'key'}`）
- `new-sql:delete`（`index.vue:401`，按 `key` 删笔记）
- `new-sql:execute`（`index.vue:332` 直接拼 SQL 做删/改，历史遗留）
- 小窗：`open-new-window`(`notebook`)/`close-new-window`、`get-store`/`set-store`

## 复用 / 集成点
- **小窗四件套**：`windowSections.ts:185`（key=`notebook`，storeKey=`miniNotebookWindowConfig`），`useWindowModeSetting.ts` 三映射，`useWindowMode` store（`miniNotebookWindowConfig`/`setShowMiniNotebookWindow`），router `/miniNotebook`；常驻需 `mouseEvents:true`。
- **命令面板**：**未**进 REGISTRY（noteSource 读的是 `note_book` 表，属 categorizableNotes，非本模块）。
- 不接 VirtualList / AppDialog。

## 特有坑 / 注意
- **已迁移 newSql 数据层**（2026-08-30）：原 `set-data`/`delete-data` 旧透传已切到 `new-sql:upsert`/`new-sql:delete`；`index.vue:332` 仍有一处裸 `new-sql:execute` 历史遗留，后续改造请一并收敛。
- 富文本经 `umoEditor.vue`；图片等二进制资源存库为 dataURL，注意体积。
- 本模块与 categorizableNotes 数据互不通用（共用表 `note_book` 但入口/字段习惯不同），命令面板搜不到本模块笔记。
