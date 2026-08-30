import { app, BrowserWindow, crashReporter } from "electron";
import os from "node:os";
import { initJob } from "./module/job.ts";
import { initRecurrence } from "./module/recurrence.ts";
import { initFile } from "./module/dialog.ts";
import { initCrypto } from "./module/crypto.ts";
import { initStore } from "./module/store.ts";
import { initBackup } from "./module/backup.ts";
import { initTray } from "./module/tray.ts";
import { initPoetData } from "./module/poetData.ts";
import { initMainWindow, win } from "./module/mainWindow.ts";
import { initNewWindow } from "./module/newWindow.ts";
import { initSystemInfo } from "./module/systemInfo.ts";
import { initNetRequest } from "./module/netRequest.ts";
import { initClipboard } from "./module/clipboard.ts";
import { registerJlocalProtocol, registerJlocalProtocolBefore } from "./module/protocol.ts";
import { initSqlite } from "./module/sql.ts";
import { initNewSqlite, ensureTableExists } from "./module/newSql.ts";
import { initNewReminder } from "./module/newReminder.ts";
import { appName } from "./variables.ts";
import { initRegisterShortcut } from "./module/registerShortcut.ts";
import { initSys } from "./module/sys.ts";
import { initLog } from "./module/log.ts";
import { initAutoUpdate } from "./module/autoUpdate.ts";
import { initWeather } from "./module/weather.ts";
import { initCrawler } from "./module/crawler.ts";
import { initLocation } from "./module/location.ts";
import { initBing } from "./module/bing.ts";
import { initTTS } from "./module/tts.ts";
import { initEbook } from "./module/ebook.ts";
import { initScreenshot } from "./module/screenshot.ts";
import { initStock } from "./module/stock.ts";
import { initBrowserDownload } from "./module/browserDownload.ts";
import { initBrowserSniffer } from "./module/browserSniffer.ts";
import { initBrowserYtDlp } from "./module/browserYtDlp.ts";
import { initBrowserPermission, setPermissionWindowGetter } from "./module/browserPermission.ts";
import { initDownloader } from "./module/download/index.ts";

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
  // 重复任务引擎（启动扫描 + 每日 00:00 生成实例）
  initRecurrence();
  // 修复历史数据：确保待办表 key 列具备唯一索引，并清理重构前遗留的重复记录
  // （旧表常出现「key 列已存在但无唯一约束」，导致 upsert 退化为重复 INSERT —— 编辑变新增）
  ensureTableExists('todo_list', undefined, 'key', { primaryKeyType: 'TEXT' }).catch((e) =>
    console.warn('ensure todo_list key index failed:', e),
  );
  ensureTableExists('todo_tags', undefined, 'id', { primaryKeyType: 'INTEGER' }).catch((e) =>
    console.warn('ensure todo_tags id index failed:', e),
  );
  // 数据缓存
  initStore();
  // 备份与恢复 + 数据导出中心（依赖 newSql 连接池，须在其后初始化）
  initBackup();
  // 文件相关
  initFile();
  // 数据加密解密
  initCrypto();
  // 托盘图标
  initTray();
  // 系统信息监控
  initSystemInfo();
  // 网络请求工作台（Postman 风格）
  initNetRequest();
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
  // 新爬虫工具（通用网页爬取）
  initCrawler();
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
  // 内置浏览器下载管理（拦截 webview 会话的 will-download）
  initBrowserDownload();
  // 内置浏览器资源嗅探（webRequest 挂钩 persist:browser 会话）
  initBrowserSniffer();
  // 内置浏览器 yt-dlp 视频解析/下载引擎
  initBrowserYtDlp();
  // 内置浏览器站点权限管理（persist:browser 会话权限请求拦截）
  setPermissionWindowGetter(() => win);
  initBrowserPermission();
  // 系统级下载器（多线程分段引擎，接管浏览器下载 + 剪贴板监视）
  await initDownloader();
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
