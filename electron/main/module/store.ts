import { ipcMain } from "electron";
import ElectronStore from "electron-store";
// 使用nodejs原生crypto模块进行加密，解密
export let store = new ElectronStore();

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
    const storeData = getAllStore();
    e.returnValue = storeData;
  });

  ipcMain.on("get-store", (e, key: any) => {
    e.returnValue = store.get(key);
  });

  ipcMain.on("set-store", (e, key: any, value: any) => {
    if (key === "multi-field") {
      e.returnValue = store.set(value);
    } else {
      e.returnValue = store.set(key, value);
    }
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
    store.store = {
      ...value,
      ...disabledShowKeysData,
    };
    e.returnValue = "ok";
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
