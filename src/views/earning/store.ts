/**
 * 收益看板共享状态（模块级单例）。
 *
 * - 持仓列表持久化到 newSql 表 earning_holdings（key 主键 = `${type}:${code}`，新增 portfolio_id 列）。
 * - 组合（分组）持久化到 newSql 表 earning_portfolios（id 主键）。
 * - 行情快照来自新浪（sina:getBatchQuote）：股票取实时价、基金取净值 + 盘中估值。
 * - 所有收益（市值 / 累计盈亏 / 当日盈亏 / 区间收益 / 组合曲线）均为派生计算，按当前组合过滤。
 * - 红涨绿跌：涨用红、跌用绿（在组件层用 .up / .down 类映射主题 token）。
 */

import { ref, computed } from 'vue'
import { getSqlData, setSqlData, deleteSqlData, getStore, setStore } from '@/utils/common'
import { getBatchQuote, getStockKline, getFundNav } from './api'
import type {
  Holding,
  HoldingRow,
  PortfolioSummary,
  QuoteSnapshot,
  SinaBatchItem,
  Portfolio,
} from './types'

/** 持仓表名（newSql，建表由主进程按 primaryKey 自动完成） */
const TABLE = 'earning_holdings'
/** 组合表名 */
const PORTFOLIO_TABLE = 'earning_portfolios'
/** 基金估值兜底开关存储键 */
const FALLBACK_KEY = 'earning:estimateFallback'
/** 默认组合 id（旧数据 / 未指定组合时归属） */
export const DEFAULT_PORTFOLIO_ID = 'default'
/** 聚合视图标记：查看全部组合 */
export const ALL_PORTFOLIOS = 'all'

/** 持仓列表（内存镜像） */
const holdings = ref<Holding[]>([])
/** 组合列表（内存镜像） */
const portfolios = ref<Portfolio[]>([])
/** 当前选中的组合 id（'all' = 全部） */
const currentPortfolioId = ref<string>(ALL_PORTFOLIOS)
/** 行情快照，按 `${type}:${code}` 索引 */
const quotes = ref<Record<string, QuoteSnapshot>>({})
/** 行情加载中 */
const loadingQuotes = ref(false)
/** 基金估值兜底（新浪失败回落天天基金），默认关 */
const estimateFallback = ref(false)
/** 行情最近一次成功更新时间戳 */
const lastUpdated = ref<number | null>(null)
/** 当前是否交易时段（用于 UI 徽标 + 刷新策略） */
const marketOpen = ref(isMarketOpen())

/** 历史序列缓存：cacheKey -> { dates, values } */
const historyCache = new Map<string, { dates: string[]; values: number[] }>()

/** 组合主键（持仓 key 仍用 type:code，组合维度由 portfolioId 关联） */
function keyOf(type: string, code: string): string {
  return `${type}:${code}`
}

/* ===================== 市场时段（A 股） ===================== */

/**
 * 判断当前是否 A 股交易时段（本地时间）。
 * 周一~周五，且处于 09:30-11:30 或 13:00-15:00。
 * 注：不含法定节假日（节假日盘中无数据，取到的是上一交易日收盘值，无害）。
 */
function isMarketOpen(now = new Date()): boolean {
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const mins = now.getHours() * 60 + now.getMinutes()
  return (mins >= 570 && mins <= 690) || (mins >= 780 && mins <= 900)
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
    // 旧数据无 portfolio_id 时归入默认组合（newSql 首次写入 portfolio_id 后自动建列）
    portfolioId: r.portfolio_id || DEFAULT_PORTFOLIO_ID,
    created_at: r.created_at,
  }
}

