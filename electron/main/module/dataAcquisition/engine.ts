/**
 * 【数据获取】任务执行引擎
 * ------------------------------------------------------------------
 * 完整任务流水线：
 * 申请并发槽位 → 建页（Cookie/UA/视口/资源屏蔽）→ 逐页循环：
 * 加载 → 等待（until/特征选择器/网络缓冲）→ 交互步骤 → 抽取
 * （DOM 规则 或 XHR/Fetch 捕获）→ 落快照/截图 → 分页推进 → 随机延时
 * 进度经 webContents 实时推送，支持中途取消（scraper:stop-task）。
 * 测试模式强制只跑第一页，供规则调参预览。
 */
import type puppeteer from "puppeteer";
import { saveHtmlToCacheData } from "../crawler.ts";
import { acquireSlot, createTaskPage, closeTaskContext, getSettings } from "./browser.ts";
import { extractRecords, attachCapture, captureToRecords, type CapturedResponse } from "./rules.ts";
import type { ScrapeConfig, ScrapeProgress, ScrapeTaskResult, ActionStep } from "./types.ts";

/** 进行中的任务（取消标记表） */
const runningTasks = new Map<string, { cancelled: boolean }>();

/** 短暂延时 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 在 [min, max] 区间取随机整数（页间随机延时，模拟人工）
 * @param min 最小值
 * @param max 最大值
 * @returns 随机整数（min > max 时返回 min）
 */
