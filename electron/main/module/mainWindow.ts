import { BrowserWindow, ipcMain, app, globalShortcut } from "electron";
import {
  appLogoIco,
  preload,
  VITE_DEV_SERVER_URL,
  indexHtml,
} from "../variables.ts";
import { destroyTray } from "./tray.ts";

export let win: BrowserWindow | null;

export function focusAppToTop() {
  win?.setAlwaysOnTop(true, "screen-saver");
  win?.setFullScreen(true);
  win?.show();
  win?.focus();
}

export function isSetStartup(isStartup, hidden = false) {
  app.setLoginItemSettings({
    openAtLogin: isStartup,
    // 如果应用以管理员身份运行，设置此选项为true可避免UAC（用户账户控制）对话框在Windows上弹出。
    openAsHidden: hidden, // macOS特有的，当设置为true时，应用会隐藏式启动
  });
}

export function hideApp() {
  win?.setAlwaysOnTop(false);
  win?.hide();
}

export function exitApp() {
  globalShortcut.unregisterAll();
  destroyTray();
  app.removeAllListeners();
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length > 0) {
    for (let window of allWindows) {
      if (window && !window.isDestroyed()) {
        win.removeAllListeners();
        window.destroy();
        window = null;
      }
    }
  }
  app.exit();
}

function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    icon: appLogoIco,
    transparent: true,
    resizable: false,
    frame: false,
    fullscreenable: true,

    webPreferences: {
      preload,
      devTools: true,
      // 加载扩展必须启动该配置
      plugins: true,
    },
  });
}

function loadMainWindow() {
  createWindow();
  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }
}

export function initMainWindow() {
  loadMainWindow();
  ipcMain.on("quit-app", (e, fullScreen: string) => {
    exitApp();
  });
  ipcMain.on("max", (e, fullScreen: boolean) => {
    win!.setFullScreen(fullScreen);
    e.returnValue = fullScreen;
  });
  ipcMain.on("set-startup", (e, isStartup: boolean) => {
    //注意：非开发环境
    if (!VITE_DEV_SERVER_URL) {
      if (process.platform === "darwin") {
        isSetStartup(isStartup);
      } else {
        isSetStartup(isStartup);
      }
    } else {
      isSetStartup(isStartup);
    }
  });
  ipcMain.on("hide-app", (e) => {
    hideApp();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https:")) shell.openExternal(url);
      return { action: "deny" };
    });
    win.webContents.on("did-finish-load", () => {
      win?.webContents.send("main-process-message", new Date().toLocaleString());
      focusAppToTop();
    });
    win.on("close", (e) => {
      e.preventDefault(); //先阻止一下默认行为，不然直接关了，提示框只会闪一下
      win.webContents.send("before-close");
    });
}
