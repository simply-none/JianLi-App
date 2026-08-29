# 数据库测试 (sqlTest)

## 职责
面向开发的数据库调试页：手动对 SQLite 做增/查/删，验证旧版 `set-data`/`query-data`/`delete-data` 数据层通道是否正常工作。

## 关键文件
- `src/views/sqlTest/index.vue`（调用点：行 28 `set-data`、行 46 `query-data`、行 61 `delete-data`）
- 主进程：`electron/main/module/sql.ts`（`set-data`/`query-data`/`delete-data` 的 `ipcMain.handle`）；底层 `electron/main/utils/sql.ts`（`queryByConditions`/`upsertData` 等）

## 路由
- `RouteNames.SQL_TEST` → path `/sqlTest`

## 用到的 IPC 通道
- `set-data`（渲染→主，`handlePromise`，`{tableName, data, config?}`）→ 写入
- `query-data`（渲染→主，`handlePromise`，`{tableName, conditions}`）→ 查询
- `delete-data`（渲染→主，`handlePromise`，`{tableName, conditions}`）→ 删除

## 复用 / 集成点
- 这是**旧版 SQL 层**（`sql.ts`）的调试入口。新业务模块请勿再用这三个通道，改用 `newSql.ts` 的 `new-sql:query/upsert/delete`（见 `high-perf-sql.md`）。

## 特有坑 / 注意
- 本页验证了旧层；新功能一律走 `newSql`（新层），旧层仅用于兼容/调试，避免新旧混用导致表结构/字段不一致。
- 三个通道均为 `handlePromise`（异步返回），调用处已 `.catch` 兜底，但仍需判返回结构。
