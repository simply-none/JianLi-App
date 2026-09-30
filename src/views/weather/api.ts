/**
 * 天气模块 IPC 调用封装（渲染端）
 * ------------------------------------------------------------------
 * 把主进程通道名与返回结构收敛到一处，组件不直接拼字符串。
 *
 * 通道清单（详见 electron/main/module/weather/index.ts）：
 * - get-weather                取天气（兼容旧契约，可携带 CityRef 消歧）
 * - weather:resolve-city       解析城市候选（消歧下拉用）
 * - weather:get-config         读脱敏配置 + 数据源快照
 * - weather:save-config        保存配置（凭据自动加密）
 * - weather:probe-provider     测试单个数据源连通性
 * - weather:available-providers 数据源快照
 */
import { toRaw } from 'vue'
import type {
  CityRef,
  ProviderId,
  ProviderSummary,
  WeatherConfigForUi,
  WeatherConfigSavePayload,
  WeatherData,
} from './types'

/**
 * 把任意值剥离为「可结构化克隆」的纯数据。
 * ------------------------------------------------------------------
 * Electron 的 IPC 走结构化克隆算法，**无法克隆 Proxy 对象**
 * （Vue 的 `reactive()` / `ref()` 包装后的值都是 Proxy），
 * 直接传会在 invoke 时抛 `An object could not be cloned.`。
 *
 * `toRaw()` 只能剥掉最外层，深层仍是 Proxy，故递归下钻；
 * 遇到嵌套的 reactive 值也能一并剥净。函数 / Symbol 无法克隆，直接丢弃。
 */
function toPlain<T>(value: T): T {
  const raw = toRaw(value as object) as unknown
  if (raw === null || typeof raw !== 'object') return raw as T
  if (Array.isArray(raw)) return raw.map((v) => toPlain(v)) as unknown as T
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v === 'function' || typeof v === 'symbol') continue
    out[key] = toPlain(v)
  }
  return out as unknown as T
}

/**
 * 取天气（兼容旧契约）
 * @param city 城市名
 * @param forceRefresh 是否强制刷新
 * @param providerId 指定单一数据源（不降级），省略则走降级链
 * @param cityRef 城市消歧提示（含 adcode 时主进程直接按行政区划代码定位坐标）
 */
export async function fetchWeather(
  city: string,
  forceRefresh = false,
  providerId?: ProviderId,
  cityRef?: CityRef
): Promise<WeatherData> {
  const result = await window.ipcRenderer.invoke(
    'get-weather',
    toPlain({ city, forceRefresh, providerId, cityRef })
  )
  if (!result || result.error) {
    throw new Error(result?.error || '获取天气失败')
  }
  return result as WeatherData
}

/**
 * 解析城市候选（消歧用）
 * ------------------------------------------------------------------
 * 数据源：主进程 DataV.GeoAtlas 全国快照（3237 条），渲染端不落数据副本。
 * @param keyword 查询词（空串返回省级列表）
 * @returns 候选数组（含 adcode/坐标/所属省市区路径）
 */
export async function resolveCityCandidates(keyword: string): Promise<CityCandidate[]> {
  const result = await window.ipcRenderer.invoke('weather:resolve-city', keyword)
  return Array.isArray(result) ? (result as CityCandidate[]) : []
}

/** 主进程返回的城市候选结构 */
export interface CityCandidate {
  adcode: number
  name: string
  short: string
  level: number
  lng: number
  lat: number
  province: string
  provinceShort: string
  city: string
  cityShort: string
  path: string
}

/** 读取脱敏配置与数据源快照 */
export async function fetchWeatherConfig(): Promise<WeatherConfigForUi> {
  const result = await window.ipcRenderer.invoke('weather:get-config')
  if (result?.error) throw new Error(result.error)
  return result as WeatherConfigForUi
}

/** 保存配置 */
export async function saveWeatherConfig(
  payload: WeatherConfigSavePayload
): Promise<{ ok: boolean; message: string }> {
  const result = await window.ipcRenderer.invoke('weather:save-config', toPlain(payload))
  return result ?? { ok: false, message: '未知错误' }
}

/** 测试单个数据源连通性（可用未保存的草稿凭据） */
export async function probeWeatherProvider(
  id: ProviderId,
  draft: { options?: Record<string, string>; credentials?: Record<string, string>; timeout?: number }
): Promise<{ ok: boolean; message: string }> {
  const result = await window.ipcRenderer.invoke('weather:probe-provider', toPlain({ id, ...draft }))
  return result ?? { ok: false, message: '未知错误' }
}

/** 读取数据源快照 */
export async function fetchAvailableProviders(): Promise<ProviderSummary[]> {
  const result = await window.ipcRenderer.invoke('weather:available-providers')
  return Array.isArray(result) ? (result as ProviderSummary[]) : []
}
