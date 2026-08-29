/**
 * 下载器模块入口（主进程）
 * ------------------------------------------------------------------
 * initDownloader()：引擎初始化（配置/任务恢复）→ IPC 注册 → 剪贴板监视。
 * 浏览器下载接管不在此挂钩：由 browserDownload.ts 的 will-download 事件
 * 调用 shouldTakeOverDownload() 判断后委托 takeOverBrowserDownload()，
 * 避免同一 session 重复挂 will-download 监听。
 */
import { downloadEngine } from "./downloadEngine.ts";
import { registerDownloadIpc } from "./downloadIpc.ts";
import { startClipboardMonitor } from "./downloadInterceptor.ts";

/** 剪贴板监视停止函数（模块级，暂无关停场景，保留以便扩展） */
let stopMonitor: (() => void) | null = null;

/**
 * 初始化下载器模块（在 createWindow 中调用一次）
 * @returns Promise，初始化完成（失败不抛出，保证不阻塞应用启动）
 */
export async function initDownloader(): Promise<void> {
  try {
    await downloadEngine.init();
    registerDownloadIpc();
    stopMonitor = startClipboardMonitor();
    console.log("[downloader] 下载器模块初始化完成");
  } catch (e) {
    console.error("[downloader] 初始化失败:", e);
  }
}
