import {
  app,
  session,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  crashReporter,
} from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import colors from "colors";
import { readFileList, readJsonFileContent } from "./utils/common.ts";
import { initJob } from "./module/job.ts";
import { initFile } from "./module/dialog.ts";
import { initCrypto } from "./module/crypto.ts";
import { initStore } from "./module/store.ts";
import { initTray, destroyTray } from "./module/tray.ts";
import { initPoetData } from "./module/poetData.ts";

import {
  appName,
  __dirname,
  VITE_DEV_SERVER_URL,
  appLogoIco,
  preload,
  indexHtml,
} from "./variables.ts";

app.setName(appName);

let win: BrowserWindow | null = null;
let childWindow: Record<string, BrowserWindow | null> = {};

export function focusAppToTop() {
  win?.setAlwaysOnTop(true, "screen-saver");
  win?.setFullScreen(true);
  win?.show();
  win?.focus();
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

crashReporter.start({ submitURL: "", uploadToServer: false });

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

function isSetStartup(isStartup, hidden = false) {
  app.setLoginItemSettings({
    openAtLogin: isStartup,
    // 如果应用以管理员身份运行，设置此选项为true可避免UAC（用户账户控制）对话框在Windows上弹出。
    openAsHidden: hidden, // macOS特有的，当设置为true时，应用会隐藏式启动
  });
}

async function createWindow() {
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

  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }
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

  initPoetData()

  initJob({
    win,
    hideApp,
    focusAppToTop,
  });

  initStore();

  initFile(win);

  initCrypto();

  initTray({
    win,
    exitApp,
    hideApp,
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

app.whenReady().then(async () => {
  createWindow();
});

app.on("window-all-closed", (e) => {
  e.preventDefault(); //先阻止一下默认行为，不然直接关了，提示框只会闪一下
  exitApp();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length > 0) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

function createOtherWindow(arg: string) {
  if (childWindow[arg]) closeOtherWindow[arg]();
  childWindow[arg] = new BrowserWindow({
    title: "second window",
    icon: appLogoIco,
    transparent: true,
    resizable: true,
    frame: false,
    fullscreenable: false,
    height: 108,
    width: 226,
    webPreferences: {
      preload,
      devTools: true,
      // 加载扩展必须启动该配置
      plugins: true,
    },
  });

  childWindow[arg]?.setAlwaysOnTop(true, "screen-saver");
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
}

function closeOtherWindow(arg) {
  if (childWindow) {
    childWindow[arg].close();
    childWindow[arg]?.destroy();
  }
}

ipcMain.handle("close-win", async (_, arg) => {
  closeOtherWindow(arg);
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  createOtherWindow(arg);
});
