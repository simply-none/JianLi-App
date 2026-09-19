import { app, BrowserWindow, crashReporter, ipcMain } from "electron";
import os from "node:os";
import { initJob } from "./module/job.ts";
import { initRecurrence } from "./module/recurrence.ts";
import { initFile } from "./module/dialog.ts";
import { initStore } from "./module/store.ts";
import { initBackup } from "./module/backup.ts";
import { initAppLock } from "./module/appLock.ts";
import { initTray } from "./module/tray.ts";
import { initPoetData } from "./module/poetData.ts";
import { initMainWindow, win, showApp } from "./module/mainWindow.ts";
import { initNewWindow } from "./module/newWindow.ts";
import { initSystemInfo } from "./module/systemInfo.ts";
import { initNetRequest } from "./module/netRequest.ts";
import { initClipboard } from "./module/clipboard.ts";
import { registerJlocalProtocol, registerJlocalProtocolBefore } from "./module/protocol.ts";
import { initNewSqlite, ensureTableExists } from "./module/newSql.ts";
import { initNewReminder } from "./module/newReminder.ts";
import { initCountdown } from "./module/countdown.ts";
import { appName } from "./variables.ts";
import { initRegisterShortcut } from "./module/registerShortcut.ts";
import { initSys } from "./module/sys.ts";
import { initLog } from "./module/log.ts";
import { initAutoUpdate } from "./module/autoUpdate.ts";
import { initWeather } from "./module/weather.ts";
import { initCrawler } from "./module/crawler.ts";
import { initDataAcquisition } from "./module/dataAcquisition/index.ts";
import { initLocation } from "./module/location.ts";
import { initBing } from "./module/bing.ts";
import { initTTS } from "./module/tts.ts";
import { initEbook } from "./module/ebook.ts";
import { initEbookTransfer } from "./module/ebookTransfer.ts";
import { initRemoteControl } from "./module/remoteControl.ts";
import { initScreenshot } from "./module/screenshot.ts";
import { initStock } from "./module/stock.ts";
import { initSinaFinance } from "./module/sinaFinance.ts";
import { initBrowserDownload } from "./module/browserDownload.ts";
import { initBrowserSniffer } from "./module/browserSniffer.ts";
import { initBrowserYtDlp } from "./module/browserYtDlp.ts";
import { initBrowserPermission, setPermissionWindowGetter } from "./module/browserPermission.ts";
import { initDownloader } from "./module/download/index.ts";
import { initResource } from "./module/resource.ts";
import { initResume } from "./module/resume.ts";
import { initQrCode } from "./module/qrcode.ts";
import { initTwoFactor } from "./module/twoFactor.ts";
import { initPasswordVault } from "./module/passwordVault.ts";
import { initFileVault } from "./module/fileVault.ts";
import { initSync } from "./module/sync/syncModule.ts";
import { initTransfer } from "./module/transfer/transferModule.ts";
import { initFerry } from "./module/ferry.ts";
import {
  registerShellMenu,
  initShellMenu,
  parseCliFiles,
  queueCli,
  flushPending,
} from "./module/shellMenu.ts";
import { initPdf } from "./module/pdf.ts";
import { initSafetyProtection } from "./module/safetyProtection.ts";
import { initDataManagement } from "./module/dataManagement.ts";

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

/** 启动性能埋点：包裹一次 init 调用并打印耗时（P0 启动优化，用于定位冷启动瓶颈） */
async function timeInit(name: string, fn: () => void | Promise<void>): Promise<void> {
  const t = Date.now();
  try {
    await fn();
  } catch (e) {
    console.error(`[init] ${name} 失败 (${Date.now() - t}ms):`, e);
    throw e;
  }
  console.log(`[init] ${name}: ${Date.now() - t}ms`);
}

