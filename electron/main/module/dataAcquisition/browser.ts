/**
 * 【数据获取】独立浏览器实例管理
 * ------------------------------------------------------------------
 * 与天气爬虫 crawler.ts 完全独立（各自持有浏览器实例，互不干扰）：
 * 1. 共享无头浏览器 + 信号量并发上限（默认 3），断连自动重建
 * 2. 反爬基础注入：抹除 navigator.webdriver、伪造 plugins/languages
 * 3. 有头登录会话：弹出真实 Chrome 窗口供用户手动登录，
 *    完成后保存 Cookie 到 electron-store（scraper-login:{档案名}）
 * 4. 应用退出时关闭全部浏览器，避免残留 Chrome 进程
 */
import puppeteer from "puppeteer";
import { store } from "../store.ts";
import type { ScraperSettings } from "./types.ts";

/** 全局设置默认值 */
export const DEFAULT_SETTINGS: ScraperSettings = {
  headless: true,
  proxy: "",
  maxConcurrent: 3,
  timeout: 30000,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** electron-store 中全局设置的键名 */
const SETTINGS_KEY = "scraper-settings";
/** electron-store 中登录 Cookie 档案的键名前缀 */
export const LOGIN_PROFILE_PREFIX = "scraper-login:";

/**
 * 读取全局设置（合并默认值，防脏数据）
 * @returns 完整设置对象
 */
export function getSettings(): ScraperSettings {
  try {
    const saved = store.get(SETTINGS_KEY) as Partial<ScraperSettings> | undefined;
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * 保存全局设置（合并后写入 electron-store）
 * @param patch 待更新的设置字段
 * @returns 保存后的完整设置对象
 */
export function saveSettings(patch: Partial<ScraperSettings>): ScraperSettings {
  const merged = { ...getSettings(), ...(patch || {}) };
  store.set(SETTINGS_KEY, merged);
  // 无头/代理变化需要重启浏览器才能生效，直接关闭共享实例，下次任务自动按新配置重建
  if (patch.headless !== undefined || patch.proxy !== undefined) {
    closeSharedBrowser();
  }
  return merged;
}

/** 共享无头浏览器实例（断连自动重建） */
let sharedBrowser: puppeteer.Browser | null = null;
/** 创建共享实例时使用的启动配置（用于检测代理/无头变化后重建） */
let launchSignature = "";

/**
 * 生成启动配置签名（无头 + 代理），变化时需要重建实例
 * @param settings 全局设置
 * @returns 签名字符串
 */
function buildSignature(settings: ScraperSettings): string {
  return `${settings.headless}|${settings.proxy}`;
}

/**
 * 获取（或按需重建）共享无头浏览器实例
 * @returns 可用浏览器实例
 * @throws {Error} 浏览器启动失败时抛出
 */
async function getSharedBrowser(): Promise<puppeteer.Browser> {
  const settings = getSettings();
  const signature = buildSignature(settings);
  // 配置变化：关闭旧实例重建
  if (sharedBrowser && sharedBrowser.connected && signature !== launchSignature) {
    await closeSharedBrowser();
  }
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch { /* 忽略旧实例关闭异常 */ }
    sharedBrowser = null;
  }
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--window-size=1920,1080",
  ];
  if (settings.proxy) {
    args.push(`--proxy-server=${settings.proxy}`);
  }
  sharedBrowser = await puppeteer.launch({
    headless: settings.headless === false ? false : true,
    timeout: Math.max(settings.timeout, 30000),
    args,
  });
  launchSignature = signature;
  return sharedBrowser;
}

/**
 * 关闭共享浏览器实例（退出清理 / 配置变化重建时调用）
 */
export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch { /* 忽略关闭异常 */ }
    sharedBrowser = null;
    launchSignature = "";
  }
}

/* ------------------------------------------------------------------ */
/* 并发控制（信号量）                                                    */
/* ------------------------------------------------------------------ */

/** 当前并行任务数 */
let runningCount = 0;
/** 等待队列（resolve 后任务获得执行资格） */
const waitQueue: Array<() => void> = [];

/**
 * 申请任务执行资格（超过 maxConcurrent 时排队等待）
 * @returns 释放函数（任务结束时必须调用）
 */
