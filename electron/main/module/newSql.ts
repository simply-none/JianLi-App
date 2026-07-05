/**
 * 高性能 SQLite 数据库操作模块
 * 
 * 本模块基于 sqlite3 库实现，提供以下特性：
 * - WAL (Write-Ahead Logging) 模式支持，提升并发读写性能
 * - Promise 风格 API，替代回调模式
 * - 自动表创建和列扩展
 * - 事务支持
 * - IPC 通信接口，供渲染进程调用
 * 
 * @module newSql
 */

import { ipcMain, app } from "electron";
import defaultSqlite3 from "sqlite3";
import type { Database } from "sqlite3";
import path from "node:path";
import fs from "node:fs";
import { store } from "./store.ts";

const verbose = defaultSqlite3.verbose;

/**
 * 数据库实例集合
 * - db: 主数据库
 * - userDb: 用户数据库
 * - shiciDb: 诗词数据库
 */
export let myDb: Record<string, Database> = {
  db: null,
  userDb: null,
  shiciDb: null,
};

/**
 * 查询选项接口
 */
interface QueryOptions {
  /** 表名 */
  tableName: string;
  /** 查询条件对象 */
  conditions?: Record<string, any>;
  /** 指定查询的列 */
  columns?: string[];
  /** 排序字段 */
  orderBy?: string;
  /** 是否降序排序 */
  orderByDesc?: boolean;
  /** 查询条数限制 */
  limit?: number;
  /** 查询偏移量 */
  offset?: number;
  /** 自定义 WHERE 条件字符串 */
  whereStr?: string;
  /** 完整的 SQL 查询语句 */
  SqlStr?: string;
}

/**
 * 插入选项接口
 */
interface InsertOptions {
  /** 表名 */
  tableName: string;
  /** 要插入的数据，支持单条或多条 */
  data: Record<string, any> | Record<string, any>[];
  /** 配置选项 */
  config?: {
    /** 主键字段名，默认为 id */
    primaryKey?: string;
  };
}

/**
 * 更新选项接口
 */
interface UpdateOptions {
  /** 表名 */
  tableName: string;
  /** 要更新的数据 */
  data: Record<string, any>;
  /** 更新条件 */
  condition: Record<string, any>;
}

/**
 * 删除选项接口
 */
interface DeleteOptions {
  /** 表名 */
  tableName: string;
  /** 删除条件 */
  condition: Record<string, any>;
}

/**
 * 事务选项接口
 */
interface TransactionOptions {
  /** 要执行的 SQL 语句数组 */
  sqls: string[];
  /** 对应的参数数组 */
  params?: any[][];
}

/**
 * 初始化 SQLite 数据库
 * 
 * 执行流程：
 * 1. 创建数据库文件（如果不存在）
 * 2. 初始化 WAL 模式以提升并发性能
 * 
 * @returns {Promise<void>}
 */
export async function initNewSqlite() {
  await createDBFile();
  await initWALMode();
}

/**
 * 创建数据库文件
 * 
 * 检查并创建数据库文件目录，初始化数据库连接实例。
 * 数据库文件存储在用户文档目录或配置的缓存路径中。
 * 
 * @returns {Promise<void>}
 */
async function createDBFile() {
  const userDataPath = app.getPath("documents");
  let cachePath: string = (store.get("fileCachePath") ||
    userDataPath) as string;

  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }

  Object.keys(myDb).forEach((dbName) => {
    let dbFullName = dbName + ".sqlite";
    if (!fs.existsSync(path.resolve(cachePath, dbFullName))) {
      fs.writeFileSync(path.resolve(cachePath, dbFullName), "");
    }

    let dbPath = path.resolve(cachePath, dbFullName);
    const sqlite3 = verbose();
    myDb[dbName] = new sqlite3.Database(dbPath);
  });
}

/**
 * 初始化 WAL 模式
 * 
 * WAL (Write-Ahead Logging) 模式可以提升 SQLite 的并发读写性能。
 * 同时设置：
 * - synchronous = NORMAL：平衡性能和安全性
 * - busy_timeout = 5000ms：锁等待超时时间
 * 
 * @returns {Promise<void>}
 */
