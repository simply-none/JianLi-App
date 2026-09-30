/**
 * 天气数据组合式函数
 * 数据来源优先级：
 *   1. 数据库 weather_data 表（updated_at 未过缓存时效 → 直接展示）
 *   2. 缓存过期或无记录 → 主进程按「数据源降级链」获取 → 异步 upsert 回数据库
 *
 * 数据源由主进程 weather/registry.ts 按用户配置的 providerOrder 依次尝试，
 * 渲染端只需读取返回数据中的 source / capabilities / _trace。
 * 天气数据不再使用 localStorage 存储。
 */
import { ref } from 'vue'
import type { CityRef, ProviderId, WeatherData } from '../types'
import { getCacheTTL } from '../constants'
import { getWeatherRow, saveWeatherToDb } from '../db'
import { fetchWeather } from '../api'

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
  /** 当前城市的消歧标识（含 adcode / 路径；老历史为空表示未消歧） */
  const currentCityRef = ref<CityRef | null>(null)
  /** 主进程返回的原始数据（调试面板用） */
  const rawData = ref<unknown>(null)
  /** 是否正在加载 */
  const loading = ref(false)
  /** 加载提示文案 */
  const loadingText = ref('')

  /**
   * 尝试从数据库读取未过期的天气数据
   * @param city 城市名
   * @returns 命中且未过期返回整行（含 data 与已持久化的 cityRef），否则返回 null
   */
  async function readDbCache(city: string): Promise<{ data: WeatherData; cityRef: CityRef | null } | null> {
    try {
      const row = await getWeatherRow(city)
      if (row && Date.now() - row.updatedAt < getCacheTTL()) {
        return { data: row.data, cityRef: row.cityRef ?? null }
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
   * @param forceRefresh 是否强制刷新（跳过数据库缓存，直接走主进程降级链）
   * @param providerId 指定单一数据源（不做降级），省略则走配置的降级链
   * @param cityRef 城市消歧标识（含 adcode 时主进程零猜测定位；省略则回落名称匹配）
   * @throws 全链路失败时抛出 Error，由调用方决定提示方式
   */
  async function loadByCity(city: string, forceRefresh = false, providerId?: ProviderId, cityRef?: CityRef | null) {
    loading.value = true
    loadingText.value = `正在获取 ${city} 的天气...`
    onLog?.(
      `开始获取天气: ${city}, 强制刷新: ${forceRefresh}${providerId ? `, 指定源: ${providerId}` : ''}${
        cityRef?.adcode ? `, adcode: ${cityRef.adcode}` : ''
      }`,
      'info'
    )

    try {
      // 非强制刷新且未指定数据源时优先使用数据库缓存
      if (!forceRefresh && !providerId) {
        const cached = await readDbCache(city)
        if (cached) {
          weatherData.value = cached.data
          currentCity.value = city
          // 老缓存无 cityRef 时保留调用方传入的值（如已记住的选择）
          currentCityRef.value = cached.cityRef ?? cityRef ?? null
          onLog?.(`命中数据库缓存: ${city}`, 'success')
          return
        }
      }

      onLog?.(`IPC 调用 get-weather: city=${city}${providerId ? `, providerId=${providerId}` : ''}`, 'info')
      const result = await fetchWeather(city, forceRefresh, providerId, cityRef ?? undefined)
      rawData.value = result

      weatherData.value = result
      currentCity.value = city
      currentCityRef.value = cityRef ?? null

      // 记录本次数据源与降级轨迹，便于调试面板定位问题
      const trace = result._trace ?? []
      if (trace.length) {
        const chain = trace.map((t) => `${t.label}${t.ok ? '✓' : '✗'}`).join(' → ')
        onLog?.(`降级链: ${chain}`, 'info')
      }
      onLog?.(`获取成功: ${city}, 来源: ${result.source || '未知'}`, 'success')

      // 异步写入数据库天气表（不阻塞展示，失败仅记录日志）
      saveWeatherToDb(city, result, cityRef ?? undefined)
        .then(() => onLog?.(`已存入数据库天气表: ${city}`, 'success'))
        .catch((err) => onLog?.(`数据库写入失败: ${(err as Error).message}`, 'warning'))
    } finally {
      loading.value = false
    }
  }

  /** 强制刷新当前城市天气（沿用已解析的 cityRef，避免重建时丢失消歧） */
  async function refresh() {
    if (currentCity.value) {
      await loadByCity(currentCity.value, true, undefined, currentCityRef.value)
    }
  }

  return {
    weatherData,
    currentCity,
    currentCityRef,
    rawData,
    loading,
    loadingText,
    loadByCity,
    refresh,
  }
}