/** 让出事件循环一帧，使主窗口有机会绘制 / 响应用户输入（P1 启动优化） */
function yieldToEventLoop(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/**
 * 非关键模块初始化：延迟到首屏之后分批执行（P1 启动优化）。
 * 这些模块仅注册 IPC / 启动可选引擎，不阻塞首屏；每个之间让出事件循环，
 * 使主窗口启动后即可交互，避免原先 ~5s 的主线程冻结。
 * 任一模块失败仅跳过该模块（与原行为一致：多数 init 内部已 try/catch），不中断其余初始化。
 */
async function runDeferredInits(): Promise<void> {
  const steps: [string, () => void | Promise<void>][] = [
    ['ebook', initEbook],
    ['ebookTransfer', initEbookTransfer],
    ['screenshot', initScreenshot],
    ['sys', initSys],
    ['stock', initStock],
    ['sinaFinance', initSinaFinance],
    ['browserDownload', initBrowserDownload],
    ['browserSniffer', initBrowserSniffer],
    ['browserYtDlp', initBrowserYtDlp],
    ['browserPermission', initBrowserPermission],
    ['downloader', initDownloader],
    ['resume', initResume],
    ['qrCode', initQrCode],
    ['sync', initSync],
    ['transfer', initTransfer],
    ['ferry', initFerry],
    ['remoteControl', initRemoteControl],
    ['shellMenuIpc', initShellMenu],
    ['pdf', initPdf],
  ];
  for (const [name, fn] of steps) {
    try {
      await timeInit(name, fn);
    } catch (e) {
      console.error(`[deferredInits] ${name} 初始化异常，已跳过:`, e);
    }
    await yieldToEventLoop();
  }
}

async function createWindow() {
  // 注册自定义协议处理器（必须在创建窗口前完成，否则打包后页面加载时
  // jlocal:// 请求会因 handler 未注册而报 ERR_UNKNOWN_URL_SCHEME）
  registerJlocalProtocol();
  // 主窗口（创建并 show）；随后立即让出一帧，确保首屏先绘制，再开始后续初始化
  initMainWindow();
  await yieldToEventLoop();
  // 日志
  await timeInit('log', initLog);
  // 数据库（统一由 newSql 初始化，包含 db.sqlite 与打包宋词库 shiciDb）
  await timeInit('newSqlite', initNewSqlite);
  // 全新提醒引擎（定点/周期/多状态），依赖 newSql
  await timeInit('newReminder', initNewReminder);
  // 倒计时模块（独立调度 + 自有表 countdown）
  await timeInit('countdown', initCountdown);
  // 诗词数据
  await timeInit('poetData', initPoetData);
  // 定时任务（番茄钟）
  await timeInit('job', initJob);
  // 重复任务引擎（启动扫描 + 每日 00:00 生成实例）
  await timeInit('recurrence', initRecurrence);
  // 修复历史数据：确保待办表 key 列具备唯一索引（不阻塞）
  ensureTableExists('todo_list', undefined, 'key', { primaryKeyType: 'TEXT' }).catch((e) =>
    console.warn('ensure todo_list key index failed:', e),
  );
  ensureTableExists('todo_tags', undefined, 'id', { primaryKeyType: 'INTEGER' }).catch((e) =>
    console.warn('ensure todo_tags id index failed:', e),
  );
  // 数据缓存
  await timeInit('store', initStore);
  // 备份与恢复 + 数据导出中心（依赖 newSql 连接池，须在其后初始化）
  await timeInit('backup', initBackup);
  // 整库 SQLite 导入/导出（移动端互通，依赖 newSql 连接池）
  await timeInit('dataManagement', initDataManagement);
  // 文件相关
  await timeInit('file', initFile);
  // 资源管理（文本预览读取 + 物理文件删除）
  await timeInit('resource', initResource);
  // 应用锁 / 隐私模式（依赖 DB）
  await timeInit('appLock', initAppLock);
  // 安全保护（密保）：与 2FA/应用锁共用 vault/crypto 加密架构，密钥来源为设备绑定主密钥
  await timeInit('safetyProtection', initSafetyProtection);
  // ===== 安全/锁类 IPC 提前注册（P1 启动优化·修复回归）=====
  // 渲染端启动即查询保险箱/锁状态（file-vault:status 等）。P1 让主线程变自由后，
  // 渲染端会提前发 IPC，若 handler 注册太晚会报 "No handler registered"。
  // 故紧跟 DB 之后立即注册这些安全类 handler，确保渲染端挂载前已就绪。
  await timeInit('twoFactor', initTwoFactor);
  await timeInit('passwordVault', initPasswordVault);
  await timeInit('fileVault', initFileVault);
  // 托盘图标
  await timeInit('tray', initTray);
  // 系统信息监控
  await timeInit('systemInfo', initSystemInfo);
  // 网络请求工作台（Postman 风格）
  await timeInit('netRequest', initNetRequest);
  // 新窗口相关
  await timeInit('newWindow', initNewWindow);
  // 内置浏览器站点权限管理依赖的窗口 getter（轻量，提前设置）
  setPermissionWindowGetter(() => win);
  // 剪贴板（异步：需先补齐新增列，失败不应阻塞启动）
  await timeInit('clipboard', () => initClipboard().catch((err) => console.error('initClipboard error:', err)));
  // 快捷键注册
  await timeInit('registerShortcut', initRegisterShortcut);
  // 系统相关（字体枚举等较重，移出关键路径延迟到首屏之后；见 runDeferredInits）
  // 自动更新
  await timeInit('autoUpdate', initAutoUpdate);
  // 天气模块
  await timeInit('weather', initWeather);
  // 新爬虫工具（通用网页爬取）
  await timeInit('crawler', initCrawler);
  // 数据获取模块（Puppeteer 任务化采集引擎，独立于天气爬虫）
  await timeInit('dataAcquisition', initDataAcquisition);
  // 定位模块
  await timeInit('location', initLocation);
  // Bing 图片模块
  await timeInit('bing', initBing);
  // TTS 语音合成模块
  await timeInit('tts', initTTS);
  // ===== 非关键模块：延迟到首屏之后分批初始化（P1 启动优化）=====
  // 下列模块仅注册 IPC / 启动可选引擎，不阻塞首屏；延迟到下一 tick 执行，
  // 且每个初始化之间让出事件循环，使主窗口启动后即可交互，消除原先 ~5s 的主线程冻结。
  // 改主进程须重启 Electron 才能生效。
  setTimeout(() => {
    runDeferredInits().catch((e) => console.error('[deferredInits] 执行异常:', e));
  }, 0);
  // ===== 资源管理器右键菜单注册：延迟到系统打开后的空闲期，由 Worker 线程静默执行（方案 B）=====
  // 注册表写入（reg/powershell，约上百次子进程调用）全部交给 shellMenuWorker 在 worker_threads 异步跑，
  // 主线程事件循环全程不被冻结，彻底消除右键菜单注册导致的鼠标/窗口卡顿；因此每次启动都跑也无害，
  // 无需 basic_info 的「已注册」marker 跳过逻辑（那套 DB 跳过逻辑已移除）。
  setTimeout(() => {
    void (async () => {
      try {
        console.log('[shellMenu] 空闲期静默注册右键菜单（Worker）...');
        await registerShellMenu();
        console.log('[shellMenu] 右键菜单注册完成');
      } catch (e) {
        console.error('[shellMenu] 空闲期注册异常（已跳过，不影响启动）:', e);
      }
    })();
  }, 3000);
}

app.whenReady().then(async () => {
  // 首次启动：若通过资源管理器右键带文件参数启动，解析并入队，待渲染端就绪后下发
  queueCli(
    parseCliFiles(process.argv, {
      exePath: process.execPath,
      appDir: app.getAppPath(),
    }),
  );
  createWindow();
});

// 渲染端主窗口就绪后，把排队的右键文件参数发给它（解决首启「发早于监听注册」的竞态）
ipcMain.on('app:cli-ready', () => {
  if (win) flushPending(win);
});

app.on("second-instance", (_e, argv) => {
  // 资源管理器右键多选会多次触发本事件，聚合后一次性下发
  const items = parseCliFiles(argv, {
    exePath: process.execPath,
    appDir: app.getAppPath(),
  });
  if (items.length) queueCli(items);
  if (win) {
    // 只允许打开一个窗口。
    // 注意：应用可能只是被「隐藏到托盘」(win.hide()) 而非最小化，此时
    // isMinimized() 为 false、focus() 无法让隐藏窗口重新可见，导致右键触发的解密
    // /加密/安全删除弹窗在后台静默执行、用户完全看不到。
    // 因此改用 showApp()：无论最小化还是隐藏到托盘，都先确保主窗口可见并置前，
    // 再下发右键参数。
    showApp();
    flushPending(win);
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
