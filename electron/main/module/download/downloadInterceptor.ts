/**
 * 下载接管与剪贴板监视（主进程）
 * ------------------------------------------------------------------
 * - takeOverBrowserDownload：在 will-download 事件里把内置浏览器下载转交给
 *   自研多线程引擎（事件方负责 event.preventDefault() + item.cancel()，
 *   本模块负责收集 Cookie/UA 并创建引擎任务）；
 * - shouldTakeOverDownload：供 browserDownload.ts 判断是否接管（读引擎配置开关）；
 * - startClipboardMonitor：轮询系统剪贴板，发现「http 直链 + 可识别扩展名」时
 *   向主窗口发送 download:clipboard-detected，由下载器页面弹出新建确认。
 */
import { clipboard, DownloadItem, session } from "electron";
import { win } from "../mainWindow.ts";
import { downloadEngine } from "./downloadEngine.ts";
import { CATEGORY_EXT_MAP } from "./types.ts";

/** 全部可识别的下载扩展名集合（分类表拍平） */
const DOWNLOAD_EXTS = new Set(Object.values(CATEGORY_EXT_MAP).flat());

/**
 * 是否接管浏览器下载（browserDownload.ts 在 will-download 里调用）
 * @returns true 表示转交给下载引擎
 */
export function shouldTakeOverDownload(): boolean {
  return downloadEngine.config.takeOverBrowser;
}

/**
 * 接管一个原生下载项：收集会话 Cookie / User-Agent 后创建引擎任务
 * @param item 必填，will-download 里的 DownloadItem（已被 preventDefault + cancel）
 * @returns Promise，创建任务完成（失败仅打日志，不影响浏览器侧）
 */
export async function takeOverBrowserDownload(item: DownloadItem): Promise<void> {
  try {
    const url = item.getURL();
    if (!/^https?:\/\//i.test(url)) return;
    // 从下载项所属会话取 Cookie（支持登录后下载），拼成 Cookie 请求头
    let cookieHeader = "";
    try {
      // 当前 Electron 版本的 DownloadItem 类型声明未含 getSession，运行时存在，做兜底取会话
      const itemSession = (item as any).getSession?.() || session.defaultSession;
      const cookies = await itemSession.cookies.get({ url });
      cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    } catch (e) {
      console.warn("[downloader] 读取会话 Cookie 失败:", e);
    }
    const headers: Record<string, string> = {
      "User-Agent": (item as any).getSession?.()?.getUserAgent?.() || "Mozilla/5.0 jianli-downloader",
    };
    if (cookieHeader) headers.Cookie = cookieHeader;
    await downloadEngine.createTask(url, {
      filename: item.getFilename(),
      headers,
    });
  } catch (e) {
    console.error("[downloader] 接管浏览器下载失败:", e);
  }
}

/**
 * 从文本中提取「可下载」的 http(s) 直链
 * 规则：文本内第一个 http(s) URL，其 pathname 的扩展名命中分类表
 * @param text 必填，剪贴板文本
 * @returns 命中返回 URL，否则返回空字符串
 */
function extractDownloadUrl(text: string): string {
  if (!text || text.length > 2048) return "";
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return "";
  const url = match[0];
  const ext = (url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase();
  return ext && DOWNLOAD_EXTS.has(ext) ? url : "";
}

/**
 * 启动剪贴板监视（1s 轮询；配置 clipboardMonitor=false 时只空转不发送）
 * @returns 轮询 timer 的 stop 函数（测试/关停用）
 */
export function startClipboardMonitor(): () => void {
  // 上次轮询看到的剪贴板文本（只在文本变化时判定，避免重复弹窗）
  let lastText = "";
  const timer = setInterval(() => {
    try {
      const text = clipboard.readText();
      if (!text || text === lastText) return;
      lastText = text;
      // 开关关闭时静默跳过（仍更新 lastText 防止打开开关后补发旧内容）
      if (!downloadEngine.config.clipboardMonitor) return;
      const url = extractDownloadUrl(text);
      if (!url) return;
      win?.webContents.send("download:clipboard-detected", { url });
    } catch (e) {
      console.error("[downloader] 剪贴板监视异常:", e);
    }
  }, 1000);
  return () => clearInterval(timer);
}
