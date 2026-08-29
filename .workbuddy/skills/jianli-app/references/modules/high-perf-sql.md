# 高性能数据库查询 (highPerfSql)

## 职责
数据库管理/调试高级面板：列出表、查看表结构、执行 SQL、并发压测、索引/视图/触发器/事务管理。是 `newSql`（新数据层）能力的可视化入口。

## 关键文件
- `src/views/highPerfSql/index.vue`（核心调用：行 150 `new-sql:listTables`、164 `new-sql:tableInfo`、195 `new-sql:execute`、226 `new-sql:explain`）
- `src/views/highPerfSql/components/`：`ConcurrencyTester.vue`（并发压测，行 262 也用 `new-sql:execute`）、`SqlExecutor.vue`、`TableManager.vue`、`IndexManager.vue`、`ViewManager.vue`、`TriggerManager.vue`、`TransactionManager.vue`、`DataEditor.vue`、`QueryBuilder.vue`、`OperationSelector.vue`、`ResultPanel.vue`
- 主进程：`electron/main/module/newSql.ts`（所有 `new-sql:*` 的 `ipcMain.handle`）

## 路由
- `RouteNames.HIGH_PERF_SQL` → path `/highPerfSql`

## 用到的 IPC 通道（均经 `newSql.ts`）
- `new-sql:listTables`、`new-sql:tableInfo`、`new-sql:query`、`new-sql:count`、`new-sql:insert`、`new-sql:upsert`、`new-sql:update`、`new-sql:delete`
- `new-sql:execute`（执行任意 SQL，本模块**刻意**使用，作为高级执行器）
- `new-sql:explain`、`new-sql:transaction`、`new-sql:execute` 之外的 `new-sql:explain`
- 另有 `new-sql:record-pomodoro`、`new-sql:execute`（带 `primaryKey`）、`new-sql:listTables` 等全部见 `newSql.ts`

## 复用 / 集成点
- 普通业务模块的数据读写应通过 `src/utils/newSql`（内部走 `new-sql:query/upsert/delete` 等封装），**不要裸调 `new-sql:execute`**；本模块是唯一的「 sanctioned 执行器」，供开发手动跑 SQL。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- **约定特例**：项目约定「严禁裸 `new-sql:execute`」，但 highPerfSql 是官方放开的执行器（用户主动写 SQL）。普通模块若需执行 SQL 必须走 `newSql` 封装或 `new-sql:query/upsert/delete`，否则破坏参数化、易 SQL 注入。
- `new-sql:execute` 返回的字段结构与其他 `new-sql:*` 不同，前端需分别解析（见 `ResultPanel`/`SqlExecutor`）。
- 并发压测（`ConcurrencyTester`）会高频发 `new-sql:execute`，注意主进程 SQLite 串行化，压测值仅作参考。
