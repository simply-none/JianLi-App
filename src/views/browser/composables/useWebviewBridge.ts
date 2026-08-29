/**
 * 内置浏览器 - webview 实例桥（模块级单例）
 * ------------------------------------------------------------------
 * 职责：持有每个标签页对应的 webview DOM 元素，向 NavBar/菜单/查找条等
 * 组件提供「对指定标签的 webview 执行动作」的能力（导航/前进后退/刷新/
 * 缩放/开发者工具/页内查找），并转发 found-in-page 匹配结果。
 *
 * 为什么不用 store：store 只管数据；DOM 引用属视图层，放这里避免循环依赖。
 */
import type { Tab } from "@/store/useBrowser";
import useBrowser from "@/store/useBrowser";
import { isRecordableUrl, addHistory } from "../api/browserApi";

/** webview 元素类型（Electron WebviewTag 的鸭子类型子集，避免引入 electron 类型） */
type WebviewEl = any;

/** tabId -> webview 元素注册表 */
const registry = new Map<string, WebviewEl>();

/** 各标签最近一次记录进历史的地址（去重，避免同地址反复入库） */
const lastRecorded = new Map<string, string>();

/** found-in-page 订阅者列表 */
type FoundHandler = (payload: { tabId: string; activeMatchOrdinal: number; matches: number }) => void;
const foundHandlers = new Set<FoundHandler>();

// ==================== 注册表管理 ====================

/**
 * 注册 webview 元素
 * @param tabId 必填，标签 ID
 * @param el 必填，webview DOM 元素
 */
export function setWebview(tabId: string, el: WebviewEl) {
  if (el) registry.set(tabId, el);
}

/**
 * 注销 webview 元素（标签关闭/卸载时调用）
 * @param tabId 必填，标签 ID
 */
export function removeWebview(tabId: string) {
  registry.delete(tabId);
  lastRecorded.delete(tabId);
}

/**
 * 获取指定标签的 webview 元素
 * @param tabId 必填，标签 ID
 * @returns webview 元素；不存在返回 null
 */
export function getWebview(tabId: string): WebviewEl | null {
  const el = registry.get(tabId);
  // webview 可能已被页面移除（close 事件后），做可用性兜底
  return el && el.isConnected !== false ? el : null;
}

/**
 * 获取当前激活标签的 webview 元素
 * @returns webview 元素；不存在返回 null
 */
export function getActiveWebview(): WebviewEl | null {
  const store = useBrowser();
  return getWebview(store.activeTabId);
}

// ==================== 导航动作 ====================

/**
 * 导航指定标签到目标地址
 * - 标签已有 webview：调用 loadURL（由 did-navigate 事件回写 store）
 * - 标签尚未挂载 webview（如新标签页）：直接改 store 的 url，触发挂载时以 src 加载
 * @param tabId 必填，标签 ID
 * @param url 必填，目标地址
 */
export function navigateTab(tabId: string, url: string) {
  const store = useBrowser();
  const tab = store.tabs.find((t) => t.id === tabId);
  if (!tab || !url) return;
  const wv = getWebview(tabId);
  if (wv) {
    wv.loadURL(url);
  } else {
    // 未挂载 webview（新标签页/后台标签）：写 url 交给 WebViewPane 挂载加载
    store.updateTab(tabId, { url, isNewTab: url === "newtab", error: null, canBack: false, canForward: false });
  }
}

/**
 * 导航当前激活标签到目标地址
 * @param url 必填，目标地址
 */
export function navigateActiveTab(url: string) {
  const store = useBrowser();
  navigateTab(store.activeTabId, url);
}

/**
 * 后退
 * @param tabId 可选，标签 ID，默认激活标签
 * @returns 是否执行了动作
 */
export function goBack(tabId?: string): boolean {
  const store = useBrowser();
  const wv = getWebview(tabId || store.activeTabId);
  if (wv && wv.canGoBack()) {
    wv.goBack();
    return true;
  }
  return false;
}

