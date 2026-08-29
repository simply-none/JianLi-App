# 数据库踩坑指南（newSql / SQLite）

> 汇总本项目数据层已踩过的坑与排查方法。写任何涉及 SQLite / newSql 通道的代码前先通读，
> 避免重蹈覆辙（每一条都是实际翻过车、修过的）。

## 一、newSql.execute 的三个坑（必须规避）

### 坑 1：isSelect 只认 SELECT 开头，PRAGMA 拿不到结果
- 主进程 `execute()` 用 `/^\s*SELECT/i` 判断查询类型；`PRAGMA table_info(...)` **不以 SELECT 开头，
  会被当写语句走 `db.run`，回调里没有 rows** —— 渲染端永远拿到空/undefined。
- ✅ 结构探测统一用 table-valued function（SELECT 开头，正常走 `db.all`）：
  ```sql
  SELECT * FROM pragma_table_info('表名')
  ```

### 坑 2：SELECT 结果包在 data.rows 里
- execute 返回 `{ lastID, changes }`（写语句）或 `{ lastID, changes, rows }`（SELECT）。
- 渲染端封装必须解包：`return d && d.rows ? d.rows : Array.isArray(d) ? d : []`。
- ❌ 直接把 `res.data` 当数组用，`rows.length` 为 undefined → 一切查询误判「无数据」。

### 坑 3：execute 会自动建表，劫持表结构
- execute 对 INSERT/UPDATE 会先 `ensureTableExists(表名, 列名, 'id')`：
  - 表**不存在**时按默认 schema 建表：`id INTEGER PRIMARY KEY` + 业务列全 TEXT（无主键约束、类型不符）。
- 后果：业务代码以为表有自己建的 PRIMARY KEY/类型，实际是默认结构 →
  `ON CONFLICT(业务主键)` 报错、去重失效、类型语义丢失。
- ✅ 表结构必须由业务代码**先显式 CREATE**（保证首个建表语句来自业务方）；
  建表后仍要校验实际结构（见坑 1 的探测语句），不要信任「我建过」。

## 二、SQLite 结构变更的坑

### 坑 4：无法 ALTER 加主键
- `ALTER TABLE ... ADD COLUMN ... PRIMARY KEY` 直接报错。
- ✅ 项目惯例（SKILL.md 红线 4）：补主键 = `ADD COLUMN key TEXT` + `CREATE UNIQUE INDEX`。
- ❌ 重建表迁移（CREATE _new → INSERT SELECT → DROP → RENAME）慎用：
  中途任一步失败会留下残留表 + 坏结构 + 数据丢失窗口（weather_data_new 残留实锤过）。
  若必须重建：`DROP TABLE IF EXISTS xxx_new` 先清理、每步 try/catch、失败不致命。

### 坑 5：ON CONFLICT upsert 的隐患
- 依赖「列必须是 PRIMARY KEY / UNIQUE」；表结构被劫持（坑 3）或 SQLite 版本旧（<3.24）时直接报错。
- ✅ 稳妥写法「先查后插/更」：
  ```sql
  SELECT id FROM t WHERE city = ?  -- 有行 → UPDATE；无行 → INSERT
  ```
  配合唯一索引即可保证不重复，兼容一切现状。

### 坑 6：execute 的静默容错会改变 schema
- execute 的 catch 里，「no column named X」会自动 `ALTER TABLE ADD COLUMN X TEXT` 后重试。
- 隐患：列类型被强制 TEXT、拼写错误的列名不报错反而悄悄加列。
- 排查时留意 `PRAGMA table_info`（或 table-valued function 版本）里是否多出意料之外的 TEXT 列。

## 三、IPC / 数据传输的坑

### 坑 7：reactive Proxy 无法过 IPC
- 直接把 Vue reactive/ref 对象传 `ipcRenderer.invoke` 抛「An object could not be cloned」。
- ✅ 统一 `JSON.parse(JSON.stringify(value))`（cloneForIpc）再传（themeConversation/db.ts、weather/db.ts 均如此）。

### 坑 8：错误被 .catch 静默吞掉
- 写库若用 `xxx().catch(err => log(...))`，失败只进日志，用户无感 —— weather 入库失败排查了一轮才发现。
- ✅ 数据库写入失败必须显式提示（ElMessage / 状态标记），至少保证调试面板可见且带原始错误信息。

## 四、排查方法论（查「为什么没存进去」）

1. **别只信 IPC 返回值，直接看库文件**。本机库路径见 `data-layer.md`
   （`fileCachePath` 配置或 `app.getPath('documents')`，文件名 `db.sqlite` / `userDb.sqlite` / `shiciDb.sqlite`）。
2. **库开了 WAL 模式**：最新写入可能还在 `-wal` 文件里没 checkpoint。
   核对时把 `db.sqlite`、`-wal`、`-shm` 一起复制到临时目录再用 sqlite3 只读打开，
   直接读原路径可能报 SQLITE_IOERR（沙箱/锁）。
3. 核对顺序：表是否存在 → `SELECT * FROM pragma_table_info('表名')` 看真实结构与主键 → 行数据 →
   再回头审代码。实际案例：weather_data 曾被建表劫持成 id 主键 + 0 行数据。
4. 用项目自带 sqlite3 依赖写临时 node 脚本核对（`require('sqlite3')`），用完即删。

## 五、速查清单（写库前过一遍）

- [ ] 表由业务代码显式建（防坑 3 劫持），建表语句幂等（IF NOT EXISTS）
- [ ] 结构探测用 `SELECT * FROM pragma_table_info(...)`（防坑 1）
- [ ] 渲染端封装解包 `data.rows`（防坑 2）
- [ ] 唯一约束用「id 主键 + CREATE UNIQUE INDEX」（防坑 4）
- [ ] upsert 用「先查后插/更」（防坑 5）
- [ ] IPC 传参 cloneForIpc（防坑 7）
- [ ] 写失败有用户可见反馈（防坑 8）
- [ ] 排查问题直接核对库文件（含 WAL 侧车复制）
