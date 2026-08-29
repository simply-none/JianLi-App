/**
 * 天气模块常量定义
 * 包含天气现象图标映射、背景主题映射、热门城市列表、缓存配置
 */
import type { WeatherCondition } from './types'

/**
 * 天气现象 → Lucide 图标名映射表
 * 白天 / 夜间可分别指定，夜间未配置时回退到 day 图标
 */
export const CONDITION_ICON_MAP: Record<WeatherCondition, { day: string; night?: string }> = {
  sunny: { day: 'Sun', night: 'Moon' },
  cloudy: { day: 'CloudSun', night: 'CloudMoon' },
  overcast: { day: 'Cloudy' },
  rain: { day: 'CloudRain' },
  snow: { day: 'CloudSnow' },
  thunder: { day: 'CloudLightning' },
  fog: { day: 'CloudFog' },
  haze: { day: 'Haze' },
  wind: { day: 'Wind' },
  unknown: { day: 'Cloudy' },
}

/**
 * 天气现象 → 页面背景渐变映射表
 * 每个 condition 提供 day / night 两套渐变，配合毛玻璃卡片使用
 */
export const CONDITION_THEME_MAP: Record<WeatherCondition, { day: string; night: string }> = {
  sunny: {
    day: 'linear-gradient(160deg, #1d6fc4 0%, #4a9fe0 45%, #8fc9ef 100%)',
    night: 'linear-gradient(160deg, #0b1e3a 0%, #17355c 55%, #2c517d 100%)',
  },
  cloudy: {
    day: 'linear-gradient(160deg, #4a7296 0%, #7ba3c2 55%, #a9c4d8 100%)',
    night: 'linear-gradient(160deg, #1a2733 0%, #2c4157 55%, #46617a 100%)',
  },
  overcast: {
    day: 'linear-gradient(160deg, #4b5563 0%, #6b7280 55%, #9ca3af 100%)',
    night: 'linear-gradient(160deg, #1c2128 0%, #2d333d 55%, #424a57 100%)',
  },
  rain: {
    day: 'linear-gradient(160deg, #2f5d7c 0%, #4d7f9d 55%, #77a3ba 100%)',
    night: 'linear-gradient(160deg, #0e1c26 0%, #1e3444 55%, #345062 100%)',
  },
  snow: {
    day: 'linear-gradient(160deg, #5b7fa6 0%, #8aa9c6 55%, #c0d4e5 100%)',
    night: 'linear-gradient(160deg, #232f42 0%, #3a4a63 55%, #5a6e8a 100%)',
  },
  thunder: {
    day: 'linear-gradient(160deg, #3a3a55 0%, #55557a 55%, #7a7a9e 100%)',
    night: 'linear-gradient(160deg, #17141f 0%, #2a2438 55%, #423a55 100%)',
  },
  fog: {
    day: 'linear-gradient(160deg, #5d6b74 0%, #8794a0 55%, #b4bfca 100%)',
    night: 'linear-gradient(160deg, #20262b 0%, #333c44 55%, #4d5860 100%)',
  },
  haze: {
    day: 'linear-gradient(160deg, #8a744f 0%, #b09668 55%, #d4bd8f 100%)',
    night: 'linear-gradient(160deg, #2e2718 0%, #473d26 55%, #635538 100%)',
  },
  wind: {
    day: 'linear-gradient(160deg, #3c7a72 0%, #5fa39a 55%, #8ec5bd 100%)',
    night: 'linear-gradient(160deg, #12262a 0%, #1e3d42 55%, #2f5a60 100%)',
  },
  unknown: {
    day: 'linear-gradient(160deg, #3d6a94 0%, #628fb5 55%, #8fb4d2 100%)',
    night: 'linear-gradient(160deg, #14202e 0%, #24384c 55%, #3a5470 100%)',
  },
}

/** 热门城市列表（搜索建议兜底数据） */
export const POPULAR_CITIES: string[] = [
  '北京', '上海', '广州', '深圳', '杭州',
  '南京', '成都', '武汉', '西安', '重庆',
  '天津', '苏州', '长沙', '郑州', '青岛',
]

/**
 * 生活指数名称 → Lucide 图标名映射表
 * 图标均已在 @lucide/vue 中验证存在；未命中的指数回退到 Sparkles
 */
export const LIFE_INDEX_ICON_MAP: Record<string, string> = {
  穿衣: 'Shirt',
  洗车: 'Car',
  紫外线: 'Sun',
  运动: 'Dumbbell',
  感冒: 'Thermometer',
  过敏: 'Flower2',
  旅游: 'Sunrise',
  空气污染扩散: 'Wind',
}

/** 生活指数兜底图标名 */
export const LIFE_INDEX_FALLBACK_ICON = 'Sparkles'

/** 数据库历史查询条数上限（最近 10 条） */
export const HISTORY_LIMIT = 10
/** 前端缓存有效期默认值：30 分钟 */
export const CACHE_TTL = 30 * 60 * 1000
/** 缓存时效配置持久化键名 */
export const CACHE_TTL_STORAGE_KEY = 'weather_cache_ttl'

/** 缓存时效选项 */
export interface CacheTtlOption {
  /** 展示文案（如「30 分钟」） */
  label: string
  /** 时效毫秒数 */
  value: number
}

/** 缓存时效可选项（供配置下拉选择） */
export const CACHE_TTL_OPTIONS: CacheTtlOption[] = [
  { label: '5 分钟', value: 5 * 60 * 1000 },
  { label: '30 分钟（默认）', value: 30 * 60 * 1000 },
  { label: '1 小时', value: 60 * 60 * 1000 },
  { label: '6 小时', value: 6 * 60 * 60 * 1000 },
  { label: '24 小时', value: 24 * 60 * 60 * 1000 },
]

/**
 * 读取当前缓存时效配置（localStorage 持久化，跨重启生效）
 * @returns 时效毫秒数；未配置或值非法时返回默认值 CACHE_TTL
 */
export function getCacheTTL(): number {
  try {
    const raw = localStorage.getItem(CACHE_TTL_STORAGE_KEY)
    if (!raw) return CACHE_TTL
    const value = parseInt(raw)
    if (CACHE_TTL_OPTIONS.some((opt) => opt.value === value)) {
      return value
    }
    return CACHE_TTL
  } catch {
    return CACHE_TTL
  }
}

/**
 * 保存缓存时效配置
 * @param ttl 时效毫秒数（必须是 CACHE_TTL_OPTIONS 中的合法值）
 */
export function setCacheTTL(ttl: number): void {
  try {
    localStorage.setItem(CACHE_TTL_STORAGE_KEY, String(ttl))
  } catch {
    // 写入失败不影响主流程
  }
}
