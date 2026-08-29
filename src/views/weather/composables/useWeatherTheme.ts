/**
 * 天气主题组合式函数
 * 根据天气现象与昼夜时间，计算页面背景主题与展示图标
 */
import { computed, type Ref } from 'vue'
import type { WeatherData } from '../types'
import { CONDITION_ICON_MAP, CONDITION_THEME_MAP } from '../constants'

/**
 * 创建天气主题控制器
 * @param weatherData 天气数据响应式引用
 * @returns 主题类名与图标名等派生状态
 */
export function useWeatherTheme(weatherData: Ref<WeatherData | null>) {
  /** 当前是否为夜间（18:00 - 6:00 视为夜间） */
  const isNight = computed(() => {
    const hour = new Date().getHours()
    return hour < 6 || hour >= 18
  })

  /** 归一化天气现象类型（无数据时回退为多云） */
  const condition = computed(() => weatherData.value?.condition || 'cloudy')

  /** 页面背景渐变（动态内联样式，随天气与昼夜切换） */
  const backgroundStyle = computed(() => {
    const theme = CONDITION_THEME_MAP[condition.value] || CONDITION_THEME_MAP.unknown
    return { background: isNight.value ? theme.night : theme.day }
  })

  /** 主卡天气图标名（区分昼夜图标） */
  const heroIcon = computed(() => {
    const icons = CONDITION_ICON_MAP[condition.value] || CONDITION_ICON_MAP.unknown
    return (isNight.value && icons.night) ? icons.night : icons.day
  })

  /**
   * 预报条目图标名（预报无昼夜信息，统一使用 day 图标）
   * @param conditionText 预报条目的归一化天气现象类型
   * @returns Lucide 图标名
   */
  function forecastIcon(conditionText: string): string {
    const icons = CONDITION_ICON_MAP[conditionText as keyof typeof CONDITION_ICON_MAP]
    return icons ? icons.day : CONDITION_ICON_MAP.unknown.day
  }

  return { isNight, condition, backgroundStyle, heroIcon, forecastIcon }
}
