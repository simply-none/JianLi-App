# 流程图 (flow)

## 职责
基于 `@vue-flow` 的可视化流程图编辑：自定义节点/边、工具栏、布局算法、导入导出。图数据持久化到本地 SQLite。

## 关键文件
- 主页面：`src/views/flow/index.vue` + `flow.vue`（VueFlow 画布）+ `Controls.vue`（保存/读取/删除）+ `panel.vue`/`panelAttrs.vue`/`ToolbarNode.vue`/`SpecialNode.vue`/`SpecialEdge.vue`/`Icon.vue`/`useLayout.ts`/`utils.ts`/`preset.ts`
- 关联主进程：**无独立 module**；数据走旧通道 `set-data`/`query-data`/`delete-data`（key 形如 `vue-flow--save-restore`，`Controls.vue:18/49/81/111`）
- 无专用 store（状态在组件内）

## 路由
- `RouteNames.FLOW` → `/流程图`
- 无小窗、无命令面板 REGISTRY

## 用到的 IPC 通道
- `set-data`（`Controls.vue:49`，保存图）
- `query-data`（`flow.vue:212`、`Controls.vue:81`，读取图）
- `delete-data`（`Controls.vue:111`，删除图）
- （未用新 `new-sql:*` 通道，沿用旧透传）

## 复用 / 集成点
- 依赖子包：`@vue-flow/core` + `@vue-flow/background` + `@vue-flow/node-toolbar` + `@vue-flow/node-resizer`。
- 不接 VirtualList / AppDialog / 小窗四件套。

## 特有坑 / 注意
- **必须手动引入样式**：`flow.vue:269/272` 已 `@import '@vue-flow/core/dist/style.css'` 与 `theme-default.css`；缺失会导致节点不渲染 / 连线不可见。新增节点类型后记得同步 `preset.ts` 与 `SpecialNode.vue`。
- **未迁移新数据层**：图持久化走旧 `set-data`/`query-data`/`delete-data` 透传（以字符串 key 存整图 JSON），与「业务表走 new-sql:query/upsert/delete」约定不符；若要重构请确认 key 命名不被其它模块占用。
- 还原图用 `vue-flow--save-restore` 命名空间（`Controls.vue:18`），导出/导入注意版本兼容。
