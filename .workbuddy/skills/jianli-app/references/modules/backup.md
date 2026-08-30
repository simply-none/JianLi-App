# 备份与恢复 (backup)

## 职责
SQLite 数据库级备份/恢复 + 数据导出中心。备份 `db.sqlite` / `userDb.sqlite` 为 `.jlbak` 单文件（zip 格式，含 manifest.json 清单），支持恢复、自动备份、按表导出 CSV/JSON。

## 关键文件
- 主进程：`electron/main/module/backup.ts`（`initBackup()` 注册全部通道 + 自动备份定时器）
- 主进程重连函数：`newSql.ts` 的 `reopenNewSqlite()`、`sql.ts` 的 `reopenSqlite()`（恢复流程专用，不重复注册 IPC）
- 前端页面：`src/views/backup/`（`index.vue` 三 Tab + `components/` 五卡片：RestoreCard 操作说明与从文件恢复 / BackupInfoCard 概况与立即备份 / BackupListCard 备份列表 / AutoBackupCard 自动备份 / ExportCenterCard 导出中心 + `api/backupApi.ts`）
- 路由：`RouteNames.BACKUP` → `/backup`，侧边栏「系统与资源」分组

## 备份文件结构（.jlbak = zip）
- `manifest.json`：应用版本、时间、类型（manual/auto/safety）、备注、各库表行数统计、快照方式
- `db.sqlite`、`userDb.sqlite`：VACUUM INTO 一致性快照（失败降级为原文件复制 + WAL 侧车）
- 备份目录：`fileCachePath/渐离App备份/`

## IPC 通道
| 通道 | 用途 |
|---|---|
| `backup:get-info` | 各库概况 + 备份目录 + 自动备份配置 + 最近备份 |
| `backup:create` | 创建手动备份（`{note}`），成功后同步刷新自动备份时间戳 |
| `backup:list` | 备份列表（按时间倒序，损坏文件 manifest 为 null） |
| `backup:restore` | 恢复（`{fileName}`=备份目录内文件名 或 `{filePath}`=任意位置 .jlbak 绝对路径，二选一），返回 `needRestart:true` |
| `backup:select-backup-file` | 文件选择框选外部 .jlbak，返回路径+清单预览（前端确认后调 restore-path） |
| `backup:restore-path` | 按绝对路径恢复（配合 select-backup-file，用于恢复其他电脑/手动保存的备份） |
| `backup:delete` | 删除备份（校验路径防穿越） |
| `backup:open-dir` | 打开备份目录 |
| `backup:get-auto-config` / `backup:set-auto-config` | 自动备份配置（存 electron-store `backupAutoConfig`） |
| `export:get-modules` | 导出清单（分组表 + 未归组表，含行数与日期列探测） |
| `export:select-dir` | 主进程原生目录选择框 |
| `export:run` | 执行导出（主进程直读库，数据不过 IPC） |

## 恢复安全流程（破坏性操作）
1. 校验 zip + manifest（manifest 缺失/无 sqlite 条目 → 拒绝）
2. **恢复前自动创建 safety 类型备份**（尽力而为，当前库损坏时继续）
3. 解压到临时目录 → 关闭 newSql + 旧 sql 两个连接池全部连接（Windows 必须先关后覆盖）
4. 覆盖库文件 → **删除 `-wal`/`-shm` 侧车**（旧侧车与新库不匹配）→ `reopenNewSqlite()` + `reopenSqlite()` 重开
5. 前端提示重启应用（各模块内存态才完全一致）

## 数据导出
- 表→中文标签映射 `TABLE_LABELS`、模块分组 `EXPORT_GROUPS` 写死在 backup.ts；未归组表进「其他」
- CSV 带 BOM（Excel 中文不乱码）、表头取全行键并集；超长字符串（>50K）截断防 base64 大字段撑爆文件
- 日期范围过滤：按 `pragma_table_info` 探测 `create_time/createTime/created_at/date/updateTime` 列，命中才生效
- 表名白名单校验（来自 sqlite_master 枚举）防注入

## 特有坑 / 注意
- **不要**把 electron-store 纳入备份：含加密密钥（RSAKey/password）且 `fileCachePath` 应保持本机路径
- shiciDb（诗词库）随应用分发只读，不备份；`basic_info` 配置表在 db.sqlite 内，随库一并备份
- 备份快照用 `VACUUM INTO`，连接对象来自 newSql 连接池（`myDb[dbFile.replace('.sqlite','')]`）
- 自动备份：启动 10s 首检 + 每 30 分钟轮询，启用且超间隔才执行，保留份数默认 7
- 主进程改动需重启 Electron 生效
