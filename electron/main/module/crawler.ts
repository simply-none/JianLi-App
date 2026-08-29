import { ipcMain, app } from "electron";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

/**
 * 【新爬虫】通用网页爬取工具
 * 与旧的 spider-test 步骤引擎（apiTest.ts）完全解耦，供天气等模块复用。
 *
 * 核心能力（等待策略参考 Puppeteer 官方文档）：
 * 1. 浏览器实例跨爬取复用（省去每次 1~3 秒冷启动），断连自动重建
 * 2. goto 使用 waitUntil: 'domcontentloaded' 即开始操作（locator 点击自带元素等待）
 * 3. 点击使用 page.locator().click()（内置可操作性检查：可见、可点、稳定）
 * 4. 点击后 waitForNavigation 与「新标签页 / 主文档 URL 变化」轮询做 Promise.race，
 *    任一就绪立即继续——必应 target="_blank" 新标签页场景不会白等超时
 * 5. 「真正跳转」仅当「协议+域名+路径」变化（忽略 query/hash）或出现新标签页才算
 * 6. 真实性校验：readyState / HTML 长度 / 特征选择器
 * 7. 无论成败，最终所在页面的完整渲染后 DOM 均可落盘到项目 cache-data 文件夹
 */

/** 爬取选项 */
export interface CrawlOptions {
  /** 起始页 URL（必填） */
  url: string;
  /**
   * 页面上下文链接挑选函数（可选，在起始页加载后执行）
   * 返回目标 URL 则直接 goto 进入（跳过点击流程），返回空串/不返回则继续原点击流程
   * 适用场景：结果列表中按特征（如域名）挑选目标链接，规避 SEO 排名干扰
   */
  pickHref?: () => string;
  /**
   * 需要点击的元素选择器（点击后进入目标页面），可选
   * 支持传数组：按顺序依次尝试，某一个成功跳转即停止（如搜索页的兜底选择器）
   */
  clickSelector?: string | string[];
  /** 目标页特征选择器，该元素出现即认为目标页加载完成，可选 */
  waitForSelector?: string;
  /** 整体超时时间（ms），默认 30000 */
  timeout?: number;
  /**
   * 页面上下文抽取函数（在浏览器内执行）
   * 注意：函数体内禁止引用外部变量/闭包，只能使用 document 等浏览器 API
   */
  extract?: () => any;
  /** 是否把最终网页 HTML 落盘到项目 cache-data 文件夹（无论成败都落盘，便于排查），默认 false */
  saveHtml?: boolean;
  /** 落盘文件名前缀（如城市名） */
  saveName?: string;
}

/** 爬取结果 */
export interface CrawlResult {
  /** 是否成功爬取到目标网页（已通过真实性校验） */
  success: boolean;
  /** 失败原因（success 为 false 时有值） */
  reason?: string;
  /** 最终页面 URL */
  url: string;
  /** 最终页面标题 */
  title: string;
  /** 最终页面完整渲染后 DOM 的 HTML 源码 */
  html: string;
  /** 点击后是否真的发生了页面跳转（域名或路径变化 / 新标签页） */
  navigated: boolean;
  /** extract 抽取函数的返回结果（未配置 extract 时为 undefined） */
  extracted?: any;
  /** 本次爬取总耗时（ms，便于排查性能） */
  elapsed: number;
}

/** 共享浏览器实例（跨爬取复用，断连自动重建） */
let sharedBrowser: puppeteer.Browser | null = null;
/**
 * 当前爬取的新标签页路由器（单槽位）
 * 浏览器级 targetcreated 监听只注册一次，转发给「当前进行中的爬取」处理新标签页
 */
let activeNewPageRouter: ((page: puppeteer.Page) => void) | null = null;

/**
 * 获取共享浏览器实例
 * @param timeout 启动超时（ms）
 * @returns 可用的浏览器实例
 */
async function getBrowser(timeout: number): Promise<puppeteer.Browser> {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }
  // 实例已断连（崩溃/被关闭），清理后重建
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch { /* 忽略旧实例关闭异常 */ }
    sharedBrowser = null;
  }
  sharedBrowser = await puppeteer.launch({
    headless: true,
    timeout,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1920,1080",
    ],
  });
  // 只注册一次新标签页监听，转发给当前爬取的处理器
  sharedBrowser.on("targetcreated", async (target) => {
    if (target.type() !== "page" || !activeNewPageRouter) return;
    const newPage = await target.page();
    if (newPage) {
      activeNewPageRouter(newPage);
    }
  });
  return sharedBrowser;
}

/**
 * 保存网页 HTML 到项目 cache-data 文件夹
 * @param namePrefix 文件名前缀（如城市名）
 * @param html 网页 HTML 源码
 * @param valid 数据是否有效（无效文件名追加 _invalid 后缀，便于区分排查）
 * @returns 保存成功返回文件路径，失败返回 null
 */
