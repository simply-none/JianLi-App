import { ipcMain, app } from "electron";
import defaultSqlite3, { Database } from "sqlite3";
import path from "node:path";
import fs from "node:fs";
import { win } from "./mainWindow.ts";
import { store, tableName as basicInfoTableName } from "./store.ts";
import { tableName as clipboardTableName } from "./clipboard.ts";
import { deleteData, queryByConditions, upsertData, createTable } from "../utils/sql.ts";
import colors from 'colors'

const verbose = defaultSqlite3.verbose;

export let db: Database;

export function initSqlite() {
  // dbPath 为public文件下的db.sqlite
  // electron获取用户目录
  const userDataPath = app.getPath("documents");
  // 获取程序设置的用户缓存路径
  const cachePath: string = (store.get("fileCachePath") ||
    userDataPath) as string;
  // 判断缓存路径下是否存在，且是否包含db.sqlite文件
  // 不存在则创建缓存目录
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath);
  }
  // 不存在db.sqlite文件则创建一个新的db.sqlite文件，创建文件，不是复制文件，因为复制文件会占用空间
  if (!fs.existsSync(path.resolve(cachePath, "db.sqlite"))) {
    fs.writeFileSync(path.resolve(cachePath, "db.sqlite"), "");
  }

  let dbPath = path.resolve(cachePath, "db.sqlite");

  const sqlite3 = verbose();

  db = new sqlite3.Database(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  // 初始化表结构，不然打不开
  initTable()

  // 获取表数据，参数为表名，以及查询条件
  ipcMain.handle("query-data", async (event, { tableName, conditions }) => {
    return new Promise((resolve) => {
      queryByConditions({
        db,
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

  ipcMain.handle("set-data", async (event, { tableName, data, config }) => {
    return new Promise((resolve) => {
      upsertData({
        db,
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
  });

  ipcMain.handle('delete-data', async (event, { tableName, condition }) => {
    return new Promise((resolve) => {
      deleteData({
        db,
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

function initTable() {
  // 表结构basicInfoTableName: key 主键
  // 表结构clipboardTableName: 默认id主键
  createTable({
    db,
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
    db,
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
