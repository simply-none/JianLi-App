/**
 * 天气数据组合式函数
 * 数据来源优先级：
 *   1. 数据库 weather_data 表（updated_at 未过缓存时效 → 直接展示）
 *   2. 缓存过期或无记录 → 主进程爬虫获取 → 异步 upsert 回数据库
 * 天气数据不再使用 localStorage 存储
 */
import { ref } from 'vue'
import type { WeatherData } from '../types'
import { getCacheTTL } from '../constants'
import { getWeatherRow, saveWeatherToDb } from '../db'

/**
 * 创建天气数据控制器
 * @param onLog 可选的日志回调（调试面板用）
 * @returns 天气状态与操作方法
 */
export function useWeather(onLog?: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void) {
  /** 当前展示的天气数据 */
  const weatherData = ref<WeatherData | null>(null)
  /** 当前城市名 */
  const currentCity = ref('')
  /** 主进程返回的原始数据（调试面板用） */
  const rawData = ref<unknown>(null)
  /** 是否正在加载 */
  const loading = ref(false)
  /** 加载提示文案 */
  const loadingText = ref('')

  /**
   * 尝试从数据库读取未过期的天气数据
   * @param city 城市名
   * @returns 命中且未过期返回天气数据，否则返回 null
   */
  async function readDbCache(city: string): Promise<WeatherData | null> {
    try {
      const row = await getWeatherRow(city)
      if (row && Date.now() - row.updatedAt < getCacheTTL()) {
        return row.data
      }
      return null
    } catch (err) {
      onLog?.(`数据库读取失败: ${(err as Error).message}`, 'warning')
      return null
    }
  }

  /**
   * 按城市加载天气（优先命中数据库缓存）
   * @param city 城市名
   * @param forceRefresh 是否强制刷新（跳过数据库缓存，直接爬取）
   * @throws 网络或解析失败时抛出 Error，由调用方决定提示方式
   */
  async function loadByCity(city: string, forceRefresh = false) {
    loading.value = true
    loadingText.value = `正在获取 ${city} 的天气...`
    onLog?.(`开始获取天气: ${city}, 强制刷新: ${forceRefresh}`, 'info')

    try {
      // 非强制刷新时优先使用数据库缓存（updated_at 未过时效即有效）
      if (!forceRefresh) {
        const cached = await readDbCache(city)
        if (cached) {
          weatherData.value = cached
          currentCity.value = city
          onLog?.(`命中数据库缓存: ${city}`, 'success')
          return
        }
      }

      onLog?.(`IPC 调用 get-weather: city=${city}`, 'info')
      const result = await window.ipcRenderer.invoke('get-weather', { city, forceRefresh })
      rawData.value = result

      // 主进程失败时返回 { error } 对象而非抛异常
      if (!result || result.error) {
        throw new Error(result?.error || '获取天气失败')
      }

      weatherData.value = result as WeatherData
      currentCity.value = city
      onLog?.(`获取成功: ${city}`, 'success')

      // 异步写入数据库天气表（不阻塞展示，失败仅记录日志）
      saveWeatherToDb(city, result as WeatherData)
        .then(() => onLog?.(`已存入数据库天气表: ${city}`, 'success'))
        .catch((err) => onLog?.(`数据库写入失败: ${(err as Error).message}`, 'warning'))
    } finally {
      loading.value = false
    }
  }

  /** 强制刷新当前城市天气 */
  async function refresh() {
    if (currentCity.value) {
      await loadByCity(currentCity.value, true)
    }
  }

  return {
    weatherData,
    currentCity,
    rawData,
    loading,
    loadingText,
    loadByCity,
    refresh,
  }
}