export function saveHtmlToCacheData(namePrefix: string, html: string, valid: boolean): string | null {
  try {
    const baseDir = path.join(app.getAppPath(), "cache-data");
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    // 清理文件名中的非法字符
    const safeName = namePrefix.replace(/[\s/\\:*?"<>|]/g, "_");
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const suffix = valid ? "" : "_invalid";
    const filePath = path.join(baseDir, `${safeName}_${dateStr}${suffix}.html`);
    fs.writeFileSync(filePath, html);
    console.log(`爬取网页已保存: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error("保存爬取网页失败:", error);
    return null;
  }
}

/** 短暂延时 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断页面是否发生了真正的跳转
 * 仅当「协议+域名+路径」变化（忽略 query 与 hash）或出现新标签页才算跳转，
 * 避免同页参数变化（如必应追加 form 参数）被误判
 * @param before 点击前的 URL
 * @param after 当前的 URL
 * @returns 是否跳转
 */
function isRealNavigation(before: string, after: string): boolean {
  try {
    const u1 = new URL(before);
    const u2 = new URL(after);
    return u1.origin + u1.pathname !== u2.origin + u2.pathname;
  } catch {
    return before !== after;
  }
}

/**
 * 爬取网页主流程
 * @param options 爬取选项
 * @returns 爬取结果（不会抛异常，失败通过 success/reason 表达）
 */
export async function crawlPage(options: CrawlOptions): Promise<CrawlResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;
  let context: puppeteer.BrowserContext | null = null;
  let page: puppeteer.Page | null = null;
  /** 本次爬取中点击打开的新标签页 */
  let followPage: puppeteer.Page | null = null;

  // 结果状态（finally 中可能补齐 HTML 落盘）
  let success = false;
  let reason: string | undefined;
  let navigated = false;
  let url = "";
  let title = "";
  let html = "";
  let extracted: any;

  try {
    const browser = await getBrowser(timeout);
    // 每次爬取使用独立隐身上下文：浏览器实例复用提速的同时，
    // Cookie/存储完全隔离，避免反爬机制随共享状态累积标记身份
    context = await browser.createBrowserContext();
    page = await context.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" });

    // 注册本次爬取的新标签页路由（finally 中注销，避免干扰后续爬取）
    activeNewPageRouter = (newPage) => {
      if (!followPage && newPage !== page) {
        followPage = newPage;
      }
    };

    // 1. 打开起始页：domcontentloaded 即可开始操作（locator 点击自带元素等待）
    await page.goto(options.url, { waitUntil: "domcontentloaded", timeout });

    const navTimeout = Math.min(timeout, 10000);

    // 1.5 链接挑选（可选）：在起始页上按特征挑出目标链接后直接 goto，
    //     规避 SEO 排名导致的目标站不在第一位的问题
    if (options.pickHref) {
      const picked = await page.evaluate(options.pickHref).catch(() => "");
      if (picked && typeof picked === "string" && picked.startsWith("http")) {
        const beforePickUrl = page.url();
        await page.goto(picked, { waitUntil: "domcontentloaded", timeout: navTimeout });
        navigated = isRealNavigation(beforePickUrl, page.url());
      }
    }

    // 2. 点击进入目标页（pickHref 未命中时走此流程，支持多选择器按序尝试）
    if (options.clickSelector && !navigated) {
      const selectors = Array.isArray(options.clickSelector)
        ? options.clickSelector
        : [options.clickSelector];

      for (const selector of selectors) {
        followPage = null;
        const beforeUrl = page.url();

        // 方案 A（优先）：直接读取结果链接 href 后 goto 跳转
        // 比模拟点击更快更稳：无可操作性等待、无新标签页竞态、不受页面 JS 拦截点击影响
        const href = await page
          .$eval(selector, (el) => (el as HTMLAnchorElement).href || "")
          .catch(() => "");
        if (href && href.startsWith("http")) {
          await page.goto(href, { waitUntil: "domcontentloaded", timeout: navTimeout });
          navigated = isRealNavigation(beforeUrl, page.url());
          if (navigated) {
            break; // 成功进入目标页
          }
          reason = `访问链接 ${href} 未离开起始站`;
          continue;
        }

        // 方案 B（兜底）：模拟点击（链接无有效 href 时使用）
        // 官方竞态模式：先挂 waitForNavigation 监听再点击
        const navPromise = page
          .waitForNavigation({ waitUntil: "domcontentloaded", timeout: navTimeout })
          .catch(() => null);

        // locator().click() 内置可操作性检查（可见、启用、位置稳定）
        await page.locator(selector).setTimeout(navTimeout).click();

        // Promise.race：waitForNavigation（本页跳转）与轮询（新标签页 / 域名+路径变化）
        // 任一就绪立即继续——修复旧版「新标签页场景下 navPromise 白等满超时」的卡点
        await Promise.race([
          navPromise,
          (async () => {
            const deadline = Date.now() + navTimeout;
            while (Date.now() < deadline) {
              if (followPage) return;
              if (isRealNavigation(beforeUrl, page!.url())) return;
              await sleep(150);
            }
          })(),
        ]);

        navigated = !!followPage || isRealNavigation(beforeUrl, page.url());
        if (navigated) {
          break; // 某个选择器成功跳转，停止尝试
        }
        reason = `点击 ${selector} 后未发生页面跳转`;
      }

      if (!navigated) {
        return { success: false, reason, url: page.url(), title: "", html: "", navigated, elapsed: Date.now() - startTime };
      }
    }

    // 3. 切换到实际生效的页面（新标签页优先）
    const active: puppeteer.Page = followPage || page;

    // 4. 等待目标页加载完成（提速：轮询 readyState 为主，短 settle 为辅）
    //    - 先等 URL 离开 about:blank（新标签页刚创建时可能尚未开始导航）
    //    - 再轮询 readyState 到 complete（上限 5 秒，通常 1~2 秒）
    //    - 最后短 settle 等待网络空闲（上限 2 秒，超时视为已就绪，不阻断）
    const blankDeadline = Date.now() + 5000;
    while (Date.now() < blankDeadline && active.url() === "about:blank") {
      await sleep(100);
    }
    const readyDeadline = Date.now() + 5000;
    while (Date.now() < readyDeadline) {
      const readyState = await active.evaluate(() => document.readyState);
      if (readyState === "complete") break;
      await sleep(200);
    }
    await active.waitForNetworkIdle({ idleTime: 400, timeout: 2000 }).catch(() => { });

    // 5. 可选等待特征选择器出现
    if (options.waitForSelector) {
      const found = await active
        .waitForSelector(options.waitForSelector, { timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      if (!found) {
        reason = `特征选择器未出现: ${options.waitForSelector}`;
        return { success: false, reason, url: active.url(), title: "", html: "", navigated, elapsed: Date.now() - startTime };
      }
    }

    // 6. 真实性校验：HTML 有实质内容
    url = active.url();
    title = await active.title();
    html = await active.content();
    if (!html || html.length < 500) {
      reason = `网页内容过短（${html.length} 字符），疑似空页面`;
      return { success: false, reason, url, title, html, navigated, elapsed: Date.now() - startTime };
    }

    // 7. 可选页面上下文抽取
    if (options.extract) {
      extracted = await active.evaluate(options.extract);
    }

    success = true;
  } catch (error) {
    reason = (error as Error).message;
  } finally {
    // 无论成败，把最终所在页面的完整渲染后 DOM 落盘（便于排查爬取到了什么页面）
    const activePage: puppeteer.Page | null = followPage || page;
    if (options.saveHtml && activePage && !activePage.isClosed()) {
      try {
        if (!html) {
          html = await activePage.content();
        }
        if (!url) {
          url = activePage.url();
        }
        if (!title) {
          title = await activePage.title();
        }
        saveHtmlToCacheData(options.saveName || "page", html, success);
      } catch { /* 落盘失败不影响主流程 */ }
    }
    // 关闭本次爬取的隐身上下文（其内所有页面随之回收；共享浏览器实例保留供下次复用）
    if (context) {
      try {
        await context.close();
      } catch { /* 忽略关闭异常 */ }
    }
    // 注销本次爬取的新标签页路由
    activeNewPageRouter = null;
  }

  const elapsed = Date.now() - startTime;
  console.log(`爬取完成: ${url || options.url}, 耗时 ${elapsed}ms, 结果: ${success ? "成功" : `失败(${reason})`}`);
  return { success, reason, url, title, html, navigated, extracted, elapsed };
}

/**
 * 注册新爬虫工具的 IPC 通道
 * 通道：crawler:run（渲染→主，invoke）→ 返回 { success, reason?, url, title, htmlLength, navigated, elapsed }
 * 注意：IPC 入参无法传递抽取函数，需要页面内抽取的模块请直接 import crawlPage
 */
export function initCrawler() {
  ipcMain.handle("crawler:run", async (event, params: CrawlOptions) => {
    const result = await crawlPage(params);
    return {
      success: result.success,
      reason: result.reason,
      url: result.url,
      title: result.title,
      htmlLength: result.html.length,
      navigated: result.navigated,
      elapsed: result.elapsed,
    };
  });

  // 应用退出时关闭共享浏览器实例，避免残留 headless chrome 进程
  app.on("before-quit", () => {
    if (sharedBrowser) {
      try {
        sharedBrowser.close();
      } catch { /* 忽略关闭异常 */ }
      sharedBrowser = null;
    }
  });
}
