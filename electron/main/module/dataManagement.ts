/**
 * 整库 SQLite 导入 / 导出（移动端 ↔ PC 互通）
 *
 * 背景：移动端「数据管理」用 VACUUM INTO 导出整库 db.sqlite（文件名 db_导出_<时间戳>.sqlite），
 * 并可用 importDatabaseFile 把另一个 db.sqlite 的非 basic_info 表合并进当前库。
 * 本模块在 PC 端补齐同样能力，使：
 *  - 移动端导出的 db.sqlite 可直接「导入」合并进 PC 主库（db.sqlite）；
 *  - PC 也可导出与移动端同格式的整库快照，便于回灌到移动端。
 *
 * 设计要点（与移动端严格对齐）：
 * - 导入：源必须含 basic_info 才接受（证明是合法的渐离App 导出）；
 *   遍历 PC 主库各表「排除 basic_info」，源有同表则按目标实际列过滤后 INSERT OR REPLACE 合并；
 *   源有而目标无的列允许「新增」（尝试 ALTER ADD COLUMN，无法新增的如自增主键则跳过），
 *   但绝不删除任何目标列；整批事务包裹，失败回滚。
 * - 导出：对 PC 主库 db.sqlite 走 VACUUM INTO 一致快照，文件名沿用移动端 db_导出_<时间戳>.sqlite，
 *   输出到用户自选目录（不套 .jlbak，纯整库 .sqlite 便于跨端）。
 * - 只动 db.sqlite；userDb.sqlite（账户 / 2FA / 保险箱）与 basic_info 一律不参与，护住 PC 本地配置。
 */
import { ipcMain, app, dialog } from "electron";
import defaultSqlite3 from "sqlite3";
import type { Database } from "sqlite3";
import path from "node:path";
import fs from "node:fs";
import moment from "moment";
import { store } from "./store.ts";
import { myDb } from "./newSql.ts";

const verbose = defaultSqlite3.verbose;

/** 取得数据库所在缓存目录（与 newSql / backup 一致：fileCachePath 优先，否则文档目录） */
function getCachePath(): string {
  return (store.get("fileCachePath") || app.getPath("documents")) as string;
}

/** 回调风格 SELECT */
function dbAll(db: any, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: any, rows: any[]) => (err ? reject(err) : resolve(rows || [])));
  });
}

/** 回调风格写语句 */
function dbRun(db: any, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
  });
}

