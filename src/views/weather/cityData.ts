/**
 * 天气搜索城市映射数据
 * ------------------------------------------------------------------
 * 数据来源：主进程 `weather:resolve-city`（DataV.GeoAtlas 全国快照，
 * 3237 条：34 省 + 363 地级市 + 2840 区县），**不再手写**。
 *
 * 历史：本文件原先手写「省会 31 + 全国地级市 + 6 个省的县级」，
 * 导致其他省份的县级（如「义乌」「简阳」）在搜索建议里根本不出现。
 * 现改为异步从主进程取全量候选 ⇒ 全国区县都能搜到，且与坐标表同源。
 *
 * 用途：搜索建议（输入关键字匹配城市名）；
 * 查询走 `CityRef`（含 adcode），由 cityResolver.ts 负责消歧。
 */

import { fetchCityCandidates, candidateToRef } from './cityResolver'
import type { CityCandidate } from './cityResolver'
import type { CityRef } from './types'

/** 城市层级（建议项标签用） */
export type CityLevel = 'capital' | 'prefecture' | 'county'

/** 城市条目（搜索建议项） */
export interface CityEntry {
  /** 城市全名（如「南康区」「赣州市」） */
  name: string
  /** 所属省份全名（如「江西省」） */
  province: string
  /** 层级：capital=省会/直辖市，prefecture=地级市，county=县级/城区 */
  level: CityLevel
  /** 实际查询词（县级取去后缀的短名，如「南康」） */
  searchName: string
  /** 行政区划代码（消歧用，随查询一起传给主进程） */
  adcode: number
  /** 展示路径（如「江西省 · 赣州市 · 南康区」） */
  path: string
  /** 所属地级市全名 */
  city: string
  /** 坐标 */
  lng: number
  /** lat */
  lat: number
  /** 消歧标识（选中该项后随查询携带） */
  ref: CityRef
}

/**
 * 主进程层级 → 前端层级标签
 * @param level 主进程 level（1=省 2=地级市 3=区县）
 * @returns 前端层级
 */
function toLevel(level: number): CityLevel {
  if (level === 1) return 'capital'
  if (level === 2) return 'prefecture'
  return 'county'
}

/**
 * 把主进程候选转为建议条目
 * @param c 主进程候选
 * @returns 建议条目（含可直接使用的 CityRef）
 */
function candidateToEntry(c: CityCandidate): CityEntry {
  return {
    name: c.name,
    province: c.province,
    level: toLevel(c.level),
    searchName: c.short || c.name,
    adcode: c.adcode,
    path: c.path,
    city: c.city,
    lng: c.lng,
    lat: c.lat,
    ref: candidateToRef(c),
  }
}

/** 建议排序：省会/直辖市优先 → 地级市 → 区县；同级按名称长度 */
const LEVEL_ORDER: Record<CityLevel, number> = {
  capital: 0,
  prefecture: 1,
  county: 2,
}

/**
 * 按关键字搜索城市条目（数据来自主进程全量快照）
 * @param keyword 关键字（为空时返回省会/直辖市列表）
 * @param limit 返回条数上限，默认 20
 * @returns 匹配的城市条目列表（省会 → 地级市 → 区县）
 */
export async function searchCityEntries(keyword: string, limit = 20): Promise<CityEntry[]> {
  const key = keyword.trim()
  // 空串由主进程解释为「全部省级」，无须单独分支
  const candidates = await fetchCityCandidates(key)

  const entries = candidates.map(candidateToEntry)
  entries.sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.length - b.name.length
  )
  return entries.slice(0, limit)
}

/** 层级中文标签（建议项展示用） */
export const CITY_LEVEL_LABEL: Record<CityLevel, string> = {
  capital: '省会',
  prefecture: '地级市',
  county: '区县',
}
