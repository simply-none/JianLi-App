/**
 * 天气模块 - 共享类型定义
 * ------------------------------------------------------------------
 * 主进程与渲染端共用同一套语义（渲染端有独立副本 src/views/weather/types.ts，
 * 修改本文件时需同步，两者结构一一对应）。
 *
 * 设计原则：
 * - WeatherData 的「基础字段」保持必填（兼容 v1 契约与既有组件）；
 * - 「扩展字段」全部可选，按 capabilities 能力清单决定是否展示；
 * - capabilities 为运行时数据，由各 provider 按「本次真正取到数据」的部分裁剪。
 */

/* ===================== 天气现象 ===================== */

/**
 * 天气现象类型（归一化枚举，由 description 文本推导）
 * 供渲染端驱动图标选择与动态背景主题
 */
export type WeatherCondition =
  | 'sunny'     // 晴
  | 'cloudy'    // 多云
  | 'overcast'  // 阴
  | 'rain'      // 雨
  | 'snow'      // 雪
  | 'thunder'   // 雷暴
  | 'fog'       // 雾
  | 'haze'      // 霾 / 沙尘
  | 'wind'      // 大风
  | 'unknown';  // 未知

/* ===================== 城市标识（消歧用） ===================== */

/**
 * 结构化城市标识（与渲染端 src/views/weather/types.ts 一一对应）。
 * ------------------------------------------------------------------
 * 区县级行政区划有 30 组重名（如「朝阳区」北京/长春各一），仅靠城市名
 * 无法唯一定位。渲染端在搜索建议中选定候选后生成 CityRef，随查询一路携带
 * ⇒ 主进程用 adcode / 坐标精确命中，不再猜测。
 *
 * 兼容性：老历史/老缓存无 cityRef，回落到 name 走分层匹配。
 */
export interface CityRef {
  /** 城市全名（如「朝阳区」「赣州市」） */
  name: string;
  /** 国家行政区划代码（唯一，首选定位依据） */
  adcode?: number;
  /** 省级全名 */
  province?: string;
  /** 上级地级市全名 */
  city?: string;
  /** 展示路径 */
  path?: string;
  /** 已确定的坐标 */
  lng?: number;
  lat?: number;
}

/* ===================== 数据源标识 ===================== */

/** Provider 唯一标识 */
export type ProviderId =
  | 'qweather'    // 和风天气
  | 'openMeteo'   // Open-Meteo（零 Key）
  | 'crawler'     // 内置爬虫（中国天气网）
  | 'seniverse'   // 心知天气（预留）
  | 'amap'        // 高德（预留）
  | 'caiyun'      // 彩云（预留）
  | 'openWeather' // OpenWeatherMap（预留）
  | 'wttr';       // wttr.in（预留）

/* ===================== 字段能力 ===================== */

/**
 * 字段能力标识 —— 渲染端「分级展示」的唯一依据
 * 命名规则：`域.字段`，域名取 current / forecast / astro / indices / air / alert / minutely / location
 */
export type WeatherCapability =
  | 'current.temperature'    // 实时温度
  | 'current.feelsLike'      // 体感温度
  | 'current.humidity'       // 湿度
  | 'current.windDirection'  // 风向
  | 'current.windSpeed'      // 风速 / 风力
  | 'current.windScale'      // 风力等级（蒲福风级）
  | 'current.windGust'       // 阵风
  | 'current.pressure'       // 气压
  | 'current.visibility'     // 能见度
  | 'current.dewPoint'       // 露点
  | 'current.cloudCover'     // 云量
  | 'current.precipitation'  // 降水量 / 强度
  | 'current.uvIndex'        // 实时紫外线
  | 'current.isDay'          // 昼夜标志
  | 'forecast.daily'         // 逐日预报
  | 'forecast.dailyWind'     // 逐日预报带风向风力
  | 'forecast.hourly'        // 逐小时预报
  | 'forecast.precipitation' // 预报降水概率
  | 'forecast.uvIndexMax'    // 预报最大紫外线
  | 'astro.sunriseSunset'    // 日出日落
  | 'astro.moonPhase'        // 月相
  | 'indices.life'           // 生活指数
  | 'air.quality'            // 空气质量 AQI
  | 'alert.warning'          // 天气预警
  | 'minutely.precipitation' // 分钟级降水
  | 'location.geo';          // 支持中文城市名直接查询

/* ===================== 数据模型 ===================== */

/** 单日预报数据 */
export interface ForecastDay {
  /** 日期文本（如「今天」「08-30」） */
  date: string;
  /** 最高温度（℃） */
  high: number;
  /** 最低温度（℃） */
  low: number;
  /** 天气描述文本 */
  description: string;
  /** 归一化天气现象类型 */
  icon: string;
  /** 风向（如「东风转东南风」，可选） */
  windDirection?: string;
  /** 风力等级（如「<3级」，可选） */
  windPower?: string;
}

/** 逐小时预报 */
export interface HourlyForecast {
  /** 时间文本（HH:mm） */
  time: string;
  /** 温度（℃） */
  temperature: number;
  /** 归一化天气现象类型 */
  condition: WeatherCondition;
  /** 降水概率（%，可选） */
  precipProbability?: number;
}

