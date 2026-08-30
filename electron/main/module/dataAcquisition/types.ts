/**
 * 【数据获取】模块共享类型定义
 * 与渲染端 src/views/dataAcquisition/types/index.ts 保持结构一致（JSON 可序列化），
 * 全部字段均可通过 IPC 结构化克隆传输，规则描述式抽取（不传函数）。
 */

/** 字段变换步骤（节点端按序执行） */
export type TransformStep =
  | { type: "trim" }
  | { type: "replace"; pattern: string; flags?: string; replacement: string }
  | { type: "number" }
  | { type: "date"; format?: string }
  | { type: "split"; separator: string; index?: number };

/** 字段抽取规则（一条规则 = 结果记录的一个字段） */
export interface FieldRule {
  /** 字段名（结果对象的 key） */
  field: string;
  /**
   * 元素选择器（支持 CSS 与 Puppeteer P 选择器：
   * text/xxx、xpath//xxx、aria/xxx、>>> 穿透 Shadow DOM）
   */
  selector: string;
  /**
   * 取值属性：text(默认)/html/outerHTML/href/src/value/任意 attribute 名
   */
  attr?: string;
  /** 元素不存在时是否允许缺失（true → 空串；false → 该记录仍生成但值为空） */
  optional?: boolean;
  /** 仅扁平模式生效：命中多个元素时是否取全部（true → 数组；false → 取第一个） */
  multiple?: boolean;
  /** 取值后的变换管道（按序执行） */
  transforms?: TransformStep[];
}

/** 页面加载等待配置 */
export interface WaitConfig {
  /** goto 的 waitUntil 策略，默认 domcontentloaded */
  until?: "domcontentloaded" | "load" | "networkidle2" | "networkidle0";
  /** 特征选择器：出现即认为页面就绪（可选） */
  selector?: string;
  /** 特征选择器等待上限（ms），默认 10000 */
  selectorTimeout?: number;
  /** 网络空闲缓冲时长（ms），默认 800，超时不阻断 */
  settleMs?: number;
}

/** 交互步骤（等待完成后、抽取前按序执行，模拟人类浏览操作） */
export interface ActionStep {
  /** 动作类型：input 输入 / click 点击 / doubleClick 双击 / hover 悬停 / select 下拉选择 /
   *  press 按键 / scroll 滚到底部 / scrollTo 滚动到元素 / wait 固定等待 /
   *  waitSelector 等待元素出现 / waitNavigation 等待跳转 / newTab 切换到新标签页 /
   *  switchTab 切换到目标标签页 / back 浏览器后退 / reload 刷新页面 */
  type:
    | "input"
    | "click"
    | "doubleClick"
    | "hover"
    | "select"
    | "press"
    | "scroll"
    | "scrollTo"
    | "wait"
    | "waitSelector"
    | "waitNavigation"
    | "newTab"
    | "switchTab"
    | "back"
    | "reload";
  /** 目标元素选择器（input/click/doubleClick/hover/select/waitSelector/scrollTo 用） */
  selector?: string;
  /** 输入内容（input 用）/ 按键名（press 用，如 Enter）/ 下拉选项值（select 用）/
   *  标签页匹配关键字（switchTab 用，匹配 URL 或标题，支持正则） */
  value?: string;
  /** 等待时长（wait/waitNavigation/waitSelector 超时/newTab 超时用，ms） */
  ms?: number;
}

/** 分页配置 */
export interface PaginationConfig {
  /**
   * 分页类型：
   * - none：仅采集当前页
   * - selector：点击「下一页」选择器循环采集
   * - template：URL 模板循环采集（{page} 占位符）
   * - scroll：滚动加载后一次性采集
   */
  type: "none" | "selector" | "template" | "scroll";
  /** selector 类型：下一页按钮选择器 */
  next?: string;
  /** template 类型：页码参数名（URL 中自动追加 page=N；为空则替换 {page} 占位符） */
  pageParam?: string;
  /** 起始页码（template 类型，默认 1） */
  startPage?: number;
  /** 最大页数（默认 1，防失控） */
  maxPages?: number;
  /** scroll 类型：滚动次数（默认 5） */
  scrollTimes?: number;
  /** scroll 类型：每次滚动后等待时长（ms，默认 1000） */
  scrollWaitMs?: number;
}

