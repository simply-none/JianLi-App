/**
 * 天气模块 - 字段能力矩阵
 * ------------------------------------------------------------------
 * 「不同数据源支持不同展示字段」的唯一定义处：
 * - PROVIDER_CAPABILITIES：各 provider 的静态能力清单（渲染端与配置页共用语义）
 * - CAPABILITY_LABEL：能力 → 中文名（配置页展示「本数据源支持：…」）
 * - CAPABILITY_GROUP：能力 → 所属分组（配置页按组罗列，避免一长串）
 *
 * 注意：静态清单只用于「预判」。实际返回的 WeatherData.capabilities 会由
 * 各 adapter 按「本次真正取到数据」的部分做二次裁剪（见各 provider 实现）。
 */

import type { ProviderId, WeatherCapability } from './types.ts';

/** 全部能力标识（按展示顺序排列，供配置页遍历） */
export const ALL_CAPABILITIES: WeatherCapability[] = [
  'current.temperature',
  'current.feelsLike',
  'current.humidity',
  'current.windDirection',
  'current.windSpeed',
  'current.windScale',
  'current.windGust',
  'current.pressure',
  'current.visibility',
  'current.dewPoint',
  'current.cloudCover',
  'current.precipitation',
  'current.uvIndex',
  'current.isDay',
  'forecast.daily',
  'forecast.dailyWind',
  'forecast.hourly',
  'forecast.precipitation',
  'forecast.uvIndexMax',
  'astro.sunriseSunset',
  'astro.moonPhase',
  'indices.life',
  'air.quality',
  'alert.warning',
  'minutely.precipitation',
  'location.geo',
];

/** 能力 → 中文名（配置页与调试面板展示用） */
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
};

/** 能力分组（配置页按组展示） */
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
};

/**
 * 各 Provider 静态能力矩阵
 * 未登记的 Provider 返回空数组（新增 provider 时在此登记）
 */
export const PROVIDER_CAPABILITIES: Record<ProviderId, WeatherCapability[]> = {
  /** 和风天气：字段最全（免费版覆盖实时/预报/指数/AQI/预警/分钟级降水） */
  qweather: [
    'current.temperature', 'current.feelsLike', 'current.humidity',
    'current.windDirection', 'current.windSpeed', 'current.windScale', 'current.windGust',
    'current.pressure', 'current.visibility', 'current.dewPoint', 'current.cloudCover',
    'current.precipitation', 'current.uvIndex', 'current.isDay',
    'forecast.daily', 'forecast.dailyWind', 'forecast.hourly',
    'forecast.precipitation', 'forecast.uvIndexMax',
    'astro.sunriseSunset', 'astro.moonPhase',
    'indices.life', 'air.quality', 'alert.warning',
    'minutely.precipitation', 'location.geo',
  ],

  /** Open-Meteo：零 Key，实况与预报字段很全，但无生活指数/空气质量/预警/月相 */
  openMeteo: [
    'current.temperature', 'current.feelsLike', 'current.humidity',
    'current.windDirection', 'current.windSpeed', 'current.windGust',
    'current.pressure', 'current.visibility', 'current.dewPoint', 'current.cloudCover',
    'current.precipitation', 'current.uvIndex', 'current.isDay',
    'forecast.daily', 'forecast.dailyWind', 'forecast.hourly',
    'forecast.precipitation', 'forecast.uvIndexMax',
    'astro.sunriseSunset',
  ],

  /** 内置爬虫（中国天气网）：字段较少，但生活指数是和风不可用时的唯一来源 */
  crawler: [
    'current.temperature', 'current.humidity',
    'current.windDirection', 'current.windSpeed', 'current.visibility',
    'forecast.daily', 'forecast.dailyWind',
    'indices.life', 'alert.warning',
  ],

  /* ---------- 以下为预留 Provider，接入时补全 ---------- */
  seniverse: [],
  amap: [],
  caiyun: [],
  openWeather: [],
  wttr: [],
};

/**
 * 判断某能力域是否在清单中（前缀匹配，如 'forecast.' 命中 forecast 域全部）
 * @param caps 能力清单
 * @param prefix 前缀（如 'forecast.'）
 */
export function hasCapabilityDomain(caps: WeatherCapability[], prefix: string): boolean {
  return caps.some((c) => c.startsWith(prefix));
}

/**
 * 取能力的中文名（未登记时回退原标识）
 * @param cap 能力标识
 */
export function capabilityLabel(cap: WeatherCapability): string {
  return CAPABILITY_LABEL[cap] ?? cap;
}
