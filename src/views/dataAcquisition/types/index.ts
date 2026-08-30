/**
 * 数据获取模块 - 渲染端类型定义
 * ------------------------------------------------------------------
 * 与主进程 electron/main/module/dataAcquisition/types.ts 结构保持一致
 * （JSON 可序列化，经 IPC 结构化克隆传输）。
 * 渲染端独立声明，避免引入主进程模块依赖。
 */

/** 字段变换步骤（主进程节点端按序执行） */
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
  /** 元素选择器（CSS / P 选择器：text/xxx、xpath//xxx、aria/xxx、>>>） */
  selector: string;
  /** 取值属性：text/html/outerHTML/href/src/value/任意 attribute 名 */
  attr?: string;
  /** 元素不存在时是否允许缺失 */
  optional?: boolean;
  /** 扁平模式：命中多个元素时是否取全部 */
  multiple?: boolean;
  /** 取值后的变换管道（按序执行） */
  transforms?: TransformStep[];
}

/** 页面加载等待配置 */
export interface WaitConfig {
  /** goto 的 waitUntil 策略 */
  until?: "domcontentloaded" | "load" | "networkidle2" | "networkidle0";
  /** 特征选择器：出现即认为页面就绪 */
  selector?: string;
  /** 特征选择器等待上限（ms） */
  selectorTimeout?: number;
  /** 网络空闲缓冲时长（ms） */
  settleMs?: number;
}

/** 交互步骤（等待完成后、抽取前按序执行） */
export interface ActionStep {
  /** 动作类型：input 输入 / click 点击 / doubleClick 双击 / hover 悬停 / select 下拉选择 /
   *  press 按键 / scroll 滚到底部 / scrollTo 滚动到元素 / wait 固定等待 /
   *  waitSelector 等待元素出现 / waitNavigation 等待跳转 / newTab 切换到新标签页 /
   *  switchTab 切换到目标标签页 / back 后退 / reload 刷新 */
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
  /** 输入内容 / 按键名（press 用，如 Enter）/ 下拉选项值（select 用）/
   *  标签页匹配关键字（switchTab 用，匹配 URL 或标题，支持正则） */
  value?: string;
  /** 等待时长（wait/waitSelector 超时/waitNavigation/newTab 超时用，ms） */
  ms?: number;
}

/** 分页配置 */
export interface PaginationConfig {
  /** 分页类型：none 仅当前页 / selector 点击下一页 / template URL 模板 / scroll 滚动加载 */
  type: "none" | "selector" | "template" | "scroll";
  /** selector 类型：下一页按钮选择器 */
  next?: string;
  /** template 类型：页码参数名（空则替换 {page} 占位符） */
  pageParam?: string;
  /** 起始页码（template 类型） */
  startPage?: number;
  /** 最大页数 */
  maxPages?: number;
  /** scroll 类型：滚动次数 */
  scrollTimes?: number;
  /** scroll 类型：每次滚动后等待时长（ms） */
  scrollWaitMs?: number;
}

/** XHR/Fetch 接口数据捕获配置 */
export interface CaptureConfig {
  /** 响应 URL 匹配正则（字符串形式） */
  urlPattern: string;
  /** 请求方法过滤 */
  method?: string;
  /** 响应 JSON 内的数据路径（如 data.list） */
  dataPath?: string;
  /** 最多捕获条数 */
  maxCount?: number;
}

/** 反爬 / 浏览器选项 */
export interface AntiCrawlConfig {
  /** 自定义 User-Agent */
  userAgent?: string;
  /** 附加请求头 */
  extraHeaders?: Record<string, string>;
  /** 视口尺寸 */
  viewport?: { width: number; height: number };
  /** 屏蔽的资源类型（image/font/media/stylesheet/script） */
  blockResources?: string[];
  /** 页间随机延时区间 [min, max]（ms） */
  delayMs?: [number, number];
  /** 登录态档案名 */
  loginProfile?: string;
}

/** 输出选项 */
export interface OutputConfig {
  /** 保存页面 HTML 快照到 cache-data */
  htmlSnapshot?: boolean;
  /** 保存整页截图到 cache-data */
  screenshot?: boolean;
  /** 最大记录条数（0 不限） */
  maxRecords?: number;
}

/** 采集任务完整配置（落库核心 JSON） */
export interface ScrapeConfig {
  /** 任务名 */
  name: string;
  /** 起始 URL（template 类型时支持 {page} 占位符） */
  url: string;
  /** 数据源：dom 页面规则抽取 / network 接口捕获 */
  source?: "dom" | "network";
  /** 页面等待配置 */
  wait?: WaitConfig;
  /** 记录容器选择器（列表模式；缺省为扁平模式） */
  itemSelector?: string;
  /** 字段规则列表 */
  rules: FieldRule[];
  /** 每页抽取前的交互步骤 */
  actions?: ActionStep[];
  /** 接口捕获配置（source=network 时必填） */
  capture?: CaptureConfig;
  /** 分页配置 */
  pagination?: PaginationConfig;
  /** 反爬选项 */
  antiCrawl?: AntiCrawlConfig;
  /** 输出选项 */
  output?: OutputConfig;
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
  /** 阶段描述 */
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
  /** 接口捕获条数 */
  networkCount: number;
  /** 截图文件路径 */
  screenshotPath?: string;
  /** HTML 快照路径 */
  htmlPath?: string;
}

/** 任务列表行（scraper_tasks 表的解析结构） */
export interface TaskItem {
  /** 自增主键 */
  id: number;
  /** 任务名 */
  name: string;
  /** 完整任务配置 */
  config: ScrapeConfig;
  /** 更新时间戳 */
  updatedAt: number;
}

/** 历史记录行（scraper_history 表的解析结构） */
export interface HistoryItem {
  /** 自增主键 */
  id: number;
  /** 任务名 */
  taskName: string;
  /** 运行状态：success / error / stopped */
  status: string;
  /** 最后页面 URL */
  url: string;
  /** 记录条数 */
  itemCount: number;
  /** 耗时（ms） */
  elapsed: number;
  /** 失败原因 */
  error?: string;
  /** 任务配置快照 */
  config: ScrapeConfig | null;
  /** 采集到的记录 */
  data: any[] | null;
  /** 创建时间戳 */
  createdAt: number;
}