export async function acquireSlot(): Promise<() => void> {
  const max = Math.max(1, getSettings().maxConcurrent);
  if (runningCount < max) {
    runningCount++;
    return releaseSlot;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  runningCount++;
  return releaseSlot;
}

/**
 * 释放任务执行资格，并唤醒等待队列中的下一个任务
 */
function releaseSlot(): void {
  runningCount = Math.max(0, runningCount - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/* ------------------------------------------------------------------ */
/* 反爬基础注入                                                        */
/* ------------------------------------------------------------------ */

/**
 * 在页面上注入反检测脚本（每次导航前自动执行）
 * @param page 目标页面
 */
export async function applyStealth(page: puppeteer.Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    // 抹除 webdriver 标记
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // 伪造 chrome 对象（部分站点据此判断是否真实浏览器）
    (window as any).chrome = (window as any).chrome || { runtime: {} };
    // 伪造语言与插件列表
    Object.defineProperty(navigator, "languages", { get: () => ["zh-CN", "zh", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });
}

/**
 * 创建任务专用页面（基于共享浏览器独立隐身上下文，Cookie/存储全隔离）
 * @param userAgent 可选自定义 UA（空则用全局设置）
 * @param extraHeaders 可选附加请求头
 * @param viewport 可选视口尺寸
 * @param loginProfile 可选登录档案名（命中则注入已保存的 Cookie）
 * @returns 页面与其所属上下文（finally 中须 closeTaskContext 回收）
 * @throws {Error} 登录档案不存在 / Cookie 注入失败时抛出
 */
export async function createTaskPage(options: {
  userAgent?: string;
  extraHeaders?: Record<string, string>;
  viewport?: { width: number; height: number };
  loginProfile?: string;
}): Promise<{ page: puppeteer.Page; context: puppeteer.BrowserContext }> {
  const browser = await getSharedBrowser();
  const settings = getSettings();
  // 每个任务独立隐身上下文：实例复用提速的同时隔离 Cookie，避免反爬累积标记
  const context = await browser.createBrowserContext();
  // 登录态：在页面创建前注入 Cookie（须在上下文级执行）
  if (options.loginProfile) {
    const cookies = readLoginCookies(options.loginProfile);
    if (cookies && cookies.length) {
      await context.setCookie(...(cookies as any[]));
    }
  }
  const page = await context.newPage();
  await page.setViewport({
    width: options.viewport?.width || 1920,
    height: options.viewport?.height || 1080,
  });
  await page.setUserAgent(options.userAgent || settings.userAgent);
  if (options.extraHeaders && Object.keys(options.extraHeaders).length) {
    await page.setExtraHTTPHeaders(options.extraHeaders);
  }
  await applyStealth(page);
  return { page, context };
}

/**
 * 回收任务页面（关闭其隐身上下文，内部页面随之释放）
 * @param context 任务上下文
 */
export async function closeTaskContext(context: puppeteer.BrowserContext | null): Promise<void> {
  if (context) {
    try {
      await context.close();
    } catch { /* 忽略关闭异常 */ }
  }
}

/* ------------------------------------------------------------------ */
/* 有头登录会话（同一时刻仅允许一个）                                     */
/* ------------------------------------------------------------------ */

/** 进行中的登录会话 */
let pendingLogin: { profile: string; browser: puppeteer.Browser; context: puppeteer.BrowserContext } | null = null;

/**
 * 打开有头登录窗口（真实 Chrome 窗口，用户手动完成登录/验证码）
 * @param profile 登录档案名（Cookie 保存标识）
 * @param url 登录页 URL
 * @throws {Error} 已有进行中的登录会话 / 浏览器启动失败时抛出
 */
export async function openLoginSession(profile: string, url: string): Promise<void> {
  if (pendingLogin) {
    throw new Error(`已有进行中的登录会话（档案：${pendingLogin.profile}），请先完成或取消`);
  }
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"];
  const settings = getSettings();
  if (settings.proxy) {
    args.push(`--proxy-server=${settings.proxy}`);
  }
  const browser = await puppeteer.launch({ headless: false, args });
  const context = browser.defaultBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await applyStealth(page);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  pendingLogin = { profile, browser, context };
}

/**
 * 完成登录：读取会话 Cookie 并保存到 electron-store，关闭有头窗口
 * @param profile 登录档案名（须与 openLoginSession 一致）
 * @returns 保存的 Cookie 条数
 * @throws {Error} 无进行中的会话 / 档案名不匹配时抛出
 */
export async function finishLoginSession(profile: string): Promise<number> {
  if (!pendingLogin) {
    throw new Error("没有进行中的登录会话");
  }
  if (pendingLogin.profile !== profile) {
    throw new Error(`会话档案不匹配：当前为 ${pendingLogin.profile}，请求为 ${profile}`);
  }
  const cookies = await pendingLogin.context.cookies();
  store.set(LOGIN_PROFILE_PREFIX + profile, {
    cookies,
    savedAt: new Date().toISOString(),
  });
  const count = cookies.length;
  await closeLoginSession();
  return count;
}

/**
 * 取消登录：丢弃会话并关闭有头窗口（不保存 Cookie）
 */
export async function closeLoginSession(): Promise<void> {
  if (!pendingLogin) return;
  try {
    await pendingLogin.browser.close();
  } catch { /* 忽略关闭异常 */ }
  pendingLogin = null;
}

/**
 * 读取登录档案的 Cookie 列表
 * @param profile 登录档案名
 * @returns Cookie 数组（档案不存在返回 null）
 */
export function readLoginCookies(profile: string): puppeteer.Cookie[] | null {
  try {
    const data = store.get(LOGIN_PROFILE_PREFIX + profile) as
      | { cookies: puppeteer.Cookie[]; savedAt: string }
      | undefined;
    return data?.cookies || null;
  } catch {
    return null;
  }
}

/**
 * 列出全部登录档案
 * @returns 档案信息数组
 */
export function listLoginProfiles(): Array<{ name: string; cookieCount: number; savedAt: string }> {
  const result: Array<{ name: string; cookieCount: number; savedAt: string }> = [];
  try {
    const all = store.store as Record<string, any>;
    Object.keys(all).forEach((key) => {
      if (!key.startsWith(LOGIN_PROFILE_PREFIX)) return;
      const name = key.slice(LOGIN_PROFILE_PREFIX.length);
      const data = all[key];
      result.push({
        name,
        cookieCount: Array.isArray(data?.cookies) ? data.cookies.length : 0,
        savedAt: data?.savedAt || "",
      });
    });
  } catch { /* 忽略读取异常 */ }
  return result;
}

/**
 * 删除登录档案
 * @param profile 登录档案名
 */
export function deleteLoginProfile(profile: string): void {
  store.delete(LOGIN_PROFILE_PREFIX + profile);
}

/**
 * 应用退出时清理：关闭共享浏览器与进行中的登录会话
 * （由 index.ts 在 before-quit 中调用）
 */
export function cleanupOnQuit(): void {
  if (sharedBrowser) {
    try {
      sharedBrowser.close();
    } catch { /* 忽略关闭异常 */ }
    sharedBrowser = null;
  }
  if (pendingLogin) {
    try {
      pendingLogin.browser.close();
    } catch { /* 忽略关闭异常 */ }
    pendingLogin = null;
  }
}
