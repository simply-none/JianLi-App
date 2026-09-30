/**
 * 天气模块类型定义（渲染端）
 * 与主进程 electron/main/module/weather/types.ts 保持一一对应，修改需同步两侧。
 *
 * 结构分层：
 * - 基础字段（必填）：兼容 v1 契约，WeatherHero / DailyForecast / useWeatherTheme 直接使用
 * - 扩展字段（可选）：由 capabilities 能力清单决定是否展示
 */

/** 天气现象类型（归一化枚举，由主进程根据描述文本推导） */
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
  | 'unknown'   // 未知

/* ===================== 城市标识（消歧用） ===================== */

/**
 * 结构化城市标识。
 * ------------------------------------------------------------------
 * 背景：区县级行政区划有 30 组重名（如「朝阳区」北京/长春各一、
 * 「新华区」3 个），仅靠城市名无法唯一定位。用户在搜索建议中选定候选后，
 * 生成 CityRef 并随查询、历史、缓存一路携带 ⇒ 后续定位零猜测。
 *
 * 兼容性：老历史/老缓存没有 cityRef，回落到 name 走主进程分层匹配。
 */
export interface CityRef {
  /** 城市全名（如「朝阳区」「赣州市」）—— 同时作为历史/缓存主键与展示名 */
  name: string
  /** 国家行政区划代码（唯一，首选定位依据） */
  adcode?: number
  /** 省级全名（如「吉林省」） */
  province?: string
  /** 上级地级市全名（如「长春市」） */
  city?: string
  /** 展示路径（如「吉林省 · 长春市 · 朝阳区」） */
  path?: string
  /** 已确定的坐标（有则可直接使用，跳过主进程解析） */
  lng?: number
  lat?: number
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
  | 'wttr'        // wttr.in（预留）

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
  | 'current.windScale'      // 风力等级
  | 'current.windGust'       // 阵风
  | 'current.pressure'       // 气压
  | 'current.visibility'     // 能见度
  | 'current.dewPoint'       // 露点
  | 'current.cloudCover'     // 云量
  | 'current.precipitation'  // 降水量
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
  | 'location.geo'           // 支持中文城市名直接查询

/* ===================== 数据模型 ===================== */

/** 单日预报数据 */
export interface ForecastDay {
  /** 日期文本（如「今天」「08-30」） */
  date: string
  /** 最高温度（℃） */
  high: number
  /** 最低温度（℃） */
  low: number
  /** 天气描述文本 */
  description: string
  /** 归一化天气现象类型 */
  icon: string
  /** 风向（如「东风转东南风」，来源站支持时返回） */
  windDirection?: string
  /** 风力等级（如「<3级」，来源站支持时返回） */
  windPower?: string
}

/** 逐小时预报 */
export interface HourlyForecast {
  /** 时间文本（HH:mm） */
  time: string
  /** 温度（℃） */
  temperature: number
  /** 归一化天气现象类型 */
  condition: WeatherCondition
  /** 降水概率（%，可选） */
  precipProbability?: number
}

/** 分钟级降水（未来 2 小时） */
export interface MinutelyRain {
  /** 摘要文案 */
  summary: string
  /** 逐 5 分钟降水强度（mm/h），长度 24 */
  values: number[]
}

/** 空气质量 */
export interface AirQuality {
  /** 空气质量指数 */
  aqi: number
  /** 等级文案（如「优」「良」） */
  category: string
  /** 首要污染物（可选） */
  primary?: string
  /** PM2.5 浓度（μg/m³，可选） */
  pm25?: number
}

/** 天气预警 */
export interface WeatherWarning {
  /** 预警标题 */
  title: string
  /** 严重程度（Minor / Moderate / Severe / Extreme） */
  severity: string
  /** 预警详情文本 */
  text: string
  /** 预警类型名（如「暴雨」），可选 */
  type?: string
}

/** 日出日落与月相 */
export interface AstroInfo {
  /** 日出时间（HH:mm） */
  sunrise?: string
  /** 日落时间（HH:mm） */
  sunset?: string
  /** 主导月相（中文） */
  moonPhase?: string
}

/** 生活指数（穿衣/洗车/紫外线/运动/感冒/过敏等） */
export interface WeatherIndex {
  /** 指数名称（不含「指数」后缀，如「穿衣」「洗车」） */
  name: string
  /** 等级（如「炎热」「不宜」「最弱」） */
  level: string
  /** 建议文案 */
  tip: string
}

/** 单个数据源本次请求的状态 */
export interface ProviderTrace {
  /** Provider 标识 */
  id: ProviderId
  /** Provider 展示名 */
  label: string
  /** 本次是否成功 */
  ok: boolean
  /** 耗时（ms） */
  ms: number
  /** 失败原因（ok 为 false 时有值） */
  error?: string
}

/** 天气数据（主进程 get-weather 返回结构） */
export interface WeatherData {
  /* ---------- 基础字段（必填） ---------- */
  /** 当前温度（℃） */
  temperature: number
  /** 体感温度（℃） */
  feelsLike: number
  /** 天气描述文本 */
  description: string
  /** 湿度（%） */
  humidity: number
  /** 风向（如「东南风」） */
  windDirection: string
  /** 风力（如「3级」） */
  windSpeed: string
  /** 能见度（km） */
  visibility: number
  /** 数据更新时间戳（ms） */
  updateTime: number
  /** 未来预报列表 */
  forecast: ForecastDay[]
  /** 城市名 */
  city: string
  /** 归一化天气现象类型 */
  condition: WeatherCondition