function randomBetween(min: number, max: number): number {
  if (!min || !max || max <= min) return min || 0;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 推送任务进度到渲染窗口（窗口已销毁时静默跳过）
 * @param sender 渲染窗口 webContents
 * @param progress 进度数据
 */
function pushProgress(sender: Electron.WebContents, progress: ScrapeProgress): void {
  try {
    if (!sender.isDestroyed()) {
      sender.send("scraper:task-progress", progress);
    }
  } catch { /* 推送失败不影响主流程 */ }
}

/**
 * 推送任务结果到渲染窗口
 * @param sender 渲染窗口 webContents
 * @param result 结果数据
 */
function pushResult(sender: Electron.WebContents, result: ScrapeTaskResult): void {
  try {
    if (!sender.isDestroyed()) {
      sender.send("scraper:task-result", result);
    }
  } catch { /* 推送失败不影响主流程 */ }
}

/**
 * 构造分页 URL：模板含 {page} 则替换占位符，否则按 pageParam 追加查询参数
 * @param baseUrl 基础 URL
 * @param pageNum 页码
 * @param pageParam 查询参数名（空则要求 baseUrl 含 {page} 占位符）
 * @returns 拼接后的 URL
 */
function buildPageUrl(baseUrl: string, pageNum: number, pageParam?: string): string {
  if (baseUrl.includes("{page}")) {
    return baseUrl.replace("{page}", String(pageNum));
  }
  const param = pageParam || "page";
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}${param}=${pageNum}`;
}

/**
 * 执行页面交互步骤（等待完成后、抽取前按序执行，模拟人类浏览操作）
 * 点击 target=_blank 链接等场景会新开标签页，可通过 newTab 步骤切换工作页面。
 * @param page 初始工作页面
 * @param config 任务配置
 * @param timeout 单步超时（ms）
 * @param onStep 每步日志回调（参数为该步骤的可读描述，如「[2/6] 输入 #kw ← "新闻"」）
 * @returns 执行完所有步骤后的当前工作页面（可能因切换新标签页而与入参不同）
 * @throws {Error} input/click/doubleClick/hover/select 步骤的选择器在超时内未出现时抛出
 */
async function runActions(
  page: puppeteer.Page,
  config: ScrapeConfig,
  timeout: number,
  onStep?: (label: string) => void
): Promise<puppeteer.Page> {
  const list = config.actions || [];
  for (let i = 0; i < list.length; i++) {
    const action = list[i];
    /** 该步骤的可读描述（日志用） */
    const describe = describeAction(action);
    onStep?.(`[${i + 1}/${list.length}] ${describe}`);
    switch (action.type) {
      case "input":
        if (!action.selector) break;
        await page.locator(action.selector).setTimeout(timeout).fill(action.value || "");
        break;
      case "click":
        if (!action.selector) break;
        await page.locator(action.selector).setTimeout(timeout).click();
        break;
      case "doubleClick":
        if (!action.selector) break;
        await page.locator(action.selector).setTimeout(timeout).click({ clickCount: 2 });
        break;
      case "hover":
        if (!action.selector) break;
        await page.locator(action.selector).setTimeout(timeout).hover();
        break;
      case "select":
        if (!action.selector) break;
        await page.select(action.selector, action.value || "");
        break;
      case "press":
        if (action.value) {
          await page.keyboard.press(action.value as any);
        }
        break;
      case "scroll":
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        break;
      case "scrollTo":
        if (action.selector) {
          // 先等元素出现再滚动到其位置（普通 CSS 选择器）
          await page
            .waitForSelector(action.selector, { timeout })
            .then((el) => el?.evaluate((node) => (node as HTMLElement).scrollIntoView({ block: "center" })))
            .catch(() => { /* 元素未出现不阻断 */ });
        }
        break;
      case "wait":
        await sleep(action.ms || 500);
        break;
      case "waitSelector":
        if (action.selector) {
          // 智能等待：元素出现立即继续，代替盲等固定时长
          await page.waitForSelector(action.selector, { timeout: action.ms || 10000 }).catch(() => { });
        }
        break;
      case "waitNavigation":
        // 等待页面跳转完成（点击/提交后的导航，超时不阻断）
        await page
          .waitForNavigation({ waitUntil: "domcontentloaded", timeout: action.ms || 15000 })
          .catch(() => { });
        break;
      case "newTab": {
        // 切换到新标签页：点击 target=_blank 链接后，人类注意力会转移到新页签。
        // 关键：谓词必须排除当前页面自己（当前页也是 page 类型 target，会被立即匹配导致切换无效）
        const currentTarget = page.target();
        try {
          const target = await page
            .browserContext()
            .waitForTarget((t) => t.type() === "page" && t !== currentTarget, { timeout: action.ms || 10000 });
          const newPage = await target.page();
          if (newPage) page = newPage;
        } catch { /* 超时未出现新标签页，继续使用当前页 */ }
        break;
      }
      case "switchTab": {
        // 切换到目标标签页：在当前上下文已打开的页签中按 URL/标题匹配（点击后新页签已存在时用）
        if (!action.value) break;
        let pattern: RegExp;
        try {
          pattern = new RegExp(action.value);
        } catch {
          // 非法正则退化为普通包含匹配
          pattern = new RegExp(action.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        }
        const before = page;
        const candidates = page.browserContext().targets().filter((t) => t.type() === "page");
        for (const t of candidates) {
          const p = await t.page().catch(() => null);
          if (!p) continue;
          // 先比对 URL（同步），再比对此刻的页面标题（异步）
          const title = await p.title().catch(() => "");
          if (pattern.test(p.url()) || pattern.test(title)) {
            page = p;
            break;
          }
        }
        // 未匹配到目标页签时抛错（人工"切到那个页签"切不过去即应终止，便于排查）
        if (page === before) {
          throw new Error(
            `切换到目标标签页失败：没有找到 URL 或标题匹配 "${action.value}" 的页签` +
              `（当前打开 ${candidates.length} 个页签；可先用调试日志确认目标页签是否已打开）`
          );
        }
        break;
      }
      case "back":
        await page.goBack({ waitUntil: "domcontentloaded", timeout }).catch(() => { });
        break;
      case "reload":
        await page.reload({ waitUntil: "domcontentloaded", timeout }).catch(() => { });
        break;
    }
  }
  return page;
}

/**
 * 生成交互步骤的可读描述（运行日志用）
 * @param action 交互步骤
 * @returns 形如「输入 #kw ← "新闻"」「点击 a.next」「切换到新标签页」的描述
 */
function describeAction(action: ActionStep): string {
  const sel = action.selector || "";
  switch (action.type) {
    case "input":
      return `输入 ${sel} ← "${action.value || ""}"`;
    case "click":
      return `点击 ${sel}`;
    case "doubleClick":
      return `双击 ${sel}`;
    case "hover":
      return `悬停 ${sel}`;
    case "select":
      return `下拉选择 ${sel} → ${action.value || ""}`;
    case "press":
      return `按键 ${action.value || ""}`;
    case "scroll":
      return "滚动到页面底部";
    case "scrollTo":
      return `滚动到元素 ${sel}`;
    case "wait":
      return `等待 ${action.ms || 500}ms`;
    case "waitSelector":
      return `等待元素出现 ${sel}`;
    case "waitNavigation":
      return "等待页面跳转";
    case "newTab":
      return "切换到新标签页";
    case "switchTab":
      return `切换到标签页（匹配 "${action.value || ""}"）`;
    case "back":
      return "浏览器后退";
    case "reload":
      return "刷新页面";
    default:
      return (action as { type: string }).type;
  }
}

/**
 * 等待页面就绪：特征选择器（可选）→ 网络空闲缓冲（不阻断）
 * @param page 目标页面
 * @param config 任务配置
 */
async function waitForReady(page: puppeteer.Page, config: ScrapeConfig): Promise<void> {
  const wait = config.wait || {};
  if (wait.selector) {
    await page
      .waitForSelector(wait.selector, { timeout: wait.selectorTimeout || 10000 })
      .catch(() => { /* 特征选择器超时不阻断，交由抽取结果反映 */ });
  }
  await page.waitForNetworkIdle({ idleTime: 400, timeout: wait.settleMs ?? 800 }).catch(() => { });
}

/**
 * 屏蔽指定类型资源（提速：图片/字体/媒体等不加载）
 * @param page 目标页面
 * @param types 资源类型列表（request.resourceType() 取值）
 */
async function setupResourceBlock(page: puppeteer.Page, types: string[]): Promise<void> {
  if (!types || !types.length) return;
  const blockSet = new Set(types);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (blockSet.has(req.resourceType())) {
      req.abort().catch(() => { });
    } else {
      req.continue().catch(() => { });
    }
  });
}

/**
 * 执行采集任务主流程（一次调用 = 一个完整任务）
 * @param params.taskId 任务 id（渲染端生成，用于进度/结果对应）
 * @param params.config 任务配置
 * @param params.mode run 正式模式 / test 测试模式（强制单页）
 * @param params.sender 渲染窗口 webContents（进度推送目标）
 * @returns 任务结果（不抛异常，失败看 success/reason）
 */
export async function runScraperTask(params: {
  taskId: string;
  config: ScrapeConfig;
  mode: "run" | "test";
  sender: Electron.WebContents;
}): Promise<ScrapeTaskResult> {
  const { taskId, config, mode, sender } = params;
  const startTime = Date.now();
  const settings = getSettings();
  const timeout = settings.timeout || 30000;
  const anti = config.antiCrawl || {};
  const pagination = config.pagination || { type: "none" as const };
  const output = config.output || {};
  // 测试模式只跑第一页；正式模式最大页数缺省 1（防失控）
  const maxPages = mode === "test" ? 1 : Math.max(1, pagination.maxPages || 1);

  // 注册取消标记
  const taskState = { cancelled: false };
  runningTasks.set(taskId, taskState);

  /** 释放并发槽位（finally 调用） */
  let release: (() => void) | null = null;
  let context: puppeteer.BrowserContext | null = null;
  let page: puppeteer.Page | null = null;
  let captureBuffer: CapturedResponse[] | null = null;
  let captureOffset = 0; // 网络捕获已消费的条数（多页增量消费）

  const records: any[] = [];
  let success = false;
  let reason: string | undefined;
  let lastUrl = "";
  let lastTitle = "";
  let pagesDone = 0;
  let screenshotPath: string | undefined;
  let htmlPath: string | undefined;
  /** 当前执行步骤上下文（错误定位用，如「第2页 · 加载页面」） */
  let stepCtx = "";

  /** 推送进度的便捷闭包 */
  const emit = (status: ScrapeProgress["status"], pageNum: number, phase?: string, log?: string) => {
    pushProgress(sender, { taskId, status, page: pageNum, recordCount: records.length, phase, log });
  };

  try {
    // 1. 申请并发槽位（排队等待时同步进度）
    emit("running", 0, "排队中");
    release = await acquireSlot();

    // 2. 创建任务页面（独立隐身上下文 + Cookie 登录态 + UA/视口）
    emit("running", 0, "启动浏览器");
    const created = await createTaskPage({
      userAgent: anti.userAgent,
      extraHeaders: anti.extraHeaders,
      viewport: anti.viewport,
      loginProfile: anti.loginProfile,
    });
    page = created.page;
    context = created.context;

    // 3. 资源屏蔽与接口捕获
    if (anti.blockResources?.length) {
      await setupResourceBlock(page, anti.blockResources);
    }
    if (config.source === "network" && config.capture) {
      captureBuffer = attachCapture(page, config.capture);
    }

    // 4. 逐页采集循环
    let pageNum = pagination.type === "template" ? (pagination.startPage || 1) : 1;
    while (true) {
      if (taskState.cancelled) {
        reason = "任务已手动停止";
        break;
      }
      const targetUrl = pagination.type === "template" ? buildPageUrl(config.url, pageNum, pagination.pageParam) : config.url;

      // 4.1 加载页面
      emit("running", pageNum, "加载页面", targetUrl);
      stepCtx = `第${pageNum}页 · 加载页面（${targetUrl}）`;
      await page.goto(targetUrl, { waitUntil: config.wait?.until || "domcontentloaded", timeout });

      // 4.2 等待就绪（特征选择器 + 网络缓冲）
      stepCtx = `第${pageNum}页 · 等待就绪（waitUntil=${config.wait?.until || "domcontentloaded"}${config.wait?.selector ? `，特征选择器=${config.wait.selector}` : ""}）`;
      emit("running", pageNum, "等待就绪", stepCtx.replace(`第${pageNum}页 · `, ""));
      await waitForReady(page, config);

      // 4.3 滚动加载分页：先滚完再抽取（其余分页类型在抽取后推进）
      if (pagination.type === "scroll") {
        stepCtx = `第${pageNum}页 · 滚动加载`;
        const times = Math.max(1, pagination.scrollTimes || 5);
        const waitMs = pagination.scrollWaitMs || 1000;
        for (let i = 0; i < times; i++) {
          if (taskState.cancelled) break;
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(waitMs);
        }
        await page.waitForNetworkIdle({ idleTime: 400, timeout: 2000 }).catch(() => { });
      }

      // 4.4 交互步骤（逐步推送日志；点击新开标签页后由 newTab 步骤切换工作页面）
      if (config.actions?.length) {
        emit("running", pageNum, "执行交互步骤");
        stepCtx = `第${pageNum}页 · 交互步骤（${config.actions.map((a) => a.type).join("→")}）`;
        page = await runActions(page, config, Math.min(timeout, 10000), (label) => {
          // 每步实时推送，并把错误定位上下文细化到单个动作
          stepCtx = `第${pageNum}页 · 交互步骤 ${label}`;
          emit("running", pageNum, "交互步骤", label);
        });
      }

      // 4.5 调试快照：在「提取那一刻」保存最终页面完整 HTML 到 cache-data/步骤N_时间戳.html，
      // 与提取配置（记录容器/字段规则）所见页面完全一致，便于比对选择器；不依赖输出选项，始终执行
      try {
        await saveStepHtml(page, pageNum);
        emit("running", pageNum, "保存调试快照（提取现场）", `cache-data/步骤${pageNum}_<时间戳>.html`);
      } catch { /* 快照落盘失败不影响主流程 */ }

      // 4.6 数据抽取（DOM 规则 / 接口捕获）
      emit("running", pageNum, "抽取数据");
      stepCtx = `第${pageNum}页 · 数据抽取（${config.source === "network" ? `接口捕获 ${config.capture?.urlPattern || ""}` : `${config.itemSelector ? `容器=${config.itemSelector}，` : ""}字段规则 ${config.rules?.length || 0} 条${config.groups?.length ? `，提取项容器 ${config.groups.length} 个` : ""}`}）`;
      if (config.source === "network" && captureBuffer) {
        // 增量消费：仅取本页新捕获的响应，多页捕获不重复
        const fresh = captureBuffer.slice(captureOffset);
        captureOffset = captureBuffer.length;
        records.push(...captureToRecords(fresh, config.capture?.dataPath));
      } else {
        records.push(...(await extractRecords(page, config)));
      }

      // 4.6 页面快照与截图（按页保存）
      lastUrl = page.url();
      lastTitle = await page.title();
      pagesDone = pageNum;
      if (output.htmlSnapshot) {
        try {
          htmlPath = saveHtmlToCacheData(`${config.name || "scraper"}_p${pageNum}`, await page.content(), true) || htmlPath;
        } catch { /* 落盘失败不影响主流程 */ }
      }
      if (output.screenshot) {
        try {
          const p = await saveScreenshot(config.name || "scraper", `p${pageNum}`, page);
          if (p) screenshotPath = p;
        } catch { /* 截图失败不影响主流程 */ }
      }

      emit("running", pageNum, "本页完成", `已采集 ${records.length} 条`);
      if (mode === "test") break;

      // 4.7 记录数上限检查
      if (output.maxRecords && records.length >= output.maxRecords) {
        records.length = output.maxRecords;
        reason = `已达最大记录数上限（${output.maxRecords}）`;
        break;
      }

      // 4.8 分页推进
      if (pagination.type === "none") break;
      if (pagination.type === "template") {
        if (pageNum >= maxPages) break;
        pageNum++;
      } else if (pagination.type === "selector") {
        if (pageNum >= maxPages) break;
        const nextSel = pagination.next;
        if (!nextSel) break;
        const hasNext = await page.$(nextSel);
        if (!hasNext) break; // 没有「下一页」按钮 → 自然结束
        stepCtx = `第${pageNum}页 · 翻页（点击下一页 ${nextSel}）`;
        // 官方竞态模式：先挂导航监听再点击
        const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);
        await page.locator(nextSel).setTimeout(10000).click();
        await Promise.race([navPromise, sleep(1500)]);
        pageNum++;
      } else if (pagination.type === "scroll") {
        break; // 滚动加载单页一次抽取
      }

      // 4.9 页间随机延时（模拟人工浏览）
      const [dMin, dMax] = anti.delayMs || [0, 0];
      const delay = randomBetween(dMin, dMax);
      if (delay > 0) {
        emit("running", pageNum, "延时中", `${delay}ms 后继续`);
        await sleep(delay);
      }
    }

    success = records.length > 0;
    if (!success && !reason) {
      reason = "未采集到任何记录（检查选择器或数据源配置）";
    } else if (success && !reason && taskState.cancelled) {
      reason = "任务已手动停止";
    }
  } catch (error) {
    const msg = (error as Error)?.message || String(error);
    // 带步骤上下文的错误定位（如 [第1页 · 数据抽取（容器=.item，字段规则 2 条）] ...）
    reason = stepCtx ? `[${stepCtx}] ${msg}` : msg;
    success = false;
  } finally {
    // 回收任务上下文与并发槽位
    await closeTaskContext(context);
    if (release) release();
    runningTasks.delete(taskId);
  }

  const result: ScrapeTaskResult = {
    taskId,
    success,
    reason,
    url: lastUrl,
    title: lastTitle,
    records,
    pages: pagesDone,
    elapsed: Date.now() - startTime,
    networkCount: captureBuffer?.length || 0,
    screenshotPath,
    htmlPath,
  };
  emit(success ? "done" : taskState.cancelled ? "stopped" : "error", pagesDone, success ? "采集完成" : reason);
  pushResult(sender, result);
  console.log(`[数据获取] 任务 ${config.name || taskId} ${success ? "成功" : `失败(${reason})`}，${records.length} 条，耗时 ${result.elapsed}ms`);
  return result;
}

/**
 * 保存调试快照：当前页面完整 HTML 写入 cache-data/步骤N_时间戳.html
 * （文件名带本地时间戳，保留每次运行的页面现场，便于对比排查）
 * @param page 目标页面
 * @param stepNo 步骤编号（页码）
 */
async function saveStepHtml(page: puppeteer.Page, stepNo: number): Promise<void> {
  const path = await import("path");
  const fs = await import("fs");
  const { app } = await import("electron");
  const baseDir = path.join(app.getAppPath(), "cache-data");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  // 本地时间戳（YYYYMMDD-HHmmss），同页多次运行互不覆盖
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const filePath = path.join(baseDir, `步骤${stepNo}_${ts}.html`);
  await fs.promises.writeFile(filePath, await page.content(), "utf-8");
}

/**
 * 保存整页截图到项目 cache-data 文件夹
 * @param namePrefix 文件名前缀（任务名）
 * @param pageTag 页码标记（如 p1）
 * @param page 目标页面
 * @returns 保存成功返回文件路径，失败返回 null
 */
async function saveScreenshot(namePrefix: string, pageTag: string, page: puppeteer.Page): Promise<string | null> {
  const path = await import("path");
  const fs = await import("fs");
  const { app } = await import("electron");
  const baseDir = path.join(app.getAppPath(), "cache-data");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const safeName = namePrefix.replace(/[\s/\\:*?"<>|]/g, "_");
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(baseDir, `${safeName}_${pageTag}_${dateStr}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

/**
 * 请求取消任务（设置取消标记，引擎在下一检查点停止）
 * @param taskId 任务 id
 * @returns 是否找到进行中的任务
 */
export function stopScraperTask(taskId: string): boolean {
  const task = runningTasks.get(taskId);
  if (task) {
    task.cancelled = true;
    return true;
  }
  return false;
}
