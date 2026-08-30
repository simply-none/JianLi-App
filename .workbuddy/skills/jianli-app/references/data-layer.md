# 数据层约定（data-layer）

## 两套数据层并存
- **新层** `electron/main/module/newSql.ts`：业务表首选。封装 `query` / `count` / `insert` / `upsert` / `update` / `delete` / `transaction` 等。
- **旧层** `electron/main/module/sql.ts`：`myDb` / `queryByConditions` / `upsertData`，通道 `query-data`/`set-data`/`delete-data` **渲染端已弃用**（2026-08-30 完成迁移，仅保留注册供 `basic_info`/`clipboard_history` 建表兜底与主进程内部使用）。**新增业务严禁再用旧层**。

## 新旧层查询语义差异（迁移易踩）
- 旧层：`whereStr` / `limit` / `offset` / `orderBy` / `orderByDesc` 全塞在 `conditions` 里。
- 新层 `new-sql:query`：这些参数必须放**顶层 options**；塞在 `conditions` 里会被静默忽略或当等值过滤。
- 写入：旧 `set-data` payload 与 `new-sql:upsert` 完全同构（`{tableName, data, config:{primaryKey}}`），可直接换通道名。
- 删除：旧 `delete-data` payload 与 `new-sql:delete` 完全同构（`{tableName, condition}`）。

## 读写红线（务必遵守）
- 读业务表：走 `new-sql:query`，`conditions.SqlStr` 直传 SQL，返回兼容 `{data|rows}`。
- 写业务表：走 `new-sql:upsert`（按主键）或 `new-sql:insert`。
- 删：走 `new-sql:delete`。
- ❌ **严禁裸 `new-sql:execute`**：其 `extractColumnNames` 对 `SELECT *` / `DELETE` 猜不出列名时会兜底成 `['name','value','created_at']` 并 `ALTER ADD COLUMN`，污染业务表结构（已出现 `habit_def` 破表事故）。该通道代码层仍存在，只靠规范约束——**不要调用**。

## 主键约定（SQLite 坑）
- SQLite **不允许 `ALTER TABLE ADD COLUMN ... PRIMARY KEY`**。补主键必须两步：
  1. `ALTER TABLE t ADD COLUMN key TEXT`（普通列）
  2. `CREATE UNIQUE INDEX IF NOT EXISTS uq_t_key ON t(key)`（等价唯一约束）
- 业务表统一以 `key(TEXT)` 作主键；`query`/`upsert` 透传 `primaryKey:'key'`。
- 历史破表可在加载时幂等补列 + 建索引修复（参考 `habitApi.ensureHabitTables`）。

## 渲染端封装
- `src/views/.../api/*.ts` 调用 `window.ipcRenderer.invoke('new-sql:query', {...})`；建议统一封装 `queryData` / `upsert` / `delete` 之类薄函数。
- newSql **每秒热路径禁用**（如剪贴板用进程内 `lastText` 缓存，不要高频查库）。
- `getCompositeObj` 非破坏性双向合并（store 优先）。

## 密码
- `crypto.ts` 的 `encrypt-pwd` / `decrypt-pwd` / `compare-pwd`。解密失败返回 `{ok, decrypted}`，前端 `isStoredPasswordDecryptable` 探测失败引导重置，不要静默吞错。

## 数据排查：直接读库验证
- 业务数据最终落在本地 SQLite 文件。当渲染端报「数据不对 / 查不到 / 写入没生效」等疑似数据层问题时，**可直接打开数据库文件核对真实落库内容**，而不是只信 IPC 返回值。
- 本机库文件路径：`C:\Users\风起\Downloads\测试\db.sqlite`
  - 用任意 SQLite 客户端（如 `sqlite3`、DB Browser for SQLite、VS Code 的 SQLite 插件）打开该文件执行 `SELECT` 即可核对表结构与行数据。
  - 重点核对：表是否存在、列名是否与 `newSql` 透传的 `primaryKey`/字段一致、是否有被 `new-sql:execute` 误 `ALTER ADD COLUMN` 进去的垃圾列（参考上方读写红线）。
- 注意：该文件是**运行期实际库**，只读核对、不要随手改；改库结构请走代码层幂等补列（见主键约定），避免与运行中的 Electron 进程并发写库导致锁表。

## 何时读本文档
任何涉及「建表 / 读写业务数据 / 补列 / 迁移 / 数据排查」时。具体模块的数据访问见 `modules/*.md`。
