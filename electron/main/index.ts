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
import { initNoteSlip } from "./module/noteSlip.ts";
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
    // P1-6 小纸条（依赖 sync 的 registerDataRoute，必须排在 sync 之后）
    ['noteSlip', initNoteSlip],
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
  // ===== DB 之后的模块分组并行初始化（P1 启动优化）=====
  // 同一泳道内保持既有先后依赖；不同泳道之间无依赖，Promise.all 并行。
  // 泳道内任一模块失败仅跳过该模块（与 runDeferredInits 行为一致），不中断启动。
  const runLane = (lane: [string, () => void | Promise<void>][]) =>
    lane.reduce(
      (chain, [name, fn]) =>
        chain.then(() =>
          timeInit(name, fn).catch((e) =>
            console.error(`[init] ${name} 初始化异常，已跳过:`, e),
          ),
        ),
      Promise.resolve(),
    );

  // 泳道A：提醒/番茄钟/重复任务集群（initRecurrence 必须在 initJob 之后，见 risks #17）
  const laneA: [string, () => void | Promise<void>][] = [
    ['newReminder', initNewReminder],
    ['job', initJob],
    ['recurrence', initRecurrence],
  ];
  // 泳道B：倒计时（独立调度 + 自有表）+ 诗词数据
  const laneB: [string, () => void | Promise<void>][] = [
    ['countdown', initCountdown],
    ['poetData', initPoetData],
  ];
  // 泳道C：数据缓存 + 备份恢复 + 整库导入导出（依赖 newSql 连接池，已在其前完成）
  const laneC: [string, () => void | Promise<void>][] = [
    ['store', initStore],
    ['backup', initBackup],
    ['dataManagement', initDataManagement],
  ];
  // 泳道D：文件/资源 + 安全锁集群。
  // 安全类 IPC（file-vault:status 等）须在渲染端挂载前就绪——并行只会让它们更早完成，
  // 不会比原串行链路更晚（原链路在它们前面还有十几个模块）。
  const laneD: [string, () => void | Promise<void>][] = [
    ['file', initFile],
    ['resource', initResource],
    ['appLock', initAppLock],
    ['safetyProtection', initSafetyProtection],
    ['twoFactor', initTwoFactor],
    ['passwordVault', initPasswordVault],
    ['fileVault', initFileVault],
  ];
  // 修复历史数据：确保待办表 key 列具备唯一索引（不阻塞）
  ensureTableExists('todo_list', undefined, 'key', { primaryKeyType: 'TEXT' }).catch((e) =>
    console.warn('ensure todo_list key index failed:', e),
  );
  ensureTableExists('todo_tags', undefined, 'id', { primaryKeyType: 'INTEGER' }).catch((e) =>
    console.warn('ensure todo_tags id index failed:', e),
  );
  await Promise.all([runLane(laneA), runLane(laneB), runLane(laneC), runLane(laneD)]);
  // 托盘图标（依赖窗口，保持串行）
  await timeInit('tray', initTray);
  // 内置浏览器站点权限管理依赖的窗口 getter（轻量，提前设置）
  setPermissionWindowGetter(() => win);
  // ===== 其余非关键模块：两泳道并行（完成后进入延迟初始化队列）=====
  // 泳道E：轻量 IPC 注册类
  const laneE: [string, () => void | Promise<void>][] = [
    ['systemInfo', initSystemInfo],
    ['netRequest', initNetRequest],
    ['newWindow', initNewWindow],
    // 剪贴板（异步：需先补齐新增列，失败不应阻塞启动）
    ['clipboard', () => initClipboard().catch((err) => console.error('initClipboard error:', err))],
    ['registerShortcut', initRegisterShortcut],
    ['autoUpdate', initAutoUpdate],
    ['location', initLocation],
    ['bing', initBing],
    ['tts', initTTS],
  ];
  // 泳道F：可能带网络/IO 的模块，隔离在同泳道串行，避免启动期网络风暴
  const laneF: [string, () => void | Promise<void>][] = [
    ['weather', initWeather],
    ['crawler', initCrawler],
    // 数据获取模块（Puppeteer 任务化采集引擎，独立于天气爬虫；按需懒启动）
    ['dataAcquisition', initDataAcquisition],
  ];
  await Promise.all([runLane(laneE), runLane(laneF)]);
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
