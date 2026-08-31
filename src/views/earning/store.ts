/**
 * 收益看板共享状态（模块级单例）。
 *
 * - 持仓列表持久化到 newSql 表 earning_holdings（key 主键 = `${type}:${code}`）。
 * - 行情快照来自新浪（sina:getBatchQuote）：股票取实时价、基金取净值 + 盘中估值。
 * - 所有收益（市值 / 累计盈亏 / 当日盈亏 / 区间收益 / 组合曲线）均为派生计算。
 * - 红涨绿跌：涨用红、跌用绿（在组件层用 .up / .down 类映射主题 token）。
 */

import { ref, computed } from 'vue'
import { getSqlData, setSqlData, deleteSqlData, getStore, setStore } from '@/utils/common'
import { getBatchQuote, getStockKline, getFundNav } from './api'
import type { Holding, HoldingRow, PortfolioSummary, QuoteSnapshot, SinaBatchItem } from './types'

/** 持仓表名（newSql，建表由主进程按 primaryKey 自动完成） */
const TABLE = 'earning_holdings'
/** 基金估值兜底开关存储键 */
const FALLBACK_KEY = 'earning:estimateFallback'

/** 持仓列表（内存镜像） */
const holdings = ref<Holding[]>([])
/** 行情快照，按 `${type}:${code}` 索引 */
const quotes = ref<Record<string, QuoteSnapshot>>({})
/** 行情加载中 */
const loadingQuotes = ref(false)
/** 基金估值兜底（新浪失败回落天天基金），默认关 */
const estimateFallback = ref(false)

/** 历史序列缓存：cacheKey -> { dates, values } */
const historyCache = new Map<string, { dates: string[]; values: number[] }>()

/** 组合主键 */
function keyOf(type: string, code: string): string {
  return `${type}:${code}`
}

/* ===================== 持仓持久化 ===================== */

function normalize(r: Record<string, any>): Holding {
  return {
    key: r.key,
    type: r.type,
    code: r.code,
    name: r.name || '',
    shares: Number(r.shares) || 0,
    costPrice: Number(r.costPrice) || 0,
    buyDate: r.buyDate || '',
    created_at: r.created_at,
  }
}

/** 从 newSql 读取全部持仓 */
async function loadHoldings(): Promise<void> {
  const res = (await getSqlData({ tableName: TABLE, orderByDesc: 'created_at' })) as any
  const rows = res?.data ?? res?.rows ?? []
  holdings.value = (Array.isArray(rows) ? rows : []).map(normalize)
}

/** 新增 / 更新一条持仓（按 key 主键 upsert 落库 + 更新内存） */
async function saveHolding(input: Omit<Holding, 'key' | 'created_at'> & { key?: string }): Promise<void> {
  const key = input.key || keyOf(input.type, input.code)
  const record: Holding = {
    key,
    type: input.type,
    code: input.code,
    name: input.name,
    shares: input.shares,
    costPrice: input.costPrice,
    buyDate: input.buyDate,
  }
  await setSqlData({ tableName: TABLE, data: record, config: { primaryKey: 'key' } })
  const idx = holdings.value.findIndex((h) => h.key === key)
  if (idx >= 0) holdings.value[idx] = record
  else holdings.value.unshift(record)
  // 拉取该标的行情，使列表即时刷新
  await refreshOne(key, record)
}

/** 删除持仓 */
async function removeHolding(key: string): Promise<void> {
  await deleteSqlData({ tableName: TABLE, conditions: { key } })
  holdings.value = holdings.value.filter((h) => h.key !== key)
  delete quotes.value[key]
}

/* ===================== 行情快照 ===================== */

/** 把主进程批量结果转换为统一快照 */
function toSnapshot(it: SinaBatchItem): QuoteSnapshot | null {
  if (it.type === 'stock' && it.quote) {
    const q = it.quote
    return {
      type: 'stock',
      symbol: it.symbol,
      name: q.name,
      last: q.last,
      prevClose: q.prevClose,
      time: `${q.date} ${q.time}`,
    }
  }
  if (it.type === 'fund') {
    const nav = it.nav
    const est = it.estimate
    const last = est?.estimateNav ?? nav?.nav ?? 0
    // 基金「昨收」用估值基准昨净；无估值时退化为确认净值（当日变化记 0）
    const prev = est?.lastNav ?? nav?.nav ?? 0
    return {
      type: 'fund',
      symbol: it.symbol,
      name: it.symbol,
      last,
      prevClose: prev,
      nav: nav?.nav,
      accNav: nav?.accNav,
      estimateNav: est?.estimateNav,
      estimatePercent: est?.estimatePercent,
      time: est?.time,
      source: est?.source,
    }
  }
  return null
}

/** 刷新单条标的行情 */
async function refreshOne(key: string, h: Holding): Promise<void> {
  try {
    const batch = await getBatchQuote([{ type: h.type, symbol: h.code }], estimateFallback.value)
    const snap = batch.length ? toSnapshot(batch[0]) : null
    if (snap) {
      const normKey = `${h.type}:${h.code.toLowerCase()}`
      quotes.value = { ...quotes.value, [normKey]: snap }
    }
  } catch {
    // 单条失败不影响整体
  }
}

/** 刷新全部持仓行情（批量请求） */
async function refreshQuotes(): Promise<void> {
  if (!holdings.value.length) {
    quotes.value = {}
    return
  }
  loadingQuotes.value = true
  try {
    const items = holdings.value.map((h) => ({ type: h.type, symbol: h.code }))
    const batch = await getBatchQuote(items, estimateFallback.value)
    const map: Record<string, QuoteSnapshot> = {}
    for (const it of batch) {
      const snap = toSnapshot(it)
      // 新浪股票代码返回为小写（sh600519），统一转小写作为快照键，避免与用户录入的大小写不一致
      if (snap) map[`${it.type}:${it.symbol.toLowerCase()}`] = snap
    }
    quotes.value = map
  } catch (e) {
    console.error('刷新行情失败:', e)
  } finally {
    loadingQuotes.value = false
  }
}

