# 笔记本 / 富文本 (notebookApp)

## 职责
个人笔记的创建、日历式浏览与富文本编辑（umoEditor），含迷你笔记本小窗。与「可归类笔记」是**两套独立**数据结构，本模块走旧数据层。

## 关键文件
- 主页面：`src/views/notebook/index.vue`、`umoEditor.vue`（富文本编辑器封装）
- 小窗：`src/views/miniNotebook/index.vue`
- 关联主进程：**无独立 `electron/main/module/notebook.ts`**；数据直接经旧通道 `set-data`/`delete-data` + 裸 `new-sql:execute` 落库
- 无专用 store（状态在组件内）

## 路由
- `RouteNames.NOTEBOOKAPP` → `/notebookApp`
- `RouteNames.MINI_NOTEBOOK` → `/miniNotebook`

## 用到的 IPC 通道
- `set-data`（`index.vue:126/162`，旧透传通道，payload 带 `tableName`）
- `delete-data`（`index.vue:398`，旧透传通道）
- `new-sql:execute`（`index.vue:332` 直接拼 SQL 做删/改）
- 小窗：`open-new-window`(`notebook`)/`close-new-window`、`get-store`/`set-store`

## 复用 / 集成点
- **小窗四件套**：`windowSections.ts:185`（key=`notebook`，storeKey=`miniNotebookWindowConfig`），`useWindowModeSetting.ts` 三映射，`useWindowMode` store（`miniNotebookWindowConfig`/`setShowMiniNotebookWindow`），router `/miniNotebook`；常驻需 `mouseEvents:true`。
- **命令面板**：**未**进 REGISTRY（noteSource 读的是 `note_book` 表，属 categorizableNotes，非本模块）。
- 不接 VirtualList / AppDialog。

## 特有坑 / 注意
- **未迁移新数据层**：仍用旧 `set-data`/`delete-data` 透传 + 裸 `new-sql:execute`（`index.vue:332`），与约定「业务表走 new-sql:query/upsert/delete、严禁裸 new-sql:execute」不符。新增/改造逻辑请优先切到新层。
- 富文本经 `umoEditor.vue`；图片等二进制资源存库为 dataURL，注意体积。
- 本模块与 categorizableNotes 数据互不通用，命令面板搜不到本模块笔记。