/** 分钟级降水（未来 2 小时） */
export interface MinutelyRain {
  /** 摘要文案（如「未来 2 小时无降水」） */
  summary: string;
  /** 逐 5 分钟降水强度（mm/h），长度 24 */
  values: number[];
}

/** 空气质量 */
export interface AirQuality {
  /** 空气质量指数 */
  aqi: number;
  /** 等级文案（如「优」「良」） */
  category: string;
  /** 首要污染物（可选） */
  primary?: string;
  /** PM2.5 浓度（μg/m³，可选） */
  pm25?: number;
}

/** 天气预警 */
export interface WeatherWarning {
  /** 预警标题 */
  title: string;
  /** 严重程度（Minor / Moderate / Severe / Extreme） */
  severity: string;
  /** 预警详情文本 */
  text: string;
  /** 预警类型名（如「暴雨」），可选 */
  type?: string;
}

/** 日出日落与月相 */
export interface AstroInfo {
  /** 日出时间（HH:mm） */
  sunrise?: string;
  /** 日落时间（HH:mm） */
  sunset?: string;
  /** 主导月相（中文） */
  moonPhase?: string;
}

/** 生活指数（穿衣/洗车/紫外线/运动/感冒/过敏等） */
export interface WeatherIndex {
  /** 指数名称（不含「指数」后缀，如「穿衣」「洗车」） */
  name: string;
  /** 等级（如「炎热」「不宜」「最弱」） */
  level: string;
  /** 建议文案 */
  tip: string;
}

/** 单个数据源本次请求的状态 */
export interface ProviderTrace {
  /** Provider 标识 */
  id: ProviderId;
  /** Provider 展示名 */
  label: string;
  /** 本次是否成功 */
  ok: boolean;
  /** 耗时（ms） */
  ms: number;
  /** 失败原因（ok 为 false 时有值） */
  error?: string;
}

/**
 * 天气数据（主进程 get-weather 返回结构）
 *
 * 【基础字段】必填 —— 兼容 v1 契约，adapter 负责归一化兜底，
 * 既有组件（WeatherHero / DailyForecast / useWeatherTheme）无需改动。
 *
 * 【扩展字段】全部可选 —— 由 capabilities 能力清单决定渲染与否。
 */
export interface WeatherData {
  /* ---------- 基础字段（必填） ---------- */
  /** 当前温度（℃） */
  temperature: number;
  /** 体感温度（℃） */
  feelsLike: number;
  /** 天气描述文本 */
  description: string;
  /** 湿度（%） */
  humidity: number;
  /** 风向（如「东南风」） */
  windDirection: string;
  /** 风力（如「3级」） */
  windSpeed: string;
  /** 能见度（km） */
  visibility: number;
  /** 数据更新时间戳（ms） */
  updateTime: number;
  /** 未来预报列表 */
  forecast: ForecastDay[];
  /** 城市名 */
  city: string;
  /** 归一化天气现象类型 */
  condition: WeatherCondition;

  /* ---------- 扩展字段（全部可选） ---------- */
  /** 数据来源站展示名（如「和风天气」） */
  source?: string;
  /** 生活指数列表 */
  indices?: WeatherIndex[];
  /** 本数据实际具备的字段能力清单（分级展示依据） */
  capabilities?: WeatherCapability[];
  /** 气压（hPa） */
  pressure?: number;
  /** 露点（℃） */
  dewPoint?: number;
  /** 云量（%） */
  cloudCover?: number;
  /** 阵风（km/h） */
  windGust?: number;
  /** 风力等级（蒲福风级，如 3） */
  windScale?: number;
  /** 降水量（mm，近 1 小时） */
  precipitation?: number;
  /** 降水强度文本（如「小雨」） */
  precipitationText?: string;
  /** 实时紫外线指数 */
  uvIndex?: number;
  /** 昼夜（true = 白天） */
  isDay?: boolean;
  /** 空气质量 */
  airQuality?: AirQuality;
  /** 天气预警列表 */
  warnings?: WeatherWarning[];
  /** 逐小时预报（未来 24 小时） */
  hourly?: HourlyForecast[];
  /** 分钟级降水 */
  minutely?: MinutelyRain;
  /** 日出日落与月相 */
  astro?: AstroInfo;
  /** 本次请求的降级轨迹（调试面板与来源标识使用） */
  _trace?: ProviderTrace[];
}

/* ===================== Provider 契约 ===================== */

/** Provider 配置字段定义（配置页据此动态渲染表单） */
export interface ProviderConfigField {
  /** 字段键（存于 providers[id].options / credentials） */
  key: string;
  /** 展示标签 */
  label: string;
  /** 控件类型 */
  type: 'text' | 'password' | 'textarea' | 'select' | 'number';
  /** 是否必填 */
  required?: boolean;
  /** 是否敏感（落库加密、回显脱敏） */
  secret?: boolean;
  /** 占位提示 */
  placeholder?: string;
  /** 帮助说明 */
  help?: string;
  /** type = select 时的选项 */
  options?: { label: string; value: string }[];
  /** 默认值 */
  default?: string;
  /** 条件显示：仅当同源另一字段等于指定值时展示（如 authMode = jwt） */
  when?: Record<string, string>;
}