async function initWALMode() {
  for (const dbName of Object.keys(myDb)) {
    await new Promise<void>((resolve, reject) => {
      myDb[dbName].run("PRAGMA journal_mode = WAL;", (err) => {
        if (err) {
          reject(err);
        } else {
          myDb[dbName].run("PRAGMA synchronous = NORMAL;", (err2) => {
            if (err2) {
              reject(err2);
            } else {
              myDb[dbName].run("PRAGMA busy_timeout = 5000;", (err3) => {
                err3 ? reject(err3) : resolve();
              });
            }
          });
        }
      });
    });
  }
}

/**
 * 查询数据
 * 
 * 支持多种查询方式：
 * 1. 完整 SQL 语句查询（SqlStr）
 * 2. 条件对象查询（conditions）
 * 3. 自定义 WHERE 字符串查询（whereStr）
 * 
 * 自动确保表存在，支持排序、分页。
 * 
 * @param {QueryOptions} options - 查询选项
 * @returns {Promise<any[]>} 查询结果数组
 */
export async function query(options: QueryOptions): Promise<any[]> {
  const { tableName, conditions, columns, orderBy, orderByDesc, limit, offset, whereStr, SqlStr } = options;
  await ensureTableExists(tableName);
  const db = myDb.db;

  return new Promise((resolve, reject) => {
    if (SqlStr) {
      db.all(SqlStr, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
      return;
    }

    let sql = "";
    const params: any[] = [];

    const selectColumns = columns && columns.length > 0 ? columns.join(", ") : "*";

    if (whereStr) {
      sql = `SELECT ${selectColumns} FROM ${tableName} WHERE ${whereStr}`;
    } else {
      const whereClauses: string[] = [];
      
      if (conditions) {
        for (const [key, value] of Object.entries(conditions)) {
          if (["orderBy", "orderByDesc", "limit", "offset"].includes(key)) {
            continue;
          }
          whereClauses.push(`${key} = ?`);
          params.push(value);
        }
      }

      const wherePart = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      sql = `SELECT ${selectColumns} FROM ${tableName} ${wherePart}`;
    }

    if (orderBy) {
      sql += ` ORDER BY ${orderBy} ${orderByDesc ? "DESC" : "ASC"}`;
    }

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    if (offset) {
      sql += ` OFFSET ${offset}`;
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * 计数查询
 * 
 * 查询表中满足条件的记录数。
 * 
 * @param {string} tableName - 表名
 * @param {Record<string, any>} [condition] - 查询条件
 * @returns {Promise<number>} 记录数量
 */
export async function count(tableName: string, condition?: Record<string, any>): Promise<number> {
  const db = myDb.db;

  return new Promise((resolve, reject) => {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const params: any[] = [];

    if (condition && Object.keys(condition).length > 0) {
      const whereClauses = Object.keys(condition).map((key) => `${key} = ?`);
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
      params.push(...Object.values(condition));
    }

    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row?.count || 0);
      }
    });
  });
}

/**
 * 插入数据
 * 
 * 支持单条和批量插入，自动确保表和列存在。
 * 使用事务保证批量插入的原子性。
 * 
 * @param {InsertOptions} options - 插入选项
 * @returns {Promise<{ lastID: number; changes: number }>} 插入结果
 * @throws {Error} 当数据为空时抛出异常
 */
export async function insert(options: InsertOptions): Promise<{ lastID: number; changes: number }> {
  const { tableName, data, config } = options;
  await ensureTableExists(tableName, undefined, config?.primaryKey);
  const db = myDb.db;
  const newData = Array.isArray(data) ? data : [data];

  if (newData.length === 0) {
    throw new Error("No data provided");
  }

  const columns = Object.keys(newData[0]);
  if (columns.length === 0) {
    throw new Error("No data fields provided");
  }

  return new Promise((resolve, reject) => {
    db.run("BEGIN TRANSACTION;", async (beginErr) => {
      if (beginErr) {
        reject(beginErr);
        return;
      }

      try {
        await ensureTableColumns(db, tableName, newData, config);

        const placeholders = columns.map(() => "?").join(",");
        const sql = `INSERT INTO ${tableName} (${columns.join(",")}) VALUES (${placeholders})`;

        let lastID = 0;
        let totalChanges = 0;

        const stmt = db.prepare(sql);

        for (const item of newData) {
          await new Promise<void>((res, rej) => {
            const values = columns.map((col) => item[col]);
            stmt.run(values, function (err) {
              if (err) {
                rej(err);
              } else {
                lastID = this.lastID;
                totalChanges += this.changes;
                res();
              }
            });
          });
        }

        stmt.finalize();

        db.run("COMMIT;", (commitErr) => {
          if (commitErr) {
            db.run("ROLLBACK;", () => {});
            reject(commitErr);
          } else {
            resolve({ lastID, changes: totalChanges });
          }
        });
      } catch (err) {
        db.run("ROLLBACK;", () => {});
        reject(err);
      }
    });
  });
}

/**
 * 插入或更新数据 (Upsert)
 * 
 * 使用 SQLite 的 ON CONFLICT 语法实现插入或更新。
 * 当主键冲突时自动更新已有记录。
 * 
 * @param {InsertOptions} options - 插入选项
 * @returns {Promise<{ lastID: number; changes: number }>} 操作结果
 * @throws {Error} 当数据为空时抛出异常
 */
export async function upsert(options: InsertOptions): Promise<{ lastID: number; changes: number }> {
  const { tableName, data, config } = options;
  await ensureTableExists(tableName, undefined, config?.primaryKey);
  const db = myDb.db;
  const newData = Array.isArray(data) ? data : [data];

  if (newData.length === 0) {
    throw new Error("No data provided");
  }

  const columns = Object.keys(newData[0]);
  if (columns.length === 0) {
    throw new Error("No data fields provided");
  }

  return new Promise((resolve, reject) => {
    db.run("BEGIN TRANSACTION;", async (beginErr) => {
      if (beginErr) {
        reject(beginErr);
        return;
      }

      try {
        await ensureTableColumns(db, tableName, newData, config);

        const placeholders = columns.map(() => "?").join(",");
        const primaryKey = config?.primaryKey || "id";
        const updateClause = columns.map((col) => `${col}=excluded.${col}`).join(",");
        
        const sql = `INSERT INTO ${tableName} (${columns.join(",")}) VALUES (${placeholders}) ON CONFLICT(${primaryKey}) DO UPDATE SET ${updateClause}`;

        let lastID = 0;
        let totalChanges = 0;

        const stmt = db.prepare(sql);

        for (const item of newData) {
          await new Promise<void>((res, rej) => {
            const values = columns.map((col) => item[col]);
            stmt.run(values, function (err) {
              if (err) {
                rej(err);
              } else {
                lastID = this.lastID;
                totalChanges += this.changes;
                res();
              }
            });
          });
        }

        stmt.finalize();

        db.run("COMMIT;", (commitErr) => {
          if (commitErr) {
            db.run("ROLLBACK;", () => {});
            reject(commitErr);
          } else {
            resolve({ lastID, changes: totalChanges });
          }
        });
      } catch (err) {
        db.run("ROLLBACK;", () => {});
        reject(err);
      }
    });
  });
}

/**
 * 更新数据
 * 
 * 根据条件更新表中的记录。
 * 
 * @param {UpdateOptions} options - 更新选项
 * @returns {Promise<{ changes: number }>} 更新结果
 * @throws {Error} 当数据为空或条件为空时抛出异常
 */
export async function update(options: UpdateOptions): Promise<{ changes: number }> {
  const { tableName, data, condition } = options;
  await ensureTableExists(tableName);
  const db = myDb.db;

  if (Object.keys(data).length === 0) {
    throw new Error("No data fields provided");
  }

  if (!condition || Object.keys(condition).length === 0) {
    throw new Error("Condition cannot be empty");
  }

  return new Promise((resolve, reject) => {
    const updateColumns = Object.keys(data).map((key) => `${key} = ?`).join(", ");
    const whereClauses = Object.keys(condition).map((key) => `${key} = ?`).join(" AND ");
    const values = [...Object.values(data), ...Object.values(condition)];

    const sql = `UPDATE ${tableName} SET ${updateColumns} WHERE ${whereClauses}`;

    db.run(sql, values, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
}

/**
 * 删除数据
 * 
 * 根据条件删除表中的记录。
 * 
 * @param {DeleteOptions} options - 删除选项
 * @returns {Promise<{ changes: number }>} 删除结果
 * @throws {Error} 当条件为空时抛出异常
 */
export async function del(options: DeleteOptions): Promise<{ changes: number }> {
  const { tableName, condition } = options;
  await ensureTableExists(tableName);
  const db = myDb.db;

  if (!condition || Object.keys(condition).length === 0) {
    throw new Error("Condition cannot be empty");
  }

  return new Promise((resolve, reject) => {
    const whereClauses = Object.keys(condition).map((key) => `${key} = ?`).join(" AND ");
    const values = Object.values(condition);

    const sql = `DELETE FROM ${tableName} WHERE ${whereClauses}`;

    db.run(sql, values, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
}

/**
 * 执行任意 SQL 语句
 * 
 * 支持 SELECT/INSERT/UPDATE/DELETE 等所有 SQL 语句。
 * 自动提取表名和列名，确保表和列存在。
 * 如果执行失败且原因是缺少列，会自动添加列并重试。
 * 
 * @param {string} sql - SQL 语句
 * @param {any[]} [params] - SQL 参数
 * @param {string} [primaryKey='id'] - 主键字段名，默认为 id
 * @returns {Promise<{ lastID: number; changes: number; rows?: any[] }>} 执行结果
 */
export async function execute(sql: string, params: any[] = [], primaryKey: string = 'id'): Promise<{ lastID: number; changes: number; rows?: any[] }> {
  const tableName = extractTableName(sql);
  if (tableName) {
    const columns = extractColumnNames(sql);
    await ensureTableExists(tableName, columns, primaryKey);
  }
  const db = myDb.db;

  /**
   * 执行 SQL 语句的内部函数
   * @returns {Promise<{ lastID: number; changes: number; rows?: any[] }>}
   */
  async function executeSql(): Promise<{ lastID: number; changes: number; rows?: any[] }> {
    return new Promise((resolve, reject) => {
      const isSelect = /^\s*SELECT/i.test(sql);
      
      if (isSelect) {
        db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({ lastID: 0, changes: 0, rows });
          }
        });
      } else {
        db.run(sql, params, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        });
      }
    });
  }

  try {
    return await executeSql();
  } catch (err) {
    const errorMsg = (err as Error).message;
    const noColumnMatch = errorMsg.match(/no column named (\w+)/i);
    const tableMatch = errorMsg.match(/table (\w+)/i);
    
    if (noColumnMatch && tableMatch && tableName) {
      const missingColumn = noColumnMatch[1];
      const errorTableName = tableMatch[1];
      
      if (errorTableName === tableName) {
        await new Promise<void>((resolve) => {
          db.run(`ALTER TABLE ${tableName} ADD COLUMN ${missingColumn} TEXT`, (alterErr) => {
            if (alterErr) {
              const errMsg = (alterErr as Error).message;
              if (!errMsg.includes("duplicate column name")) {
                console.warn(`Failed to add column ${missingColumn} to ${tableName}:`, errMsg);
              }
            }
            resolve();
          });
        });
        
        return await executeSql();
      }
    }
    
    throw err;
  }
}

/**
 * 获取 SQL 执行计划
 * 
 * 使用 EXPLAIN QUERY PLAN 分析 SQL 查询的执行计划，帮助优化查询性能。
 * 
 * @param {string} sql - SQL 查询语句
 * @returns {Promise<any[]>} 执行计划结果
 */
export async function explain(sql: string): Promise<any[]> {
  const db = myDb.db;

  return new Promise((resolve, reject) => {
    db.all(`EXPLAIN QUERY PLAN ${sql}`, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * 执行事务
 * 
 * 在事务中执行多条 SQL 语句，保证原子性。
 * 任意一条语句失败则回滚所有操作。
 * 
 * @param {TransactionOptions} options - 事务选项
 * @returns {Promise<{ success: boolean; results?: any[] }>} 事务执行结果
 */
export async function transaction(options: TransactionOptions): Promise<{ success: boolean; results?: any[] }> {
  const { sqls, params = [] } = options;
  const db = myDb.db;

  return new Promise((resolve, reject) => {
    db.run("BEGIN TRANSACTION;", async (beginErr) => {
      if (beginErr) {
        reject(beginErr);
        return;
      }

      try {
        const results: any[] = [];

        for (let i = 0; i < sqls.length; i++) {
          const sql = sqls[i];
          const sqlParams = params[i] || [];

          const result = await new Promise<{ lastID: number; changes: number; rows?: any[] }>((res, rej) => {
            const isSelect = /^\s*SELECT/i.test(sql);
            
            if (isSelect) {
              db.all(sql, sqlParams, (err, rows) => {
                if (err) rej(err);
                else res({ lastID: 0, changes: 0, rows });
              });
            } else {
              db.run(sql, sqlParams, function (err) {
                if (err) rej(err);
                else res({ lastID: this.lastID, changes: this.changes });
              });
            }
          });

          results.push(result);
        }

        db.run("COMMIT;", (commitErr) => {
          if (commitErr) {
            db.run("ROLLBACK;", () => {});
            reject(commitErr);
          } else {
            resolve({ success: true, results });
          }
        });
      } catch (err) {
        db.run("ROLLBACK;", () => {});
        reject(err);
      }
    });
  });
}

/**
 * 确保表存在
 * 
 * 如果表不存在则自动创建，支持指定初始列和自定义主键。
 * 如果表已存在但缺少指定列，会自动添加。
 * 
 * @param {string} tableName - 表名
 * @param {string[]} [columns] - 需要确保存在的列名数组
 * @param {string} [primaryKey='id'] - 主键字段名，默认为 id
 * @returns {Promise<void>}
 */
export async function ensureTableExists(tableName: string, columns?: string[], primaryKey: string = 'id'): Promise<void> {
  const db = myDb.db;
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      [tableName],
      async (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          const defaultColumns = (columns?.length ? columns : ['name', 'value', 'created_at']).filter(col => col.toLowerCase() !== primaryKey.toLowerCase());
          const columnDefs = defaultColumns.map(col => `${col} TEXT`).join(', ');
          await new Promise<void>((res, rej) => {
            const sql = columnDefs
              ? `CREATE TABLE IF NOT EXISTS ${tableName} (
              ${primaryKey} INTEGER PRIMARY KEY AUTOINCREMENT,
              ${columnDefs}
            )`
              : `CREATE TABLE IF NOT EXISTS ${tableName} (
              ${primaryKey} INTEGER PRIMARY KEY AUTOINCREMENT
            )`;
            db.run(sql, (createErr) => {
              if (createErr) rej(createErr);
              else res();
            });
          });
          resolve();
          return;
        }

        if (columns && columns.length > 0) {
          await ensureColumns(db, tableName, columns.filter(col => col.toLowerCase() !== primaryKey.toLowerCase()));
        }

        resolve();
      }
    );
  });
}

/**
 * 确保列存在
 * 
 * 检查并添加表中缺少的列。
 * 在并发场景下，重复添加同一列会静默忽略（duplicate column name）。
 * 
 * @param {Database} db - 数据库实例
 * @param {string} tableName - 表名
 * @param {string[]} columns - 需要确保存在的列名数组
 * @returns {Promise<void>}
 */
async function ensureColumns(db: Database, tableName: string, columns: string[]): Promise<void> {
  const existingColumns = await new Promise<string[]>((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) reject(err);
      else resolve((rows as any[]).map(row => row.name));
    });
  });

  const missingColumns = columns.filter(col => !existingColumns.includes(col));
  
  if (missingColumns.length > 0) {
    for (const col of missingColumns) {
      await new Promise<void>((resolve) => {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${col} TEXT`, (alterErr) => {
          if (alterErr) {
            const errMsg = (alterErr as Error).message;
            if (!errMsg.includes("duplicate column name")) {
              console.warn(`Failed to add column ${col} to ${tableName}:`, errMsg);
            }
          }
          resolve();
        });
      });
    }
  }
}

/**
 * 从 SQL 语句中提取表名
 * 
 * 支持 SELECT/INSERT/UPDATE/DELETE 语句的表名提取。
 * 
 * @param {string} sql - SQL 语句
 * @returns {string | null} 提取的表名，失败返回 null
 */
function extractTableName(sql: string): string | null {
  const match = sql.match(/^\s*(SELECT|INSERT|UPDATE|DELETE)\s+(?:INTO|FROM)?\s*([a-zA-Z_][a-zA-Z0-9_]*)/i);
  return match ? match[2] : null;
}

/**
 * 从 SQL 语句中提取列名
 * 
 * 根据 SQL 语句类型提取涉及的列名：
 * - INSERT: 提取 VALUES 前括号中的列名
 * - UPDATE: 提取 SET 后面的列名
 * - SELECT: 提取 SELECT 后面的列名（非 * 情况）
 * - 默认: 返回 ['name', 'value', 'created_at']
 * 
 * @param {string} sql - SQL 语句
 * @returns {string[]} 提取的列名数组
 */
function extractColumnNames(sql: string): string[] {
  const columns: string[] = [];
  
  const insertMatch = sql.match(/INSERT\s+INTO\s+\w+\s*\(\s*([^)]+)\s*\)/i);
  if (insertMatch) {
    insertMatch[1].split(',').forEach(col => {
      const trimmed = col.trim();
      const nameMatch = trimmed.match(/["'`]?([a-zA-Z_][a-zA-Z0-9_]*)["'`]?/);
      if (nameMatch) {
        columns.push(nameMatch[1]);
      }
    });
    return columns;
  }
  
  const updateMatch = sql.match(/UPDATE\s+\w+\s+SET\s+([^WHERE]+)/i);
  if (updateMatch) {
    updateMatch[1].split(',').forEach(col => {
      const trimmed = col.trim();
      const nameMatch = trimmed.match(/^["'`]?([a-zA-Z_][a-zA-Z0-9_]*)["'`]?/);
      if (nameMatch) {
        columns.push(nameMatch[1]);
      }
    });
    return columns;
  }
  
  const selectMatch = sql.match(/SELECT\s+([^FROM]+)/i);
  if (selectMatch && selectMatch[1].trim() !== '*') {
    selectMatch[1].split(',').forEach(col => {
      const trimmed = col.trim();
      const nameMatch = trimmed.match(/["'`]?([a-zA-Z_][a-zA-Z0-9_]*)["'`]?/);
      if (nameMatch) {
        columns.push(nameMatch[1]);
      }
    });
    return columns;
  }
  
  return ['name', 'value', 'created_at'];
}

/**
 * 确保表列存在（用于 insert/upsert）
 * 
 * 根据数据对象自动检测并添加缺失的列。
 * 如果表不存在则创建表。
 * 
 * @param {Database} db - 数据库实例
 * @param {string} tableName - 表名
 * @param {Record<string, any>[]} data - 数据数组
 * @param {{ primaryKey?: string }} [config] - 配置选项
 * @returns {Promise<void>}
 */
async function ensureTableColumns(db: Database, tableName: string, data: Record<string, any>[], config?: { primaryKey?: string }) {
  return new Promise<void>((resolve, reject) => {
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`, async (err, result) => {
      if (err) return reject(err);

      const pk = config?.primaryKey || 'id';

      if (!result || !result.sql) {
        const primaryKey = config?.primaryKey
          ? `${config.primaryKey} TEXT PRIMARY KEY`
          : "id INTEGER PRIMARY KEY AUTOINCREMENT";

        await new Promise<void>((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (${primaryKey});`, [], (createErr) => {
            if (createErr) rej(createErr);
            else res();
          });
        });
      }

      const createSQL = result ? result.sql : "";
      const columnsPart = createSQL
        .replace(/^CREATE\s+TABLE\s+\w+\s*\(/i, "")
        .replace(/\)[^)]*$/, "")
        .trim();

      const existingColumns = columnsPart
        .split(/,(?![^(]*\))/)
        .map((col) => col.trim())
        .filter((col) => col && !/^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|CHECK)/i.test(col))
        .map((col) => {
          const match = col.match(/^["'`]?([\w]+)["'`]?/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      const newColumns = Object.keys(data[0] || {}).filter(
        (key) => !existingColumns.includes(key) && key.toLowerCase() !== pk.toLowerCase()
      );

      if (newColumns.length > 0) {
        const alterPromises = newColumns.map(
          (col) =>
            new Promise<void>((res) => {
              db.run(`ALTER TABLE ${tableName} ADD COLUMN ${col} TEXT`, (alterErr) => {
                if (alterErr) {
                  const errMsg = (alterErr as Error).message;
                  if (!errMsg.includes("duplicate column name")) {
                    console.warn(`Failed to add column ${col} to ${tableName}:`, errMsg);
                  }
                }
                res();
              });
            })
        );
        await Promise.all(alterPromises);
      }

      resolve();
    });
  });
}

