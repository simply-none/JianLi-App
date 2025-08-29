import { app, BrowserWindow, crashReporter } from "electron";
import os from "node:os";
import { initJob } from "./module/job.ts";
import { initFile } from "./module/dialog.ts";
import { initCrypto } from "./module/crypto.ts";
import { initStore } from "./module/store.ts";
import { initTray } from "./module/tray.ts";
import { initPoetData } from "./module/poetData.ts";
import { initMainWindow, win } from "./module/mainWindow.ts";
import { initNewWindow } from "./module/newWindow.ts";
import { initApiTest } from "./module/apiTest.ts";
import { initClipboard } from "./module/clipboard.ts";
import { registerJlocalProtocol } from "./module/protocol.ts";
import { initSqlite } from "./module/sql.ts";
import { appName } from "./variables.ts";

app.setName(appName);

crashReporter.start({ submitURL: "", uploadToServer: false });

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

async function createWindow() {
  // 主窗口
  initMainWindow();
  // 数据库
  initSqlite();
  // 诗词数据
  initPoetData();
  // 定时任务（番茄钟）
  initJob();
  // 数据缓存
  initStore();
  // 文件相关
  initFile();
  // 数据加密解密
  initCrypto();
  // 托盘图标
  initTray();
  // 测试接口
  initApiTest();
  // 新窗口相关
  initNewWindow();
  // 注册协议
  registerJlocalProtocol();
  // 剪贴板
  initClipboard();
}

app.whenReady().then(async () => {
  createWindow();
});

app.on("second-instance", () => {
  if (win) {
    // 只允许打开一个窗口
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  // 只允许打开一个窗口
  if (allWindows.length > 0) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});