/** XHR/Fetch 接口数据捕获配置 */
export interface CaptureConfig {
  /** 响应 URL 匹配正则（字符串形式） */
  urlPattern: string;
  /** 请求方法过滤（GET/POST 等，可选） */
  method?: string;
  /** 响应 JSON 内的数据路径（如 data.list，可选；命中数组则直接作为记录） */
  dataPath?: string;
  /** 最多捕获条数（默认 50，防内存失控） */
  maxCount?: number;
}

/** 反爬 / 浏览器选项 */
export interface AntiCrawlConfig {
  /** 自定义 User-Agent（空则用默认 Chrome UA） */
  userAgent?: string;
  /** 附加请求头 */
  extraHeaders?: Record<string, string>;
  /** 视口尺寸（默认 1920x1080） */
  viewport?: { width: number; height: number };
  /** 屏蔽的资源类型（image/font/media/stylesheet/script 等，提速用） */
  blockResources?: string[];
  /** 页间随机延时区间 [min, max]（ms），模拟人工 */
  delayMs?: [number, number];
  /** 登录态档案名（有头浏览器登录后保存的 Cookie 档案，可选） */
  loginProfile?: string;
}

/** 输出选项 */
export interface OutputConfig {
  /** 是否保存页面 HTML 快照到 cache-data（每页保存） */
  htmlSnapshot?: boolean;
  /** 是否保存整页截图到 cache-data（每页保存） */
  screenshot?: boolean;
  /** 最大记录条数（超过即停止，0/缺省不限） */
  maxRecords?: number;
}

/** 采集任务完整配置（落库核心 JSON） */
export interface ScrapeConfig {
  /** 任务名 */
  name: string;
  /** 起始 URL（template 类型时可为模板，含 {page} 占位符或由 pageParam 追加） */
  url: string;
  /** 数据源：dom 页面规则抽取（默认）/ network 接口捕获 */
  source?: "dom" | "network";
  /** 页面等待配置 */
  wait?: WaitConfig;
  /** 记录容器选择器（列表模式：每个容器产出一条记录；缺省为扁平模式） */
  itemSelector?: string;
  /** 字段规则列表 */
  rules: FieldRule[];
  /** 每页抽取前的交互步骤 */
  actions?: ActionStep[];
  /** 接口捕获配置（source=network 时必填） */
  capture?: CaptureConfig;
  /** 分页配置（缺省 none） */
  pagination?: PaginationConfig;
  /** 反爬选项 */
  antiCrawl?: AntiCrawlConfig;
  /** 输出选项 */
  output?: OutputConfig;
}

/** 全局设置（electron-store 键 scraper-settings） */
export interface ScraperSettings {
  /** 是否无头模式（默认 true） */
  headless: boolean;
  /** 代理服务器（如 http://127.0.0.1:7890，空则直连；修改后下次任务重建浏览器生效） */
  proxy: string;
  /** 最大并发任务数（默认 3） */
  maxConcurrent: number;
  /** 单页导航超时（ms，默认 30000） */
  timeout: number;
  /** 默认 User-Agent（任务可覆盖） */
  userAgent: string;
}

/** 任务进度推送（主→渲染 scraper:task-progress） */
export interface ScrapeProgress {
  /** 任务 id */
  taskId: string;
  /** 任务状态 */
  status: "running" | "done" | "error" | "stopped";
  /** 当前页码 */
  page: number;
  /** 已采集记录数 */
  recordCount: number;
  /** 阶段描述（如「加载页面」「抽取数据」） */
  phase?: string;
  /** 日志消息 */
  log?: string;
}

/** 任务结果推送（主→渲染 scraper:task-result） */
export interface ScrapeTaskResult {
  /** 任务 id */
  taskId: string;
  /** 是否成功 */
  success: boolean;
  /** 失败原因 / 停止原因 */
  reason?: string;
  /** 最后页面 URL */
  url: string;
  /** 最后页面标题 */
  title: string;
  /** 采集到的记录 */
  records: any[];
  /** 采集页数 */
  pages: number;
  /** 总耗时（ms） */
  elapsed: number;
  /** 接口捕获条数（未启用捕获为 0） */
  networkCount: number;
  /** 截图文件路径（output.screenshot 开启时有值） */
  screenshotPath?: string;
  /** HTML 快照路径（output.htmlSnapshot 开启时有值） */
  htmlPath?: string;
}

/** 登录档案信息（渲染端展示用） */
export interface LoginProfileInfo {
  /** 档案名 */
  name: string;
  /** Cookie 条数 */
  cookieCount: number;
  /** 保存时间（ISO 字符串） */
  savedAt: string;
}
