import { BrowserWindow, ipcMain, screen } from "electron";
import colors from "colors";
import { getAllStore } from "./store.ts";
import {
  appLogoIco,
  indexHtml,
  preload,
  VITE_DEV_SERVER_URL,
} from "../variables.ts";

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

function createOtherWindow(arg: string) {
  getScreenInfo();
  if (childWindow[arg]) {
    childWindow[arg]?.show();
    childWindow[arg]?.focus();
    return;
  }
  childWindow[arg] = new BrowserWindow({
    title: "second window",
    icon: appLogoIco,
    transparent: true,
    resizable: false,
    frame: false,
    fullscreenable: false,
    width: 99,
    height: 81,
    x: screenWidth - 120,
    y: screenHeight - 219,
    webPreferences: {
      preload,
      devTools: true,
      // 加载扩展必须启动该配置
      plugins: true,
    },
  });

  childWindow[arg]?.setAlwaysOnTop(true, "screen-saver");
  childWindow[arg]?.setIgnoreMouseEvents(true, { forward: true });
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

  const store = getAllStore();
  setTimeout(() => {
    childWindow[arg].webContents.send("sync-data-to-other-window", {
      ...store,
    });
  }, 2000)
}

function closeOtherWindow(arg) {
  if (childWindow) {
    childWindow[arg]?.close();
    childWindow[arg]?.destroy();
    childWindow[arg] = null;
  }
}

export function initNewWindow() {
  ipcMain.on("close-win", async (_, arg) => {
    closeOtherWindow(arg);
  });

  // 打开新窗口
  ipcMain.on("open-new-window", (_, newWindowName) => {
    createOtherWindow(newWindowName);
  });
  // 关闭新窗口
  ipcMain.on("close-new-window", (_, newWindowName) => {
    closeOtherWindow(newWindowName);
  });

  ipcMain.on("sync-data-to-other-window", (event, arg) => {
    console.log(colors.bgGreen(arg));
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