/** 把 Holding 转为落库对象（键名对齐 DB 列，含 portfolio_id） */
function toHoldingRecord(h: Holding): Record<string, any> {
  return {
    key: h.key,
    type: h.type,
    code: h.code,
    name: h.name || '',
    shares: h.shares,
    costPrice: h.costPrice,
    buyDate: h.buyDate || '',
    portfolio_id: h.portfolioId || DEFAULT_PORTFOLIO_ID,
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
  // 未显式指定组合时：当前选中具体组合则归属它，当前为「全部」则归属默认组合
  const pid =
    input.portfolioId ||
    (currentPortfolioId.value === ALL_PORTFOLIOS ? DEFAULT_PORTFOLIO_ID : currentPortfolioId.value)
  const record: Holding = {
    key,
    type: input.type,
    code: input.code,
    name: input.name,
    shares: input.shares,
    costPrice: input.costPrice,
    buyDate: input.buyDate,
    portfolioId: pid,
  }
  await setSqlData({ tableName: TABLE, data: toHoldingRecord(record), config: { primaryKey: 'key' } })
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

/* ===================== 组合持久化 ===================== */

/** 从 newSql 读取组合；若为空则创建默认组合 */
async function loadPortfolios(): Promise<void> {
  const res = (await getSqlData({ tableName: PORTFOLIO_TABLE, orderByDesc: 'sort' })) as any
  const rows = (res?.data ?? res?.rows ?? []) as Array<Record<string, any>>
  if (!rows.length) {
    await setSqlData({
      tableName: PORTFOLIO_TABLE,
      data: { id: DEFAULT_PORTFOLIO_ID, name: '默认组合', sort: 0 },
      config: { primaryKey: 'id' },
    })
    portfolios.value = [{ id: DEFAULT_PORTFOLIO_ID, name: '默认组合', sort: 0 }]
    return
  }
  portfolios.value = rows.map((r) => ({
    id: r.id,
    name: r.name || r.id,
    sort: Number(r.sort) || 0,
    created_at: r.created_at,
  }))
}

/** 新增组合（返回新组合 id） */
async function savePortfolio(name: string): Promise<string> {
  const id = `p_${Date.now()}`
  const record: Portfolio = { id, name: name.trim() || '新建组合', sort: portfolios.value.length }
  await setSqlData({ tableName: PORTFOLIO_TABLE, data: record, config: { primaryKey: 'id' } })
  portfolios.value = [...portfolios.value, record]
  return id
}

/** 重命名组合 */
async function renamePortfolio(id: string, name: string): Promise<void> {
  if (id === DEFAULT_PORTFOLIO_ID) throw new Error('默认组合不可重命名')
  await setSqlData({ tableName: PORTFOLIO_TABLE, data: { id, name: name.trim() }, config: { primaryKey: 'id' } })
  const idx = portfolios.value.findIndex((p) => p.id === id)
  if (idx >= 0) portfolios.value[idx] = { ...portfolios.value[idx], name: name.trim() }
}

/**
 * 删除组合：其下持仓迁回默认组合，再删除组合记录。
 * 默认组合不可删。
 */
async function removePortfolio(id: string): Promise<void> {
  if (id === DEFAULT_PORTFOLIO_ID) throw new Error('默认组合不可删除')
  // 1. 把该组合下持仓迁回默认组合（直接 upsert，由 newSql 自动补列，不触发行情刷新）
  const moved = holdings.value.filter((h) => h.portfolioId === id)
  for (const h of moved) {
    const rec = { ...h, portfolioId: DEFAULT_PORTFOLIO_ID }
    await setSqlData({ tableName: TABLE, data: toHoldingRecord(rec), config: { primaryKey: 'key' } })
  }
  // 2. 删除组合记录
  await deleteSqlData({ tableName: PORTFOLIO_TABLE, conditions: { id } })
  // 3. 刷新内存
  await loadHoldings()
  await loadPortfolios()
  // 4. 若当前选中该组合，切回全部
  if (currentPortfolioId.value === id) currentPortfolioId.value = ALL_PORTFOLIOS
}

/** 切换当前组合 */
function setCurrentPortfolio(id: string): void {
  currentPortfolioId.value = id
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

/**
 * 刷新全部持仓行情（批量请求）。
 * @param force 是否强制刷新。非交易时段且已有快照时，非强制刷新会被跳过，
 *             避免收盘后到开盘前频繁调用接口（仅取一次）。
 */
async function refreshQuotes(force = false): Promise<void> {
  // 同步市场状态（无论是否跳过请求，徽标都应即时反映）
  marketOpen.value = isMarketOpen()

  // 非交易时段且已有数据：跳过请求，避免频繁调用接口（收盘后~开盘前仅取一次）
  if (!force && !marketOpen.value && Object.keys(quotes.value).length > 0) {
    return
  }

  if (!holdings.value.length) {
    quotes.value = {}
    lastUpdated.value = Date.now()
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
    lastUpdated.value = Date.now()
  } catch (e) {
    console.error('刷新行情失败:', e)
  } finally {
    loadingQuotes.value = false
  }
}

/* ===================== 派生计算：持仓行 + 组合总览 ===================== */

/** 当前组合过滤后的持仓（'all' 为全部） */
const filteredHoldings = computed<Holding[]>(() =>
  currentPortfolioId.value === ALL_PORTFOLIOS
    ? holdings.value
    : holdings.value.filter((h) => h.portfolioId === currentPortfolioId.value),
)

/** 持仓行（含盈亏计算），按当前组合过滤 */
const rows = computed<HoldingRow[]>(() =>
  filteredHoldings.value.map((h) => {
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

/** 组合总览（基于当前组合的持仓行） */
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
  // cacheKey 拼入 portfolioId，避免不同组合间串数据
  const cacheKey = `${h.key}:${h.portfolioId}:${periodDays}`
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

/** 取某组合的持仓列表（按组合 id 过滤，'all' 为全部） */
function holdingsOf(pid?: string): Holding[] {
  const id = pid || currentPortfolioId.value
  if (id === ALL_PORTFOLIOS) return holdings.value
  return holdings.value.filter((h) => h.portfolioId === id)
}

/** 组合收益曲线（区间收益率 %，按各标的序列日期交集对齐） */
async function portfolioCurve(
  periodDays: number,
  pid?: string,
): Promise<{ dates: string[]; returns: number[] }> {
  const list = holdingsOf(pid)
  if (!list.length) return { dates: [], returns: [] }
  const series = await Promise.all(list.map((h) => ensureHistory(h, periodDays)))
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
    list.forEach((h, i) => {
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
async function periodReturns(
  periodDays: number,
  pid?: string,
): Promise<{
  total: number
  items: Array<{ key: string; name: string; percent: number }>
}> {
  const list = holdingsOf(pid)
  const items: Array<{ key: string; name: string; percent: number }> = []
  for (const h of list) {
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
  const { returns } = await portfolioCurve(periodDays, pid)
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
  // 切换后强制刷新估值（用户主动操作）
  await refreshQuotes(true)
}

/** 初始化：读取组合 + 持仓 + 兜底开关 */
async function init(): Promise<void> {
  loadFallback()
  await loadPortfolios()
  await loadHoldings()
  await refreshQuotes()
}

/* ===================== 交易时段轮询 ===================== */

/**
 * 启动交易时段轮询：每 60s 触发一次刷新。
 * 非交易时段 refreshQuotes 内部会自动跳过请求（不回源），
 * 因此轮询始终运行也不会在收盘后频繁调用接口。
 */
let pollTimer: ReturnType<typeof setInterval> | null = null
function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    refreshQuotes(false).catch(() => {})
  }, 60_000)
}
function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function useEarningStore() {
  return {
    holdings,
    portfolios,
    currentPortfolioId,
    quotes,
    loadingQuotes,
    estimateFallback,
    lastUpdated,
    marketOpen,
    rows,
    summary,
    filteredHoldings,
    init,
    loadHoldings,
    loadPortfolios,
    saveHolding,
    removeHolding,
    savePortfolio,
    renamePortfolio,
    removePortfolio,
    setCurrentPortfolio,
    refreshQuotes,
    refreshOne,
    portfolioCurve,
    periodReturns,
    setFallback,
    startPolling,
    stopPolling,
    isMarketOpen,
    DEFAULT_PORTFOLIO_ID,
  }
}
