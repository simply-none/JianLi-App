# 小工具集合 (function)

## 职责
零散小工具的聚合页（「小工具」路由）。当前仅实现「生成唯一 ID」一项：调用浏览器 `crypto.randomUUID()` 生成并展示，可一键切换。

## 关键文件
- 主页面：`src/views/function/index.vue`（**单文件**，无子组件/无 store/无 composables）
- 无关联主进程 module
- 无小窗、无 store、无命令面板 REGISTRY

## 路由
- `RouteNames.FUNCTION` → `/小工具`

## 用到的 IPC 通道
- 无（纯前端，不触 IPC、不读写数据库）

## 复用 / 集成点
- 仅用 Element Plus 的 `el-form` / `el-form-item` / `el-button` / `ElMessage`，无 VirtualList / AppDialog / 小窗四件套。

## 特有坑 / 注意
- 模块极简，目前只暴露「生成唯一 ID」一个工具；扩展新小工具直接在 `index.vue` 的 `el-form` 内追加 `el-form-item` 即可，无需改路由/store/主进程。
- 注意路由 path 是中文 `/小工具`（`router/index.ts:235`），命令面板或外部跳转时用 `navigate('function')` 而非手写路径。
- 若后续新工具需要持久化，按项目约定优先走 `new-sql:query/upsert/delete`，**不要**裸 `new-sql:execute`（DDL 除外）。
