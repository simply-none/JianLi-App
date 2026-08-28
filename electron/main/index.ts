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
import { registerJlocalProtocol, registerJlocalProtocolBefore } from "./module/protocol.ts";
import { initSqlite } from "./module/sql.ts";
import { initNewSqlite } from "./module/newSql.ts";
import { initNewReminder } from "./module/newReminder.ts";
import { appName } from "./variables.ts";
import { initRegisterShortcut } from "./module/registerShortcut.ts";
import { initSys } from "./module/sys.ts";
import { initLog } from "./module/log.ts";
import { initAutoUpdate } from "./module/autoUpdate.ts";
import { initWeather } from "./module/weather.ts";
import { initLocation } from "./module/location.ts";
import { initBing } from "./module/bing.ts";
import { initTTS } from "./module/tts.ts";
import { initEbook } from "./module/ebook.ts";
import { initScreenshot } from "./module/screenshot.ts";
import { initStock } from "./module/stock.ts";

registerJlocalProtocolBefore()


app.setName(appName);
app.commandLine.appendSwitch("lang", "zh-CN");

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
  // 注册自定义协议处理器（必须在创建窗口前完成，否则打包后页面加载时
  // jlocal:// 请求会因 handler 未注册而报 ERR_UNKNOWN_URL_SCHEME）
  registerJlocalProtocol();
  // 主窗口
  initMainWindow();
  // 日志
  initLog();
  // 数据库
  await initSqlite();
  // 高性能数据库
  await initNewSqlite();
  // 全新提醒引擎（定点/周期/多状态），依赖 newSql
  await initNewReminder();
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
  // 剪贴板（异步：需先补齐新增列，失败不应阻塞启动）
  initClipboard().catch((err) => console.error("initClipboard error:", err));
  // 快捷键注册
  initRegisterShortcut();
  // 系统相关
  initSys();
  // 自动更新
  initAutoUpdate();
  // 天气模块
  initWeather();
  // 定位模块
  initLocation();
  // Bing 图片模块
  initBing();
  // TTS 语音合成模块
  initTTS();
  // 电子书阅读模块
  await initEbook();
  // 截图模块
  initScreenshot();
  // 股票查询模块（TickFlow，主进程查询，依赖数据库基础表）
  initStock();
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
