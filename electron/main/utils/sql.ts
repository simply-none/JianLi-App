/**
 * 通用条件查询
 * @param {string} tableName 表名
 * @param {object} conditions 条件对象 {字段:值}
 * @param {function} callback 回调函数(err, rows)
 */

import { Database } from "sqlite3";
import colors from "colors";

export function queryByConditions({ db, tableName, conditions, callback }) {
  db.serialize(() => {
    // 构建WHERE子句和参数
    const whereClauses = [];
    const params = [];
    for (const [key, value] of Object.entries(conditions)) {
      whereClauses.push(`${key} = ?`);
      params.push(value);
    }
    // 其他条件参数：比如ORDER BY, LIMIT，desc/asc等
    const orderByStr = conditions.orderBy ? `ORDER BY ${conditions.orderBy} ${conditions.orderByDesc ? 'DESC' : 'ASC'}` : '';

    const limitStr = conditions.limit ? `LIMIT ${conditions.limit}` : '';

    const whereStr =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const sql = `SELECT * FROM ${tableName} ${whereStr} ${orderByStr} ${limitStr}`;

    db.all(sql, params, (err, rows) => {
      if (err) {
        return callback(err, null);
      }
      callback(null, rows);
    });
  });
}

// 动态更新表字段
async function ensureTableColumns({ db, tableName, data, config }) {

  return new Promise((resolve, reject) => {
    db.get(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
      (err, result) => {
        if (err) return reject(err);
        if (!result || !result.sql) {
          // 创建表结构
          // 创建表，默认主键为 id
          const primaryKey = config?.primaryKey ? `${config.primaryKey} PRIMARY KEY` : 'id INTEGER PRIMARY KEY AUTOINCREMENT';

          db.run(`CREATE TABLE ${tableName} (${primaryKey});`, [], (err) => {
              if (err) {
                  return reject(err);
              }
          });
          
        }

        const createSQL = result.sql;
        console.log(colors.bgCyan(createSQL), colors.bgMagenta('动态更新表字段'))

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

        const newColumns = Object.keys(data).filter(
          (key) => !existingColumns.includes(key)
        );

        if (newColumns.length > 0) {
          const alterPromises = newColumns.map(
            (col) =>
              new Promise((res, rej) => {
                const type = typeof data[col] === "number" ? "REAL" : "TEXT";
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
  data: Record<string, any>;
  config?: {
    primaryKey?: string;
  }
  callback: (err: Error | null, result: any) => void;
}): Promise<void> {
  const columns = Object.keys(data);
  let placeholders = columns.map(() => "?").join(",");
  const values = columns.map((col) => data[col]);

  // 开启事务，先检查表是否存在，不存在则创建
  db.serialize(async () => {

    // 创建/更新表
    await ensureTableColumns({ db, tableName, data, config });

    // 构建UPSERT语句(SQLite特有语法)
    const sql = `
        INSERT INTO ${tableName} (${columns.join(",")}) 
        VALUES (${placeholders})
        ON CONFLICT(${config?.primaryKey || 'id'}) DO UPDATE SET 
        ${columns.map((col) => `${col}=excluded.${col}`).join(",")}
      `;

    db.run(sql, values, function (err, result) {
      console.log(err, result, 'err, result')
      if (err) return callback(err, null);
      callback(null, result);
    });
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
