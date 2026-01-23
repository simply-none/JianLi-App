/**
 * 通用条件查询
 * @param {string} tableName 表名
 * @param {object} conditions 条件对象 {字段:值}
 * @param {function} callback 回调函数(err, rows)
 */

import { Database } from "sqlite3";
import colors from "colors";
import { getObjectKeys } from "./common.ts";
import defaultSqlite3 from "sqlite3";

// 事务状态跟踪变量
let transactionCount = 0;

// 简单的互斥锁实现
const dbLocks = new Map();

function getDbLock(db) {
  if (!dbLocks.has(db)) {
    dbLocks.set(db, { locked: false, queue: [] });
  }
  return dbLocks.get(db);
}

async function withDbLock(db, operation) {
  const lock = getDbLock(db);
  
  return new Promise((resolve, reject) => {
    const executeOperation = async () => {
      lock.locked = true;
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        lock.locked = false;
        if (lock.queue.length > 0) {
          const next = lock.queue.shift();
          next();
        }
      }
    };
    
    if (lock.locked) {
      lock.queue.push(executeOperation);
    } else {
      executeOperation();
    }
  });
}

function queryByConditions1({ db, tableName, conditions, callback }) {
  // 构建WHERE子句和参数
  const whereClauses = [];
  const params = [];
  for (const [key, value] of Object.entries(conditions)) {
    // 忽略数据库关键字：ORDER BY, LIMIT, DESC, ASC
    if (["orderBy", "orderByDesc", "limit"].includes(key)) {
      continue;
    }
    whereClauses.push(`${key} = ?`);
    params.push(value);
  }
  // 其他条件参数：比如ORDER BY, LIMIT，desc/asc等
  const orderByStr = conditions.orderBy
    ? `ORDER BY ${conditions.orderBy} ${
        conditions.orderByDesc ? "DESC" : "ASC"
      }`
    : "";

  const limitStr = conditions.limit ? `LIMIT ${conditions.limit}` : "";

  const whereStr =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // 构建完整的SQL查询语句并执行

  const sql = `SELECT * FROM ${tableName} ${whereStr} ${orderByStr} ${limitStr}`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.log(err, '2')
      upsertData({ db, tableName, data: conditions, callback: () => {
        return callback(null, []);
      } })
      return;
    }
    callback(null, rows);
  });
}

export function queryByConditions({ db, tableName, conditions, callback }) {
  db.serialize(async () => {
    // 判断是否有SQL语句
    if (conditions && conditions.SqlStr) {
      const sql = conditions.SqlStr;
      db.all(sql, (err, rows) => {
        if (err) {
          console.log(err, '1')
          upsertData({ db, tableName, data: conditions, callback: () => {
            return callback(null, []);
          } })
        }
        callback(null, rows);
      });
      return;
    }
    // 判断是否有where语句
    if (conditions && conditions.whereStr) {
      const sql = `SELECT * FROM ${tableName} WHERE ${conditions.whereStr}`;
      db.all(sql, (err, rows) => {
        if (err) {
          console.log(err, '1')
          upsertData({ db, tableName, data: conditions, callback: () => {
            return callback(null, []);
          } })
        }
        callback(null, rows);
      });
      return;
    }
    // 构建WHERE子句和参数
    queryByConditions1({ db, tableName, conditions, callback })
  });
}

// 动态更新表字段
async function ensureTableColumns({ db, tableName, data, config }) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
      async (err, result) => {
        if (err) return reject(err);
        if (!result || !result.sql) {
          // 创建表结构
          // 创建表，默认主键为 id
          const primaryKey = config?.primaryKey
            ? `${config.primaryKey} PRIMARY KEY`
            : "id INTEGER PRIMARY KEY AUTOINCREMENT";

          await db.run(
            `CREATE TABLE ${tableName} (${primaryKey});`,
            [],
            (err) => {
              if (err) {
                console.log(err, 1)
                return reject(err);
              }
            }
          );
          // return;
        }

        const createSQL = result ? result.sql : "";
        // console.log(
        //   colors.bgCyan(createSQL),
        //   colors.bgMagenta("动态更新表字段")
        // );

        // 提取字段定义部分（去除CREATE TABLE和括号外的内容）
        const columnsPart = createSQL
          .replace(/^CREATE\s+TABLE\s+\w+\s*\(/i, "")
          .replace(/\)[^)]*$/, "")
          .trim();

        // 分割并提取字段名（处理带引号的情况）
        const existingColumns = columnsPart
          .split(/,(?![^(]*\))/)
          .map((col) => col.trim())
          .filter(
            (col) =>
              col && !/^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|CHECK)/i.test(col)
          )
          .map((col) => {
            const match = col.match(/^["'`]?([\w]+)["'`]?/);
            return match ? match[1] : null;
          })
          .filter(Boolean);

        let getColomn = Array.isArray(data) ? data[0] : data
        const newColumns = getObjectKeys(getColomn).filter(
          (key) => !existingColumns.includes(key)
        );

        if (newColumns.length > 0) {
          const alterPromises = newColumns.map(
            (col) =>
              new Promise((res, rej) => {
                const type = "TEXT";
                db.run(
                  `ALTER TABLE ${tableName} ADD COLUMN ${col} ${type}`,
                  (alterErr) => (alterErr ? rej(alterErr) : res("success"))
                );
              })
          );
          Promise.all(alterPromises).then(resolve).catch(reject);
        } else {
          resolve("success");
        }
      }
    );
  });
}