/**
 * 前进
 * @param tabId 可选，标签 ID，默认激活标签
 * @returns 是否执行了动作
 */
export function goForward(tabId?: string): boolean {
  const store = useBrowser();
  const wv = getWebview(tabId || store.activeTabId);
  if (wv && wv.canGoForward()) {
    wv.goForward();
    return true;
  }
  return false;
}

/**
 * 重新加载当前页
 * @param tabId 可选，标签 ID，默认激活标签
 * @returns 是否执行了动作
 */
export function reload(tabId?: string): boolean {
  const store = useBrowser();
  const wv = getWebview(tabId || store.activeTabId);
  if (wv) {
    wv.reload();
    return true;
  }
  return false;
}

/**
 * 停止加载
 * @param tabId 可选，标签 ID，默认激活标签
 */
export function stopLoad(tabId?: string) {
  const store = useBrowser();
  const wv = getWebview(tabId || store.activeTabId);
  wv?.stop();
}

/**
 * 回到新标签页（主页）
 * @param tabId 可选，标签 ID，默认激活标签
 */
export function goHome(tabId?: string) {
  const store = useBrowser();
  navigateTab(tabId || store.activeTabId, "newtab");
}

// ==================== 缩放 ====================

/** 缩放步进（Electron zoomLevel 单位） */
const ZOOM_STEP = 0.5;
/** 缩放上下限（对应约 43% ~ 300%） */
const ZOOM_MIN = -3;
const ZOOM_MAX = 3;

/**
 * 缩放指定标签
 * @param tabId 必填，标签 ID
 * @param delta 可选，缩放变化量（+放大/-缩小），传 0 表示重置为 100%
 */
export function applyZoom(tabId: string, delta: number) {
  const store = useBrowser();
  const tab = store.tabs.find((t) => t.id === tabId);
  const wv = getWebview(tabId);
  if (!tab || !wv) return;
  const next = delta === 0 ? 0 : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, tab.zoomLevel + delta));
  tab.zoomLevel = next;
  try {
    wv.setZoomLevel(next);
  } catch (e) {
    console.error("[browser] 设置缩放失败:", e);
  }
}

/**
 * 缩放级别转百分比显示值
 * @param zoomLevel 必填，Electron zoomLevel
 * @returns 百分比数字（如 125 表示 125%）
 */
export function zoomToPercent(zoomLevel: number): number {
  return Math.round(Math.pow(1.2, zoomLevel) * 100);
}

// ==================== 开发者工具 ====================

/**
 * 切换指定标签的开发者工具
 * @param tabId 可选，标签 ID，默认激活标签
 */
export function toggleDevTools(tabId?: string) {
  const store = useBrowser();
  const wv = getWebview(tabId || store.activeTabId);
  if (!wv) return;
  if (wv.isDevToolsOpened()) {
    wv.closeDevTools();
  } else {
    wv.openDevTools();
  }
}

// ==================== 页内查找 ====================

/**
 * 页内查找
 * @param tabId 可选，标签 ID，默认激活标签
 * @param text 必填，查找关键词；空串则停止查找
 * @param forward 可选，是否向下查找，默认 true
 */
export function findInPage(tabId: string | undefined, text: string, forward: boolean = true) {
  const store = useBrowser();
  const wv = getWebview(tabId || store.activeTabId);
  if (!wv) return;
  if (!text) {
    wv.stopFindInPage("clearSelection");
    return;
  }
  wv.findInPage(text, { forward, findNext: true });
}

/**
 * 停止页内查找并清除高亮
 * @param tabId 可选，标签 ID，默认激活标签
 */
export function stopFindInPage(tabId?: string) {
  const store = useBrowser();
  const wv = getWebview(tabId || store.activeTabId);
  wv?.stopFindInPage("clearSelection");
}

/**
 * 订阅 found-in-page 结果（FindInPage 组件用）
 * @param handler 必填，回调
 * @returns 取消订阅函数
 */
