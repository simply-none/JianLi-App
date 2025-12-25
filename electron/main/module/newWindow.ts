import { BrowserWindow, ipcMain, screen } from "electron";
import colors from "colors";
import { getAllStore, tableName } from "./store.ts";
import { myDb } from "./sql.ts";
import {
  appLogoIco,
  indexHtml,
  preload,
  VITE_DEV_SERVER_URL,
} from "../variables.ts";
import { queryByConditions } from "../utils/sql.ts";
import { objectArrayToObject } from "../utils/common.ts";

let childWindow: Record<string, BrowserWindow | null> = {};
// 获取屏幕宽高
let screenWidth = 0;
let screenHeight = 0;

function getScreenInfo() {
  // 获取屏幕宽高
  const primaryDisplay = screen.getPrimaryDisplay();
  screenWidth = primaryDisplay.size.width;
  screenHeight = primaryDisplay.size.height;
}

export function createOtherWindow(arg: string, ops?: ObjectType, recreate = false) {
  getScreenInfo();
  if (childWindow[arg] && !recreate) {
    try {
      childWindow[arg]?.show();
      childWindow[arg]?.focus();
      getAllData(arg, true)
      return;
    } catch (e) {
      createOtherWindow(arg, ops, true)
    }
  }
  childWindow[arg] = new BrowserWindow({
    title: "second window",
    icon: appLogoIco,
    transparent: ops?.transparent || true,
    center: ops?.center || false,
    resizable: ops?.resizable || false,
    frame: ops?.frame || false,
    fullscreenable: ops?.fullscreenable || false,
    width: ops?.fullscreenable ? null : ops?.width || 108,
    height: ops?.fullscreenable ? null : ops?.height || 81,
    x: ops?.center ? null : ops?.x === 0 ? ops?.x : (ops?.x || screenWidth - 120),
    y: ops?.center ? null : ops?.y === 0 ? ops?.y : (ops?.y || screenHeight - 219),
    webPreferences: {
      preload,
      devTools: true,
      // 加载扩展必须启动该配置
      plugins: true,
    },
  });

  childWindow[arg]?.setAlwaysOnTop(true, "screen-saver");
  if (!ops || !ops.mouseEvents) {
    childWindow[arg]?.setIgnoreMouseEvents(true, { forward: true });
  } else {
    childWindow[arg]?.setIgnoreMouseEvents(false);
  }
  childWindow[arg]?.show();
  childWindow[arg]?.focus();

  if (VITE_DEV_SERVER_URL) {
    childWindow[arg].loadURL(
      `${VITE_DEV_SERVER_URL}#${arg}?isSecondWindow=true`
    );
  } else {
    childWindow[arg].loadFile(indexHtml, {
      hash: arg,
      query: { isSecondWindow: "true" },
    });
  }
  // 不在任务栏显示
  childWindow[arg]?.setSkipTaskbar(true);

  childWindow[arg]?.on("close", (e) => {
    e.preventDefault(); //先阻止一下默认行为，不然直接关了，提示框只会闪一下
    hideOtherWindow(arg);
  });

  getAllData(arg)
}

function getAllData(arg, immediately = false) {
  queryByConditions({
    db: myDb.db,
    tableName: tableName,
    conditions: {},
    callback: (err, data) => {
      let res = null
      if (err) {
        console.log(err, "err");
        res = "error";
      } else {
        res = objectArrayToObject(data);
      }
      if (immediately) {
        childWindow[arg].webContents.send("sync-data-to-other-window", {
          ...res,
        });
      } else {
        setTimeout(() => {
          childWindow[arg].webContents.send("sync-data-to-other-window", {
            ...res,
          });
        }, 2000);
      }
    },
  });
}

export function closeOtherWindow(arg) {
  if (childWindow) {
    try {
      childWindow[arg]?.close();
      childWindow[arg]?.destroy();
      childWindow[arg] = null;
    } catch (e) {
      // console.log(e, "closeOtherWindow")
    }
  }
}

export function hideOtherWindow(arg) {
  if (childWindow) {
    childWindow[arg]?.hide();
  }
}

export function showOtherWindow(arg) {
  if (childWindow) {
    childWindow[arg]?.show();
    childWindow[arg]?.focus();
  }
}

export function initNewWindow() {
  ipcMain.on("close-win", async (_, arg) => {
    closeOtherWindow(arg);
  });

  // 打开新窗口
  ipcMain.on("open-new-window", (_, newWindowName, ops: ObjectType) => {
    createOtherWindow(newWindowName, ops);
  });
  // 关闭新窗口
  ipcMain.on("close-new-window", (_, newWindowName) => {
    closeOtherWindow(newWindowName);
  });
  // 隐藏新窗口
  ipcMain.on("hide-new-window", (_, newWindowName) => {
    hideOtherWindow(newWindowName);
  });

  ipcMain.on("sync-data-to-other-window", (event, arg) => {
    // console.log(colors.bgGreen(arg), 'in sync-data-to-other-window');

    // 遍历window
    const allWindows = BrowserWindow.getAllWindows();
    // 获取发送事件的窗口id
    const sendId = event.sender.id;
    // 根据id匹配窗口
    allWindows.map((item) => {
      if (item.id != sendId && !item.isDestroyed()) {
        // 保持窗口处于活跃状态，避免假卡死
        item.showInactive();
        // 向匹配的窗口发送消息，同步数据
        item.webContents.send("sync-data-to-other-window", arg);
      }
    });
  });

  // 禁止窗口的鼠标穿透事件
  ipcMain.on("disable-mouse-click-through", (_, arg) => {
    console.log(colors.bgCyan(arg));
    if (typeof arg !== "string") return;
    if (childWindow[arg]) {
      childWindow[arg]?.setIgnoreMouseEvents(false);
    }
  });

  // 允许窗口的鼠标穿透事件
  ipcMain.on("enable-mouse-click-through", (_, arg) => {
    console.log(colors.bgCyan(arg), "enable-mouse-click-through");
    if (typeof arg !== "string") return;
    if (childWindow[arg]) {
      childWindow[arg]?.setIgnoreMouseEvents(true, { forward: true });
    }
  });
}