/** 运行期凭据与选项（已解密） */
export interface ProviderRuntimeConfig {
  /** 非敏感选项 */
  options: Record<string, string>;
  /** 敏感凭据（已解密） */
  credentials: Record<string, string>;
  /** 请求超时（ms） */
  timeout: number;
  /** 强制刷新 */
  forceRefresh: boolean;
  /**
   * 城市消歧提示（渲染端选定候选后回传）。
   * 有 adcode / 坐标时，provider 应优先按它定位，跳过名称猜测。
   */
  cityRef?: CityRef;
  /**
   * 【主进程内部注入】本地坐标表解析出的坐标（由 registry 统一计算）。
   * 供需要「经纬度定位」的 provider（彩云 / OpenWeather / wttr / 高德 / Open-Meteo）直接复用，
   * 避免各自重复解析；为 undefined 表示本地表未收录该城市。
   */
  __coords?: { lat: number; lon: number } | null;
}

/** Provider 适配器接口 */
export interface WeatherProvider {
  /** 唯一标识 */
  id: ProviderId;
  /** 展示名（写入 WeatherData.source） */
  label: string;
  /** 是否零配置即可用（无需 Key / Host） */
  zeroConfig: boolean;
  /**
   * 静态能力清单（不随请求变化）。
   * 渲染端与配置页据此预判；实际返回时会按「真拿到数据的部分」二次裁剪。
   */
  capabilities: WeatherCapability[];
  /** 配置项定义（配置页动态表单依据） */
  configSchema: ProviderConfigField[];
  /**
   * 主流程：按城市名取天气
   * @param city 城市名（中文）
   * @param config 运行期配置（凭据已解密）
   * @returns 统一结构的天气数据（基础字段必须齐全）
   * @throws 失败时抛错，由 registry 决定是否降级
   */
  fetch(city: string, config: ProviderRuntimeConfig): Promise<WeatherData>;
  /**
   * 连通性 / 凭据自检（配置页「测试连接」按钮）
   * @param config 草稿配置（可直接用表单未保存的值）
   */
  probe?(config: ProviderRuntimeConfig): Promise<{ ok: boolean; message: string }>;
}

/* ===================== 模块配置 ===================== */

/** 单个 Provider 的用户配置 */
export interface ProviderUserConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 非敏感选项 */
  options?: Record<string, string>;
  /** 敏感凭据（落库前拆分单独加密） */
  credentials?: Record<string, string>;
}

/** 天气模块整体配置 */
export interface WeatherModuleConfig {
  /** Provider 优先级顺序（数组即降级顺序） */
  providerOrder: ProviderId[];
  /**
   * 首选数据源（可空 = 不指定，纯按 providerOrder 降级）。
   *
   * 语义：有值时该源被**提到降级链最前面**优先请求；若它未启用 / 未配置凭据，
   * 则忽略本项直接走 providerOrder；若它请求失败（报错 / 超时 / 数据不完整），
   * 记 trace 后继续按 providerOrder 降级到其余源。
   */
  preferredProvider?: ProviderId | null;
  /** 各 Provider 的独立配置 */
  providers: Partial<Record<ProviderId, ProviderUserConfig>>;
  /** 请求超时（ms） */
  requestTimeout: number;
  /** 主进程内存缓存时长（ms） */
  cacheDuration: number;
}

/** Provider 在配置页的展示快照 */
export interface ProviderSummary {
  /** Provider 标识 */
  id: ProviderId;
  /** 展示名 */
  label: string;
  /** 是否零配置 */
  zeroConfig: boolean;
  /** 静态能力清单 */
  capabilities: WeatherCapability[];
  /** 必填配置项是否已填齐 */
  configured: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 配置项定义 */
  configSchema: ProviderConfigField[];
}

/** 敏感字段的脱敏回显状态 */
export interface SecretStatus {
  /** 是否已配置 */
  configured: boolean;
  /** 脱敏预览（如 `abc****xyz`） */
  preview: string;
}

/** 供配置页读取的脱敏配置（绝不包含明文凭据） */
export interface WeatherConfigForUi {
  /** 优先级顺序 */
  providerOrder: ProviderId[];
  /** 首选数据源（null = 自动按优先级） */
  preferredProvider: ProviderId | null;
  /** 各 Provider 非敏感配置 */
  providers: Partial<Record<ProviderId, {
    enabled: boolean;
    options?: Record<string, string>;
  }>>;
  /** 请求超时 */
  requestTimeout: number;
  /** 缓存时长 */
  cacheDuration: number;
  /** 敏感字段状态（键形如 `qweather.privateKey`） */
  secretStatus: Record<string, SecretStatus>;
  /** 全部可用 Provider 快照 */
  availableProviders: ProviderSummary[];
}