/** 读取全部用户表名（排除 sqlite_ 内部表） */
async function getAllTables(db: any): Promise<string[]> {
  const rows = await dbAll(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  return rows.map((r: any) => r.name);
}

/** 读取表的列定义（名称 + 声明类型） */
async function getTableColumns(db: any, table: string): Promise<{ name: string; type: string }[]> {
  return dbAll(db, "SELECT name, type FROM pragma_table_info(?)", [table]);
}

/** 导入时绝不合并的表（本地配置：含账户 / 锁 / 2FA / 保险箱等敏感状态） */
const IMPORT_EXCLUDE_TABLES = ["basic_info"];

/**
 * 导出 PC 主库整库快照（与移动端同格式）
 *
 * @param {string} saveDir - 用户自选导出目录
 * @returns {Promise<{ ok: boolean; filePath?: string; size?: number; error?: string }>} 导出结果
 */
export async function exportDatabaseRaw(
  saveDir: string,
): Promise<{ ok: boolean; filePath?: string; size?: number; error?: string }> {
  try {
    if (!saveDir || !fs.existsSync(saveDir)) return { ok: false, error: "导出目录不存在" };
    const conn = myDb["db"];
    if (!conn) return { ok: false, error: "主数据库未初始化" };

    const stamp = moment().format("YYYY-MM-DD_HH-mm-ss");
    const fileName = `db_导出_${stamp}.sqlite`;
    const filePath = path.resolve(saveDir, fileName);

    // 禁止导出到当前正在使用的库文件自身（会写坏自身）
    const targetDbPath = path.resolve(getCachePath(), "db.sqlite");
    if (filePath === targetDbPath) {
      return { ok: false, error: "导出目标不能是当前正在使用的数据库文件" };
    }

    // VACUUM INTO 生成一致快照（含 WAL 最新数据），天然规避侧车文件丢失
    await dbRun(conn, "PRAGMA wal_checkpoint(TRUNCATE);");
    const escaped = filePath.replace(/'/g, "''");
    await dbRun(conn, `VACUUM INTO '${escaped}';`);
    if (!fs.existsSync(filePath)) return { ok: false, error: "导出快照生成失败" };

    return { ok: true, filePath, size: fs.statSync(filePath).size };
  } catch (err: any) {
    console.error("导出整库失败:", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 从外部 db.sqlite 合并非 basic_info 表进 PC 主库（移动端 importDatabaseFile 的跨库版）
 *
 * @param {string} sourcePath - 源 db.sqlite 绝对路径（来自文件选择框）
 * @returns {Promise<{ ok: boolean; tables?: number; rows?: number; addedColumns?: number; message?: string; needRestart?: boolean; error?: string }>}
 *          成功返回合并的表数 / 行数 / 新增字段数；失败返回错误信息
 */
export async function importDatabaseRaw(
  sourcePath: string,
): Promise<{ ok: boolean; tables?: number; rows?: number; addedColumns?: number; message?: string; needRestart?: boolean; error?: string }> {
  const source = path.resolve(sourcePath);
  if (!fs.existsSync(source)) return { ok: false, error: "源数据库文件不存在" };

  // 禁止把当前正在使用的库导入自身
  const targetDbPath = path.resolve(getCachePath(), "db.sqlite");
  if (source === targetDbPath) return { ok: false, error: "不能把当前正在使用的数据库导入自身" };

  const target = myDb["db"];
  if (!target) return { ok: false, error: "主数据库未初始化" };

  // 打开源库（独立连接，不干扰主库），用完即关
  const sqlite3 = verbose();
  const srcDb: Database = new sqlite3.Database(source);

  try {
    // 1. 校验源是合法导出：必须含 basic_info
    const srcTables = await getAllTables(srcDb);
    if (!srcTables.includes("basic_info")) {
      return { ok: false, error: "该文件不是有效的渐离App 数据库（缺少 basic_info 表），已拒绝导入" };
    }
    const targetTables = await getAllTables(target);

    let tablesMerged = 0;
    let rowsMerged = 0;
    let addedColumns = 0;

    // 2. 整批事务包裹，任一表失败整体回滚
    await dbRun(target, "BEGIN");
    try {
      for (const table of targetTables) {
        if (IMPORT_EXCLUDE_TABLES.includes(table)) continue; // 护住 PC 本地配置
        if (!srcTables.includes(table)) continue; // 源无此表：保留 PC 既有数据，不删除

        const srcCols = await getTableColumns(srcDb, table);
        const tgtCols = await getTableColumns(target, table);
        const tgtSet = new Set(tgtCols.map((c) => c.name));

        // 允许新增字段：源有而目标无的列，尝试 ALTER ADD（无法新增的如自增主键则跳过）
        for (const col of srcCols) {
          if (!tgtSet.has(col.name)) {
            try {
              await dbRun(target, `ALTER TABLE "${table}" ADD COLUMN "${col.name}" ${col.type || "TEXT"};`);
              tgtSet.add(col.name);
              addedColumns++;
            } catch (err) {
              console.warn(`导入跳过的列（目标无法新增）${table}.${col.name}:`, err);
            }
          }
        }

        // 仅用「目标实际存在的列」（含新增成功的）做插入，源多余列不进入，目标多余列留默认
        const effectiveCols = tgtCols.map((c) => c.name).filter((c) => tgtSet.has(c));
        const rows = await dbAll(srcDb, `SELECT * FROM "${table}"`);
        for (const row of rows) {
          const cols = effectiveCols.filter((c) => Object.prototype.hasOwnProperty.call(row, c));
          if (cols.length === 0) continue;
          const colSql = cols.map((c) => `"${c}"`).join(", ");
          const placeholders = cols.map(() => "?").join(", ");
          const params = cols.map((c) => (row[c] === undefined ? null : row[c]));
          await dbRun(
            target,
            `INSERT OR REPLACE INTO "${table}" (${colSql}) VALUES (${placeholders})`,
            params,
          );
          rowsMerged++;
        }
        tablesMerged++;
      }
      await dbRun(target, "COMMIT");
    } catch (err) {
      await dbRun(target, "ROLLBACK").catch(() => {});
      throw err;
    }

    return {
      ok: true,
      tables: tablesMerged,
      rows: rowsMerged,
      addedColumns,
      needRestart: true,
      message: `已合并 ${tablesMerged} 张表、${rowsMerged} 行${addedColumns ? `，新增 ${addedColumns} 个字段` : ""}`,
    };
  } catch (err: any) {
    console.error("导入整库失败:", err);
    return { ok: false, error: err?.message || String(err) };
  } finally {
    await new Promise<void>((resolve) => srcDb.close(() => resolve()));
  }
}

/**
 * 初始化整库导入 / 导出模块：注册 IPC 通道
 * - data-management:export-sqlite 导出整库快照到自选目录
 * - data-management:select-sqlite 选择要导入的 .sqlite 文件
 * - data-management:import-sqlite 从外部 .sqlite 合并进主库
 *
 * @returns {void}
 */
export function initDataManagement(): void {
  ipcMain.handle("data-management:export-sqlite", async (_e, params: { saveDir: string }) =>
    exportDatabaseRaw(params?.saveDir || ""),
  );

  ipcMain.handle("data-management:select-sqlite", async () => {
    const result = dialog.showOpenDialogSync({
      title: "选择要导入的 db.sqlite 文件",
      filters: [{ name: "SQLite 数据库", extensions: ["sqlite", "db", "sqlite3"] }],
      properties: ["openFile"],
    });
    if (!result || result.length === 0) return null;
    return result[0];
  });

  ipcMain.handle("data-management:import-sqlite", async (_e, params: { sourcePath: string }) =>
    importDatabaseRaw(params?.sourcePath || ""),
  );
}