/**
 * IPC 处理器：查询数据
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:query", options);
 * ```
 */
ipcMain.handle("new-sql:query", async (event, options: QueryOptions) => {
  try {
    const data = await query(options);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：计数查询
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:count", { tableName, condition });
 * ```
 */
ipcMain.handle("new-sql:count", async (event, { tableName, condition }: { tableName: string; condition?: Record<string, any> }) => {
  try {
    const data = await count(tableName, condition);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：插入数据
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:insert", options);
 * ```
 */
ipcMain.handle("new-sql:insert", async (event, options: InsertOptions) => {
  try {
    const data = await insert(options);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：插入或更新数据
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:upsert", options);
 * ```
 */
ipcMain.handle("new-sql:upsert", async (event, options: InsertOptions) => {
  try {
    const data = await upsert(options);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：更新数据
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:update", options);
 * ```
 */
ipcMain.handle("new-sql:update", async (event, options: UpdateOptions) => {
  try {
    const data = await update(options);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：删除数据
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:delete", options);
 * ```
 */
ipcMain.handle("new-sql:delete", async (event, options: DeleteOptions) => {
  try {
    const data = await del(options);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：执行 SQL 语句
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:execute", { sql, params, primaryKey });
 * ```
 */
ipcMain.handle("new-sql:execute", async (event, { sql, params, primaryKey }: { sql: string; params?: any[]; primaryKey?: string }) => {
  try {
    const data = await execute(sql, params || [], primaryKey);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：获取执行计划
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:explain", { sql });
 * ```
 */
ipcMain.handle("new-sql:explain", async (event, { sql }: { sql: string }) => {
  try {
    const data = await explain(sql);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：执行事务
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:transaction", options);
 * ```
 */
ipcMain.handle("new-sql:transaction", async (event, options: TransactionOptions) => {
  try {
    const data = await transaction(options);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

/**
 * IPC 处理器：获取表列表
 * 
 * 获取数据库中所有用户表（排除系统表）。
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:listTables", {});
 * ```
 */
ipcMain.handle("new-sql:listTables", async () => {
  const db = myDb.db;
  return new Promise((resolve) => {
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      [],
      (err, rows) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, data: rows.map((row: any) => row.name) });
        }
      }
    );
  });
});

/**
 * IPC 处理器：获取表结构信息
 * 
 * 使用 PRAGMA table_info 获取表的字段信息。
 * 
 * 渲染进程调用方式：
 * ```javascript
 * await window.ipcRenderer.handlePromise("new-sql:tableInfo", { tableName });
 * ```
 */
ipcMain.handle("new-sql:tableInfo", async (event, { tableName }: { tableName: string }) => {
  const db = myDb.db;
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, data: rows });
      }
    });
  });
});