// 创建表结构
export async function createTable({ db, tableName, config, callback }) {
  // 先检查表是否存在，不存在则创建
  db.get(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
    (err, result) => {
      if (err) return callback(err, null);
      if (!result || !result.sql) {
        // 创建表结构
        // 创建表，默认主键为 id
        const primaryKey = config?.primaryKey
          ? `${config.primaryKey} PRIMARY KEY`
          : "id INTEGER PRIMARY KEY AUTOINCREMENT";
        db.run(`CREATE TABLE ${tableName} (${primaryKey});`, [], (err) => {
          if (err) {
            return callback(err, null);
          }
          callback(null, "success");
        });
      } else {
        callback(null, "success");
      }
    }
  );
}

// 插入/更新数据
export async function upsertData({
  db,
  tableName,
  data,
  config,
  callback,
}: {
  db: Database;
  tableName: string;
  data: Record<string, any> | Record<string, any>[];
  config?: {
    primaryKey?: string;
  };
  callback: (err: Error | null, result: any) => void;
}): Promise<void> {
  const newData = Array.isArray(data) ? data : [data];
  const columns = getObjectKeys(newData[0] || {});
  
  if (columns.length === 0) {
    return callback(new Error("No data fields provided"), null);
  }

  let placeholders = columns.map(() => "?").join(",");
  
  const sql = `
    INSERT INTO ${tableName} (${columns.join(",")}) 
    VALUES (${placeholders})
    ON CONFLICT(${config?.primaryKey || "id"}) DO UPDATE SET 
    ${columns.map((col) => `${col}=excluded.${col}`).join(",")}
  `;

  // 使用互斥锁确保同一时间只有一个操作使用数据库连接
  withDbLock(db, async () => {
    try {
      // 确保表结构存在
      try {
        await ensureTableColumns({ db, tableName, data: newData, config });
      } catch (err) {
        console.error('创建/更新表失败:', err);
        // 继续执行，表可能已经存在
      }

      // 准备语句
      const stmt = db.prepare(sql);
      
      // 执行批量操作
      for (const item of newData) {
        await new Promise((resolve, reject) => {
          const values = columns.map(col => item[col]);
          stmt.run(values, function(err) {
            if (err) {
              // SQLITE_BUSY 错误重试
              if (err.code === 'SQLITE_BUSY') {
                setTimeout(() => {
                  stmt.run(values, function(retryErr) {
                    retryErr ? reject(retryErr) : resolve(this);
                  });
                }, 100);
              } else {
                reject(err);
              }
            } else {
              resolve(this);
            }
          });
        });
      }
      
      stmt.finalize();
      callback(null, "success");
      
    } catch (err) {
      callback(err, null);
    }
  }).catch(error => {
    callback(error, null);
  });
}

// 删除数据
export async function deleteData({ db, tableName, condition, callback }) {
  if (!tableName || typeof condition !== "object") {
    return callback(new Error("Invalid parameters"), null);
  }

  const keys = Object.keys(condition);
  if (keys.length === 0) {
    return callback(new Error("Condition cannot be empty"), null);
  }

  const whereClause = keys.map((k) => `${k} = ?`).join(" AND ");
  const values = keys.map((k) => condition[k]);
  const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;

  db.run(sql, values, function (err, result) {
    if (err) return callback(err, null);
    callback(null, result);
  });
}
