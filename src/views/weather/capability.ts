/**
 * 天气能力工具（渲染端）
 * ------------------------------------------------------------------
 * 「不同数据源展示不同字段」在前端的唯一判断入口。
 *
 * 核心语义：
 * - useWeatherCapability(data) 返回 has() / caps / hasDomain()
 * - data.capabilities 为空（旧缓存 / 未声明的源）时，has() 一律返回 true
 *   ⇒ 保持 v1 全展示行为，旧数据天然兼容，无需数据库迁移。
 */
import { computed, type ComputedRef, type Ref } from 'vue'
import type { WeatherCapability, WeatherData } from './types'

/** 能力中文名（配置抽屉与调试面板共用） */
export const CAPABILITY_LABEL: Record<WeatherCapability, string> = {
  'current.temperature': '实时温度',
  'current.feelsLike': '体感温度',
  'current.humidity': '湿度',
  'current.windDirection': '风向',
  'current.windSpeed': '风速',
  'current.windScale': '风力等级',
  'current.windGust': '阵风',
  'current.pressure': '气压',
  'current.visibility': '能见度',
  'current.dewPoint': '露点',
  'current.cloudCover': '云量',
  'current.precipitation': '降水量',
  'current.uvIndex': '实时紫外线',
  'current.isDay': '昼夜标识',
  'forecast.daily': '逐日预报',
  'forecast.dailyWind': '预报风向风力',
  'forecast.hourly': '逐小时预报',
  'forecast.precipitation': '预报降水概率',
  'forecast.uvIndexMax': '预报最大紫外线',
  'astro.sunriseSunset': '日出日落',
  'astro.moonPhase': '月相',
  'indices.life': '生活指数',
  'air.quality': '空气质量',
  'alert.warning': '天气预警',
  'minutely.precipitation': '分钟级降水',
  'location.geo': '中文城市名查询',
}

/** 能力分组（配置抽屉按组罗列） */
export const CAPABILITY_GROUP: Record<string, { label: string; caps: WeatherCapability[] }> = {
  current: {
    label: '实时实况',
    caps: [
      'current.temperature', 'current.feelsLike', 'current.humidity',
      'current.windDirection', 'current.windSpeed', 'current.windScale', 'current.windGust',
      'current.pressure', 'current.visibility', 'current.dewPoint', 'current.cloudCover',
      'current.precipitation', 'current.uvIndex', 'current.isDay',
    ],
  },
  forecast: {
    label: '预报',
    caps: [
      'forecast.daily', 'forecast.dailyWind', 'forecast.hourly',
      'forecast.precipitation', 'forecast.uvIndexMax',
    ],
  },
  astro: { label: '天文', caps: ['astro.sunriseSunset', 'astro.moonPhase'] },
  extra: {
    label: '指数与扩展',
    caps: ['indices.life', 'air.quality', 'alert.warning', 'minutely.precipitation', 'location.geo'],
  },
}

/**
 * 取能力中文名（未登记时回退原标识）
 * @param cap 能力标识
 */
export function capabilityLabel(cap: WeatherCapability): string {
  return CAPABILITY_LABEL[cap] ?? cap
}

/** 能力判断器 */
export interface WeatherCapabilityApi {
  /** 当前数据具备的能力清单（只读） */
  caps: ComputedRef<WeatherCapability[]>
  /**
   * 判断某能力是否可用
   * @param cap 能力标识
   * @returns 未声明 capabilities 时返回 true（兼容旧数据，全展示）
   */
  has: (cap: WeatherCapability) => boolean
  /** 判断某能力域是否有任意一项可用（如 'forecast.'） */
  hasDomain: (prefix: string) => boolean
  /** 是否来自「已知能力清单」的数据源（false = 旧缓存，走全展示） */
  isDeclared: ComputedRef<boolean>
}

/**
 * 创建能力判断器
 * @param data 响应式天气数据（可为 null）
 */
export function useWeatherCapability(data: Ref<WeatherData | null> | ComputedRef<WeatherData | null>): WeatherCapabilityApi {
  const caps = computed<WeatherCapability[]>(() => data.value?.capabilities ?? [])
  const isDeclared = computed(() => Array.isArray(data.value?.capabilities) && data.value!.capabilities!.length > 0)

  const has = (cap: WeatherCapability): boolean => {
    // 未声明能力清单 ⇒ 旧缓存，保持全展示（兼容 v1）
    if (!isDeclared.value) return true
    return caps.value.includes(cap)
  }

  const hasDomain = (prefix: string): boolean => {
    if (!isDeclared.value) return true
    return caps.value.some((c) => c.startsWith(prefix))
  }

  return { caps, has, hasDomain, isDeclared }
}

/** 数据源严重程度 → 展示色调 */
export const WARNING_SEVERITY_COLOR: Record<string, string> = {
  Minor: '#3b82f6',
  Moderate: '#f59e0b',
  Severe: '#ef4444',
  Extreme: '#991b1b',
  Unknown: '#6b7280',
}

/** AQI 等级 → 展示色（国标六级） */
export function aqiColor(aqi: number): string {
  if (aqi <= 50) return '#00b050'
  if (aqi <= 100) return '#d4c000'
  if (aqi <= 150) return '#ff8c00'
  if (aqi <= 200) return '#e02020'
  if (aqi <= 300) return '#8b00a0'
  return '#7a0b0b'
}