/* ===================== 派生计算：持仓行 + 组合总览 ===================== */

/** 持仓行（含盈亏计算） */
const rows = computed<HoldingRow[]>(() =>
  holdings.value.map((h) => {
    const snap = quotes.value[`${h.type}:${h.code.toLowerCase()}`]
    const shares = h.shares
    const last = snap?.last ?? 0
    const prevClose = snap?.prevClose ?? 0
    const cost = h.costPrice * shares
    const marketValue = last * shares
    const dayProfit = (last - prevClose) * shares
    const dayBase = prevClose * shares
    const profit = marketValue - cost
    return {
      ...h,
      snapshot: snap,
      marketValue,
      cost,
      profit,
      profitPercent: cost > 0 ? (profit / cost) * 100 : 0,
      dayProfit,
      dayPercent: dayBase > 0 ? (dayProfit / dayBase) * 100 : 0,
    }
  }),
)

/** 组合总览 */
const summary = computed<PortfolioSummary>(() => {
  let totalMarketValue = 0
  let totalCost = 0
  let dayProfit = 0
  for (const r of rows.value) {
    totalMarketValue += r.marketValue
    totalCost += r.cost
    dayProfit += r.dayProfit
  }
  const totalProfit = totalMarketValue - totalCost
  return {
    totalMarketValue,
    totalCost,
    totalProfit,
    totalProfitPercent: totalCost > 0 ? (totalProfit / totalCost) * 100 : 0,
    dayProfit,
  }
})

/* ===================== 历史序列 / 区间收益 / 组合曲线 ===================== */

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return fmtDate(d)
}

/** 取某标的在指定区间内的历史序列（股票用日线收盘价，基金用累计净值） */
async function ensureHistory(h: Holding, periodDays: number): Promise<{ dates: string[]; values: number[] }> {
  const cacheKey = `${h.key}:${periodDays}`
  const cached = historyCache.get(cacheKey)
  if (cached) return cached

  let dates: string[] = []
  let values: number[] = []
  if (h.type === 'stock') {
    const k = await getStockKline(h.code, 240, periodDays + 5)
    dates = k.map((p) => p.day.slice(0, 10))
    values = k.map((p) => p.close)
  } else {
    const navs = await getFundNav(h.code, daysAgo(periodDays + 5), fmtDate(new Date()))
    dates = navs.map((n) => n.date.slice(0, 10))
    values = navs.map((n) => n.accNav || n.nav)
  }
  const result = { dates, values }
  historyCache.set(cacheKey, result)
  return result
}

/** 组合收益曲线（区间收益率 %，按各标的序列日期交集对齐） */
async function portfolioCurve(periodDays: number): Promise<{ dates: string[]; returns: number[] }> {
  if (!holdings.value.length) return { dates: [], returns: [] }
  const series = await Promise.all(holdings.value.map((h) => ensureHistory(h, periodDays)))
  // 取所有序列的日期交集（保证组合价值在各日期都有值）
  const common = series
    .map((s) => new Set(s.dates))
    .reduce((acc, set) => {
      const next = new Set<string>()
      for (const d of acc) if (set.has(d)) next.add(d)
      return next
    }, new Set(series[0]?.dates || []))
  const sorted = Array.from(common).sort()
  if (!sorted.length) return { dates: [], returns: [] }

  const valuesAtDate: number[] = []
  for (const d of sorted) {
    let total = 0
    holdings.value.forEach((h, i) => {
      const s = series[i]
      const idx = s.dates.indexOf(d)
      if (idx >= 0) total += h.shares * s.values[idx]
    })
    valuesAtDate.push(total)
  }
  const base = valuesAtDate[0] || 1
  const returns = valuesAtDate.map((v) => (v / base - 1) * 100)
  return { dates: sorted, returns }
}

/** 区间收益：组合总收益 + 每只标的收益 */
async function periodReturns(periodDays: number): Promise<{
  total: number
  items: Array<{ key: string; name: string; percent: number }>
}> {
  const items: Array<{ key: string; name: string; percent: number }> = []
  for (const h of holdings.value) {
    const s = await ensureHistory(h, periodDays)
    if (s.values.length >= 2) {
      const first = s.values[0]
      const lastV = s.values[s.values.length - 1]
      items.push({
        key: h.key,
        name: h.name || h.code,
        percent: first > 0 ? (lastV / first - 1) * 100 : 0,
      })
    }
  }
  const { returns } = await portfolioCurve(periodDays)
  const total = returns.length ? returns[returns.length - 1] : 0
  return { total, items }
}

/* ===================== 估值兜底开关 ===================== */

function loadFallback(): void {
  const v = getStore(FALLBACK_KEY)
  estimateFallback.value = v === true || v === 'true'
}
async function setFallback(on: boolean): Promise<void> {
  estimateFallback.value = on
  setStore(FALLBACK_KEY, on)
  // 切换后刷新估值
  await refreshQuotes()
}

/** 初始化：读取持仓 + 兜底开关 */
async function init(): Promise<void> {
  loadFallback()
  await loadHoldings()
  await refreshQuotes()
}

export function useEarningStore() {
  return {
    holdings,
    quotes,
    loadingQuotes,
    estimateFallback,
    rows,
    summary,
    init,
    loadHoldings,
    saveHolding,
    removeHolding,
    refreshQuotes,
    refreshOne,
    portfolioCurve,
    periodReturns,
    setFallback,
  }
}
