# 流程图 (flow)

## 职责
基于 `@vue-flow` 的可视化流程图编辑：自定义节点/边、工具栏、布局算法、导入导出。图数据持久化到本地 SQLite。

## 关键文件
- 主页面：`src/views/flow/index.vue` + `flow.vue`（VueFlow 画布）+ `Controls.vue`（保存/读取/删除）+ `panel.vue`/`panelAttrs.vue`/`ToolbarNode.vue`/`SpecialNode.vue`/`SpecialEdge.vue`/`Icon.vue`/`useLayout.ts`/`utils.ts`/`preset.ts`
- 关联主进程：**无独立 module**；数据走 newSql 三件套（表 `flow`，主键 `id` 自增，`Controls.vue`/`flow.vue`）
- 无专用 store（状态在组件内）

## 路由
- `RouteNames.FLOW` → `/流程图`
- 无小窗、无命令面板 REGISTRY

## 用到的 IPC 通道
- `new-sql:upsert`（`Controls.vue:50`，保存图；编辑时带 `id` 更新，新增时不带）
- `new-sql:query`（`flow.vue:213`、`Controls.vue:83`，读取图；`limit/orderBy` 放顶层）
- `new-sql:delete`（`Controls.vue:112`，删除图）

## 复用 / 集成点
- 依赖子包：`@vue-flow/core` + `@vue-flow/background` + `@vue-flow/node-toolbar` + `@vue-flow/node-resizer`。
- 不接 VirtualList / AppDialog / 小窗四件套。

## 特有坑 / 注意
- **必须手动引入样式**：`flow.vue:269/272` 已 `@import '@vue-flow/core/dist/style.css'` 与 `theme-default.css`；缺失会导致节点不渲染 / 连线不可见。新增节点类型后记得同步 `preset.ts` 与 `SpecialNode.vue`。
- **未迁移新数据层 → 已迁移**（2026-08-30）：图持久化已从旧 `set-data`/`query-data`/`delete-data` 切到 newSql 三件套（整图 JSON 以字符串存 `flow.data` 列）；`vue-flow--save-restore` 命名空间仅是历史 localStorage 遗留命名，现持久化走 SQLite。
- 还原图用 `vue-flow--save-restore` 命名空间（`Controls.vue:18`），导出/导入注意版本兼容。
