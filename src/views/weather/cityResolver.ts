/**
 * 天气模块 - 城市消歧（渲染端）
 * ------------------------------------------------------------------
 * 背景：区县级行政区划有 30 组重名（如「朝阳区」北京/长春各一、
 * 「新华区」有 3 个）。仅靠城市名无法唯一定位，因此：
 *
 *   1. 候选解析走主进程 `weather:resolve-city`（数据只在主进程维护一份，
 *      且主进程已建好索引，无需渲染端重复加载 3237 条数据）；
 *   2. 用户选定后生成 CityRef，随查询一路携带 ⇒ 后续零猜测；
 *   3. 「记住选择」：把 `城市名 → adcode` 存在本地，下次同名查询直接采用，
 *      不再弹下拉。
 *
 * 缓存策略：
 *   - 候选结果按查询词内存缓存（同一关键词不重复走 IPC）；
 *   - 已记住的选择按城市名缓存，命中即直接返回 CityRef。
 */

import type { CityRef } from './types'
import { resolveCityCandidates } from './api'
import type { CityCandidate } from './api'

export type { CityCandidate }

/** 候选内存缓存：查询词 → 候选数组 */
const candidateCache = new Map<string, CityCandidate[]>()

/** 已记住的选择：城市名（去后缀短名或全名）→ adcode */
let remembered: Record<string, number> | null = null

/** 记住选择的存储键 */
const REMEMBER_KEY = 'weather-city-remember'

/**
 * 读取「已记住的城市选择」
 * @returns { 城市名: adcode } 映射（读取失败返回空对象）
 */
function loadRemembered(): Record<string, number> {
  if (remembered) return remembered
  let next: Record<string, number> = {}
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === 'object') next = parsed as Record<string, number>
  } catch {
    next = {}
  }
  remembered = next
  return next
}

/**
 * 记住用户对某个城市名的选择
 * @param key 城市名（同时按全名与去后缀短名记录，提高命中率）
 * @param adcode 行政区划代码
 */
export function rememberCityChoice(key: string, adcode: number): void {
  const map = loadRemembered()
  if (!key) return
  map[key] = adcode
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(map))
  } catch {
    // 存储不可用时仅内存生效，不阻断主流程
  }
}

/**
 * 读取该城市名「已记住的选择」
 * @param key 城市名
 * @returns 记住的 adcode，未记住返回 undefined
 */
export function getRememberedAdcode(key: string): number | undefined {
  const map = loadRemembered()
  if (!key) return undefined
  return map[key]
}

/** 清空全部已记住的选择（调试 / 重置用） */
export function clearRemembered(): void {
  remembered = {}
  try {
    localStorage.removeItem(REMEMBER_KEY)
  } catch {
    // 忽略
  }
}

/**
 * 查询城市候选（走主进程，带内存缓存）
 * @param keyword 查询词
 * @returns 候选数组（无命中或调用失败返回空数组）
 */
export async function fetchCityCandidates(keyword: string): Promise<CityCandidate[]> {
  const key = (keyword || '').trim()

  const cached = candidateCache.get(key)
  if (cached) return cached

  try {
    const list = await resolveCityCandidates(key)
    candidateCache.set(key, list)
    return list
  } catch {
    return []
  }
}

/** 按 adcode 精确定位候选（从缓存里找，避免再次 IPC） */
export function findCandidateByAdcode(list: CityCandidate[], adcode: number): CityCandidate | undefined {
  return list.find((c) => c.adcode === adcode)
}

/**
 * 把候选转为 CityRef（携带精确标识与坐标）
 * @param c 候选
 * @returns CityRef
 */
export function candidateToRef(c: CityCandidate): CityRef {
  return {
    name: c.name,
    adcode: c.adcode,
    province: c.province,
    city: c.city,
    path: c.path,
    lng: c.lng,
    lat: c.lat,
  }
}

/**
 * 为一次查询决定 CityRef。
 * ------------------------------------------------------------------
 * 优先级：
 *   1. 用户**已记住**该名称的选择 → 直接用（不再打扰）；
 *   2. 候选**唯一** → 直接用（无歧义，无需打断用户）；
 *   3. 候选**多个** → 返回 `null`，由调用方弹出下拉让用户选择。
 *
 * @param keyword 查询词
 * @returns `{ ref, candidates }`：ref 有值表示可直接查询；ref 为 null 表示需用户选择
 */
export async function resolveCityForQuery(
  keyword: string
): Promise<{ ref: CityRef | null; candidates: CityCandidate[] }> {
  const key = (keyword || '').trim()
  if (!key) return { ref: null, candidates: [] }

  const list = await fetchCityCandidates(key)

  // 1. 已记住的选择优先
  const rememberedAdcode = getRememberedAdcode(key)
  if (rememberedAdcode !== undefined) {
    const hit = findCandidateByAdcode(list, rememberedAdcode)
    if (hit) return { ref: candidateToRef(hit), candidates: list }
  }

  // 2. 无候选 / 唯一候选 → 不打扰
  if (list.length <= 1) {
    return { ref: list.length === 1 ? candidateToRef(list[0]) : null, candidates: list }
  }

  // 3. 多个候选 → 交给调用方弹下拉
  return { ref: null, candidates: list }
}

/**
 * 判断某次查询是否需要用户消歧（候选 ≥2 且未被记住）
 * @param keyword 查询词
 * @returns 需要返回 true
 */
export async function needsDisambiguation(keyword: string): Promise<boolean> {
  const { ref, candidates } = await resolveCityForQuery(keyword)
  return ref === null && candidates.length >= 2
}

/**
 * 为「历史标签 / 星标标签」这类只有城市名的入口解析 CityRef。
 * ------------------------------------------------------------------
 * 标签本身只存了城市名字符串（表结构未存 adcode），点击时按名称重新解析：
 *   1. 优先取「已记住的选择」；
 *   2. 否则取候选中的第一个（即查询时排序最优的那个，与曾经的展示一致）；
 *   3. 都拿不到则返回 null，走主进程按名称分层匹配（老行为）。
 *
 * 注意：候选缓存已被 `fetchCityCandidates` 覆盖，标签点击不会产生额外 IPC
 * （该关键词在首次搜索时已查过）。
 *
 * @param city 城市名
 * @returns CityRef 或 null（无法解析）
 */
export async function resolveCityRefByName(city: string): Promise<CityRef | null> {
  const key = (city || '').trim()
  if (!key) return null

  const { ref, candidates } = await resolveCityForQuery(key)
  if (ref) return ref
  // 有候选但需消歧（历史入口无法弹下拉）→ 采用排序首位，与搜索时的默认展示保持一致
  if (candidates.length > 0) return candidateToRef(candidates[0])
  return null
}