  /* ---------- 扩展字段（全部可选） ---------- */
  /** 数据来源站展示名（如「和风天气」） */
  source?: string
  /** 生活指数列表（来源站支持时返回） */
  indices?: WeatherIndex[]
  /** 本数据实际具备的字段能力清单（分级展示依据） */
  capabilities?: WeatherCapability[]
  /** 气压（hPa） */
  pressure?: number
  /** 露点（℃） */
  dewPoint?: number
  /** 云量（%） */
  cloudCover?: number
  /** 阵风（km/h） */
  windGust?: number
  /** 风力等级（蒲福风级，如 3） */
  windScale?: number
  /** 降水量（mm，近 1 小时） */
  precipitation?: number
  /** 降水强度文本（如「小雨」） */
  precipitationText?: string
  /** 实时紫外线指数 */
  uvIndex?: number
  /** 昼夜（true = 白天） */
  isDay?: boolean
  /** 空气质量 */
  airQuality?: AirQuality
  /** 天气预警列表 */
  weatherWarnings?: WeatherWarning[]
  /** 逐小时预报（未来 24 小时） */
  hourly?: HourlyForecast[]
  /** 分钟级降水 */
  minutely?: MinutelyRain
  /** 日出日落与月相 */
  astro?: AstroInfo
  /** 本次请求的降级轨迹 */
  _trace?: ProviderTrace[]
}

/* ===================== 配置相关（与主进程对应） ===================== */

/** Provider 配置字段定义（配置抽屉据此动态渲染表单） */
export interface ProviderConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'textarea' | 'select' | 'number'
  required?: boolean
  secret?: boolean
  placeholder?: string
  help?: string
  options?: { label: string; value: string }[]
  default?: string
  when?: Record<string, string>
}

/** Provider 在配置页的展示快照 */
export interface ProviderSummary {
  id: ProviderId
  label: string
  zeroConfig: boolean
  capabilities: WeatherCapability[]
  configured: boolean
  enabled: boolean
  configSchema: ProviderConfigField[]
}

/** 敏感字段的脱敏回显状态 */
export interface SecretStatus {
  configured: boolean
  preview: string
}

/** 供配置页读取的脱敏配置（绝不包含明文凭据） */
export interface WeatherConfigForUi {
  providerOrder: ProviderId[]
  /** 首选数据源（null = 自动按优先级降级） */
  preferredProvider: ProviderId | null
  providers: Partial<Record<ProviderId, {
    enabled: boolean
    options?: Record<string, string>
  }>>
  requestTimeout: number
  cacheDuration: number
  /** 键形如 `qweather.privateKey` */
  secretStatus: Record<string, SecretStatus>
  availableProviders: ProviderSummary[]
}

/** 保存配置时的入参（credentials 仅含本次用户新填字段） */
export interface WeatherConfigSavePayload {
  providerOrder?: ProviderId[]
  /** 首选数据源；null = 自动按优先级，undefined = 不修改 */
  preferredProvider?: ProviderId | null
  providers?: Partial<Record<ProviderId, {
    enabled?: boolean
    options?: Record<string, string>
    /** 空串 = 保持原值；null = 清空 */
    credentials?: Record<string, string | null>
  }>>
  requestTimeout?: number
  cacheDuration?: number
}

/** 调试日志条目 */
export interface DebugLog {
  /** 日志时间（HH:mm:ss） */
  time: string
  /** 日志级别 */
  type: 'info' | 'success' | 'error' | 'warning'
  /** 日志内容 */
  message: string
}
