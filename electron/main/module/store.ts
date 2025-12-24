import { ipcMain } from "electron";
import ElectronStore from "electron-store";
import { queryByConditions, upsertData } from "../utils/sql.ts";
import { myDb } from "./sql.ts";
import colors from "colors";

// 使用nodejs原生crypto模块进行加密，解密
export let store = new ElectronStore();

export const tableName = "basic_info";
const disabledShowKeys = ["RSAKey", "password"];

// 获取所有的store数据，同时过滤掉disabledShowKeys中的key
export function getAllStore(): ObjectType {
  let storeData: ObjectType = store.store;
  const keys = Object.keys(storeData || {});
  const newStoreData: ObjectType = {};
  keys.forEach((item) => {
    if (!disabledShowKeys.includes(item)) {
      newStoreData[item] = storeData[item];
    }
  });
  return newStoreData;
}

// 获取disabledShowKeys中的数据
function getDisabledShowKeysData(): ObjectType {
  let storeData: ObjectType = store.store;
  const keys = Object.keys(storeData || {});
  const newStoreData: ObjectType = {};
  keys.forEach((item) => {
    if (disabledShowKeys.includes(item)) {
      newStoreData[item] = storeData[item];
    }
  });
  return newStoreData;
}

export function initStore() {
  ipcMain.on("get-stort-all", (e) => {
    // const storeData = getAllStore();
    // e.returnValue = storeData;

    // 查询插入成功的数据
    queryByConditions({
      db: myDb.db,
      tableName: tableName,
      conditions: {},
      callback: (err, data) => {
        if (err) {
          console.log(err, "err");
          e.returnValue = "error";
        } else {
          e.returnValue = data;
        }
      },
    });
  });

  ipcMain.on("get-store", (e, key: any) => {
    // e.returnValue = store.get(key);

    // 查询插入成功的数据
    queryByConditions({
      db: myDb.db,
      tableName: tableName,
      conditions: {
        key: key,
      },
      callback: (err, data) => {
        if (err) {
          console.log(err, "err");
          e.returnValue = null;
        } else {
          // console.log(colors.bgGreen(data), "data");
          e.returnValue = data.length > 0 ? JSON.parse(data[0].value) : null;
        }
      },
    });
  });

  ipcMain.on("set-store", async (e, key: any, value: any) => {
    // if (key === "multi-field") {
    //   // e.returnValue = store.set(value);
    // } else {
    //   e.returnValue = store.set(key, value);
    // }
    // 插入数据
    console.log(colors.bgYellow(key), colors.red(value))
    await upsertData({
      db: myDb.db,
      tableName: tableName,
      data: key === "multi-field" ? value : { key, value: JSON.stringify(value) },
      config: {
        primaryKey: "key",
      },
      callback: async (err, result) => {
        if (err) {
          console.log(err, "err");
          e.returnValue = "error";
        } else {
          if (key === "multi-field") {
            e.returnValue = "ok";
            return;
          }
          // 查询插入成功的数据
          await queryByConditions({
            db: myDb.db,
            tableName: tableName,
            conditions: {
              key: key,
            },
            callback: (err, data) => {
              // console.log(colors.bgGreen(data), "data");

              if (err) {
                console.log(err, "err");
                e.returnValue = "error";
              } else {
                e.returnValue = data.length > 0 ? JSON.parse(data[0].value) : null;
              }
            },
          });
        }
      },
    });
  });

  // store替换
  ipcMain.on("replace-store", (e, value: any) => {
    // 禁止替换 disabledShowKeys中的key
    const isObject =
      Object.prototype.toString.call(value) === "[object Object]";
    if (!isObject) {
      e.returnValue = "error";
      return;
    }
    // 禁止替换 disabledShowKeys中的key
    const disabledShowKeysData = getDisabledShowKeysData();
    // store.store = {
    //   ...value,
    //   ...disabledShowKeysData,
    // };
    const newStoreData = {
      ...value,
      ...disabledShowKeysData,
    };
    // 将newStoreData转成[{key, value}]形式的数组
    const newStoreDataArray = Object.keys(newStoreData).map((key) => ({
      key,
      value: newStoreData[key],
    }));
    // 插入数据
    upsertData({
      db: myDb.db,
      tableName: tableName,
      data: newStoreDataArray,
      config: {
        primaryKey: "key",
      },
      callback: async (err, result) => {
        if (err) {
          console.log(err, "err");
          e.returnValue = "error";
        } else {
          e.returnValue = "ok";
          return;
        }
      },
    });
  });

  ipcMain.on("clear-store", (e) => {
    // 禁止替换 disabledShowKeys中的key
    const disabledShowKeysData = getDisabledShowKeysData();
    store.store = {
      ...disabledShowKeysData,
    };

    e.returnValue = "清空成功";
  });
}
