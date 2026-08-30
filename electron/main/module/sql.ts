import { ipcMain, app } from "electron";
import defaultSqlite3 from "sqlite3";
import type { Database } from "sqlite3";
import path from "node:path";
import fs from "node:fs";
import { win } from "./mainWindow.ts";
import { store, tableName as basicInfoTableName } from "./store.ts";
import { tableName as clipboardTableName } from "./clipboard.ts";
import { deleteData, queryByConditions, upsertData, createTable } from "../utils/sql.ts";
import colors from 'colors'
import { vitePublic } from "../variables.ts";

const verbose = defaultSqlite3.verbose;

export let myDb: Record<string, Database> = {
  db: null,
  userDb: null,
  shiciDb: null,
}

export async function initSqlite() {
  await createDBFile()
  initSqliteFn('db', true)
  initSqliteFn('userDb')
  initSqliteFn('shiciDb')
}

/**
 * 重新打开数据库连接（供备份恢复流程调用）
 *
 * 仅重建连接，不重复注册 IPC handler（避免 handle 重复注册报错）；
 * 重连后幂等兜底创建 basic_info / clipboard_history 基础表，
 * 防止恢复旧备份时缺表导致启动异常。
 *
 * @returns {Promise<void>} 重连完成时 resolve；单库关闭失败不中断整体流程
 */
export async function reopenSqlite() {
  for (const dbName of Object.keys(myDb)) {
    const conn = myDb[dbName];
    if (!conn) continue;
    try {
      await new Promise<void>((resolve) => conn.close(() => resolve()));
    } catch (err) {
      console.error('reopenSqlite 关闭连接失败:', dbName, err);
    }
  }
  await createDBFile();
  // 防御性兜底：确保基础表存在（幂等创建）
  createTable({
    db: myDb.db,
    tableName: basicInfoTableName,
    config: { primaryKey: 'key' },
    callback: () => {},
  });
  createTable({
    db: myDb.db,
    tableName: clipboardTableName,
    config: {},
    callback: () => {},
  });
}

async function createDBFile() {
  // dbPath 为public文件下的db.sqlite
  // electron获取用户目录
  const userDataPath = app.getPath("documents");
  // 获取程序设置的用户缓存路径
  let cachePath: string = (store.get("fileCachePath") ||
    userDataPath) as string;
  // 判断缓存路径下是否存在，且是否包含db.sqlite文件
  // 不存在则创建缓存目录
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath);
  }
  // 不存在db.sqlite文件则创建一个新的db.sqlite文件，创建文件，不是复制文件，因为复制文件会占用空间
  Object.keys(myDb).forEach(dbName => {
    let dbFullName = dbName + '.sqlite'
    if (!fs.existsSync(path.resolve(cachePath, dbFullName))) {
      fs.writeFileSync(path.resolve(cachePath, dbFullName), "");
    }

    let dbPath = path.resolve(cachePath, dbFullName);

    const sqlite3 = verbose();
    if (dbName == 'shiciDb') {
      let shiciDbPath = path.resolve(vitePublic, '宋词/ci.db');
      console.log('shiciDbPath', shiciDbPath)
      myDb[dbName] = new sqlite3.Database(shiciDbPath);
    } else {
      myDb[dbName] = new sqlite3.Database(dbPath);
    }

    myDb[dbName].exec('PRAGMA foreign_keys = ON;');
    // console.log('dblist', Object.keys(db), Object.keys(userDb))
  })
}

/**
 * 初始化旧版数据层 IPC 通道（已弃用，渲染端请改用 newSql.ts 的 new-sql:* 三件套）
 *
 * ⚠️ 渲染端弃用说明：
 * - query-data / set-data / delete-data 为项目早期透传通道，
 *   业务表读写已统一迁移到 newSql.ts 的 new-sql:query / new-sql:upsert / new-sql:delete。
 * - 通道本身保留注册：basic_info / clipboard_history 建表兜底及主进程内部模块仍依赖本文件，
 *   贸然移除会破坏未排查到的历史调用。
 * - 新代码一律走 newSql 数据层；旧层语义差异（whereStr/limit/orderBy 放 conditions 内）
 *   见 skill 文档 references/data-layer.md。
 */
export function initSqliteFn(dbName, isDefault = false) {
  // 初始化表结构，不然打不开
  isDefault && initTable(dbName)

  // 获取表数据，参数为表名，以及查询条件
  ipcMain.handle(isDefault ? "query-data" : `${dbName}:query-data`, async (event, { tableName, conditions }) => {
    return new Promise((resolve) => {
      console.log(myDb[dbName], dbName, 'name111')
      queryByConditions({
        db: myDb[dbName],
        tableName,
        conditions,
        callback: (err, data) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, data });
          }
        },
      });
    });
  });

  // 插入数据函数
  async function setData(event, { tableName, data, config }) {
    return new Promise((resolve) => {
      upsertData({
        db: myDb[dbName],
        tableName,
        data,
        config,
        callback: (err: Error & { code?: string }, data) => {
          if (err) {
            resolve({ success: false, error: err.message || err.code });
          } else {
            resolve({ success: true, data });
          }
        },
      });
    });
  }

  ipcMain.handle(isDefault ? "set-data" : `${dbName}:set-data`, setData);

  ipcMain.handle(isDefault ? 'delete-data' : `${dbName}:delete-data`, async (event, { tableName, condition }) => {
    return new Promise((resolve) => {
      deleteData({
        db: myDb[dbName],
        tableName,
        condition,
        callback: (err, data) => {
          if (err) {
            resolve({ success: false, error: err.message || err.code });
            return;
          }
          resolve({ success: true, data });
        }
      })
    })
  })
}

function initTable(dbName) {
  // 表结构basicInfoTableName: key 主键
  // 表结构clipboardTableName: 默认id主键
  console.log(Object.keys(myDb[dbName]), dbName, 'name333')
  createTable({
    db: myDb[dbName],
    tableName: basicInfoTableName,
    config: {
      primaryKey: 'key',
    },
    callback: (err, data) => {
      if (err) {
        console.log(colors.red(err), '创建表失败')
        return;
      }
      console.log(colors.green(data), '创建表成功')
    }
  })
  createTable({
    db: myDb[dbName],
    tableName: clipboardTableName,
    config: {
    },
    callback: (err, data) => {
      if (err) {
        console.log(colors.red(err), '创建表失败')
        return;
      }
      console.log(colors.green(data), '创建表成功')
    }
  })
}
