# 已知差异与风险（risks）

> 封装 / 开发前必读，避免踩历史雷。以下为代码探查时发现的与文档 / 规范不符或易错处。

1. **node 版本不一致**：README「安装」写 v20.13.1，但 `package.json` `engines` 要求 `>=22` 且 `prestart` 跑 `check-node-version.js` 会拦截——**以代码为准，需 node 22+**。
2. **get-store typo**：`store.ts` 注册的是 `get-stort-all`（疑似拼写错误），调用方若用 `get-store-all` 将失效。
3. **双数据层并存**：`sql.ts`（旧）与 `newSql.ts`（新）同时存在，小窗位置等仍走旧层 `basic_info` 表；新增业务明确用 newSql，避免两套 API 混淆。
4. **死 / 未接通道**：渲染端 `invoke`/`send` 的 `save-file`、`get-file-list`、`save-debug-data` 在主进程未找到 handler（可能走 worker 或已废弃），封装前核实。
5. **new-sql:execute 仍存在**：危险通道代码层未移除，只靠规范约束——**永远不要调用**。
6. **遗留 / 未注册项**：`src/views/chart` 目录存在但未注册路由（疑似废弃）；`src/views/test.vue`、`src/demos/ipc.ts` 为调试残留；根 `功能清单.md` 为空占位。
7. **命令面板作用域耦合**：新增源需同时改 `REGISTRY`、`SCOPE_PREFIX_MAP`/`SCOPE_LABEL`/`TYPE_META`、`CommandType`、`SCOPE_PATTERN`，否则作用域不生效。
8. **小窗穿透**：新常驻小窗务必 `mouseEvents:true`，否则点不动 / 拖不动。

## 维护建议
- 每次大改动后更新对应 `references/modules/*.md` 与 `risks.md`，保持 skill 与代码同步。
- skill 内容会随代码演进过时，把它作为「项目知识基线」，发现不符就改。