export function onFoundInPage(handler: FoundHandler): () => void {
  foundHandlers.add(handler);
  return () => foundHandlers.delete(handler);
}

/**
 * 分发 found-in-page 事件（WebViewPane 内部调用）
 * @param tabId 必填，标签 ID
 * @param result 必填，事件结果对象
 */
export function emitFoundInPage(tabId: string, result: any) {
  const payload = {
    tabId,
    activeMatchOrdinal: result?.activeMatchOrdinal ?? 0,
    matches: result?.matches ?? 0,
  };
  foundHandlers.forEach((fn) => fn(payload));
}

// ==================== UA 切换 ====================

/** 各 UA 模式对应的 User-Agent（mobile 为 iPhone Safari；desktop 为固定 Chrome 桌面 UA） */
export const UA_STRINGS: Record<string, string> = {
  mobile:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

/**
 * 获取标签 UA 模式对应的 User-Agent（default 返回空串表示不覆盖）
 * @param mode 必填，UA 模式
 * @returns UA 字符串；default 返回空串
 */
export function uaStringFor(mode: string): string {
  return UA_STRINGS[mode] || "";
}

/**
 * 对指定标签应用其 UA 模式（default 恢复默认 UA）
 * @param tabId 必填，标签 ID
 * @returns 是否成功应用
 */
export function applyTabUserAgent(tabId: string): boolean {
  const store = useBrowser();
  const tab = store.tabs.find((t) => t.id === tabId);
  const wv = getWebview(tabId);
  if (!tab || !wv) return false;
  try {
    const ua = uaStringFor(tab.uaMode);
    wv.setUserAgent(ua);
    return true;
  } catch (e) {
    console.error("[browser] 设置 UA 失败:", e);
    return false;
  }
}

// ==================== 页面内容读取 ====================

/**
 * 读取指定标签页面中用户选中的文本（供「保存到笔记」等功能用）
 * @param tabId 必填，标签 ID
 * @returns 选中文本；无选中或失败返回空串
 */
export async function getPageSelection(tabId: string): Promise<string> {
  const wv = getWebview(tabId);
  if (!wv) return "";
  try {
    const text = await wv.executeJavaScript("window.getSelection().toString()");
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}

// ==================== 资源下载（嗅探面板用） ====================

/**
 * 让指定标签的 webview 触发资源下载（经主进程 browserDownload 管线落盘）
 * @param tabId 可选，标签 ID，默认激活标签
 * @param url 必填，资源地址
 * @returns 是否成功触发
 */
export function downloadResource(tabId: string | undefined, url: string): boolean {
  const store = useBrowser();
  const wv = getWebview(tabId || store.activeTabId);
  if (!wv || !url) return false;
  try {
    wv.downloadURL(url);
    return true;
  } catch (e) {
    console.error("[browser] 触发下载失败:", e);
    return false;
  }
}

// ==================== 历史记录（供 WebViewPane 事件回调） ====================

/**
 * 记录访问历史（同标签连续同地址去重）
 * @param tabId 必填，标签 ID
 * @param url 必填，地址
 * @param title 可选，标题
 */
export function recordHistory(tabId: string, url: string, title: string = "") {
  if (!isRecordableUrl(url)) return;
  if (lastRecorded.get(tabId) === url) return;
  lastRecorded.set(tabId, url);
  addHistory(url, title);
}

/**
 * 刷新指定标签的前进/后退可用状态到 store
 * @param tabId 必填，标签 ID
 * @param wv 可选，webview 元素，缺省从注册表取
 */
export function refreshNavState(tabId: string, wv?: WebviewEl) {
  const store = useBrowser();
  const tab: Tab | undefined = store.tabs.find((t) => t.id === tabId);
  const el = wv || getWebview(tabId);
  if (!tab || !el) return;
  try {
    tab.canBack = !!el.canGoBack();
    tab.canForward = !!el.canGoForward();
  } catch {
    // webview 尚未就绪时忽略
  }
}
