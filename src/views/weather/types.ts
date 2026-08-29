/**
 * 天气模块类型定义
 * 与主进程 electron/main/module/weather.ts 的数据结构保持一致
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

/** 生活指数（穿衣/洗车/紫外线/运动/感冒/过敏等） */
export interface WeatherIndex {
  /** 指数名称（不含「指数」后缀，如「穿衣」「洗车」） */
  name: string
  /** 等级（如「炎热」「不宜」「最弱」） */
  level: string
  /** 建议文案 */
  tip: string
}

/** 天气数据（主进程 get-weather 返回结构） */
export interface WeatherData {
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
  /** 生活指数列表（来源站支持时返回） */
  indices?: WeatherIndex[]
  /** 数据来源站名称（如「中国天气网」） */
  source?: string
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
