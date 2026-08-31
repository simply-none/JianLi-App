/**
 * 新浪财经数据源模块（收益看板 earning 专用）
 *
 * 通过 sina:* IPC 通道暴露新浪财经免费行情 / 净值接口，无需 API Key。
 * 网络请求全部在主进程完成（Node 22 全局 fetch），绕开渲染端 CORS 限制，
 * 并能自由设置 Referer、对 GBK 编码做 iconv-lite 解码。
 *
 * 接口覆盖：
 *  - 股票 / ETF 实时行情：https://hq.sinajs.cn/list=sh600519,sz000001 （GBK，需 Referer）
 *  - 股票历史 K 线：     https://money.finance.sina.com.cn/.../CN_MarketData.getKLineData
 *  - 基金历史净值：       https://stock.finance.sina.com.cn/.../CaihuiFundInfoService.getNav
 *  - 基金盘中估值：       https://app.xincai.com/.../XinCaiFundService.getFundYuCeNav （新浪系）
 *    兜底（可开关，默认关）：天天基金 https://fundgz.1234567.com.cn/js/{code}.js
 *
 * 缓存策略：进程内 Map + TTL（行情 5s / K线 1h / 净值 24h），避免频繁回源。
 *
 * ⚠️ 本文件属主进程（electron/**），改动后必须重启 Electron 才生效。
 */

import { ipcMain } from 'electron'
import iconv from 'iconv-lite'

/* ===================== 类型 ===================== */

/** 股票 / ETF 实时行情（已从新浪字符串解析为结构） */
export interface SinaStockQuote {
  /** 带市场前缀，如 sh600519 / sz000001 */
  symbol: string
  name: string
  open: number
  prevClose: number
  last: number
  high: number
  low: number
  /** 成交量（股） */
  volume: number
  /** 成交额（元） */
  amount: number
  date: string
  time: string
  /** 五档买价 / 买量 */
  bidPrices: number[]
  bidVolumes: number[]
  /** 五档卖价 / 卖量 */
  askPrices: number[]
  askVolumes: number[]
}

/** 单根 K 线 */
export interface SinaKlinePoint {
  day: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** 基金历史净值（单日） */
export interface SinaFundNav {
  code: string
  /** 净值日期 yyyy-MM-dd */
  date: string
  /** 单位净值 jjjz */
  nav: number
  /** 累计净值 ljjz（含分红再投） */
  accNav: number
}

/** 基金盘中估值 */
export interface SinaFundEstimate {
  code: string
  name: string
  /** 上一交易日确认净值（估值基准） */
  lastNav: number
  /** 最新估算净值 */
  estimateNav: number
  /** 估算涨跌幅 % */
  estimatePercent: number
  /** 估值时间 */
  time: string
  /** 数据来源：sina / eastmoney */
  source: 'sina' | 'eastmoney'
}

/** 批量查询条目（股票 + 基金混合） */
export interface SinaBatchItem {
  type: 'stock' | 'fund'
  /** 股票带市场前缀；基金为 6 位代码 */
  symbol: string
  quote?: SinaStockQuote
  nav?: SinaFundNav
  estimate?: SinaFundEstimate
}

/** 统一返回结构（与 stock 模块一致） */
export interface SinaResult<T> {
  success: boolean
  data?: T
  error?: string
}

/* ===================== 进程内缓存 ===================== */

interface CacheEntry {
  expire: number
  data: unknown
}

const memCache = new Map<string, CacheEntry>()

/** 带 TTL 的进程内缓存读取；未命中 / 过期则执行 fetcher 并写回 */
async function withCache<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = memCache.get(key)
  const now = Date.now()
  if (hit && hit.expire > now) {
    return hit.data as T
  }
  const data = await fetcher()
  memCache.set(key, { expire: now + ttl, data })
  return data
}

const TTL = {
  realtime: 5_000,
  kline: 3_600_000,
  nav: 86_400_000,
}

/* ===================== HTTP 基础 ===================== */

/** 新浪系请求头：Referer 必填，否则被拒 */
const SINA_HEADERS: Record<string, string> = {
  Referer: 'https://finance.sina.com.cn',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
}

/** 以文本方式拉取（自动按编码解码；新浪实时行情为 GBK） */
async function fetchText(url: string, encoding: 'utf8' | 'gbk' = 'utf8'): Promise<string> {
  const res = await fetch(url, { headers: SINA_HEADERS })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}`)
  }
  if (encoding === 'gbk') {
    const buf = Buffer.from(await res.arrayBuffer())
    return iconv.decode(buf, 'gbk')
  }
  return await res.text()
}

/** 以 JSON 方式拉取（UTF-8） */
async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url, 'utf8')
  return JSON.parse(text) as T
}

/* ===================== 解析：股票实时行情 ===================== */

/**
 * 解析 hq.sinajs.cn 返回的多行 `var hq_str_xxx="...";` 文本。
 * 字段下标（引号内逗号分隔，0-based）：
 *  [0]名称 [1]今开 [2]昨收 [3]当前价 [4]最高 [5]最低
 *  [6]竞买价 [7]竞卖价 [8]成交量(股) [9]成交额(元)
 *  [10-19] 买一~买五 量/价 交替  [20-29] 卖一~卖五 量/价 交替
 *  [30]日期 [31]时间
 */
function parseStockQuotes(raw: string): SinaStockQuote[] {
  const out: SinaStockQuote[] = []
  const re = /var\s+hq_str_([^=]+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const symbol = m[1].trim()
    const f = m[2].split(',')
    if (f.length < 32) continue
    const num = (s: string) => {
      const v = parseFloat(s)
      return Number.isFinite(v) ? v : 0
    }
    const bidPrices: number[] = [num(f[11]), num(f[13]), num(f[15]), num(f[17]), num(f[19])]
    const bidVolumes: number[] = [num(f[10]), num(f[12]), num(f[14]), num(f[16]), num(f[18])]
    const askPrices: number[] = [num(f[21]), num(f[23]), num(f[25]), num(f[27]), num(f[29])]
    const askVolumes: number[] = [num(f[20]), num(f[22]), num(f[24]), num(f[26]), num(f[28])]
    out.push({
      symbol,
      name: f[0] || symbol,
      open: num(f[1]),
      prevClose: num(f[2]),
      last: num(f[3]),
      high: num(f[4]),
      low: num(f[5]),
      volume: num(f[8]),
      amount: num(f[9]),
      date: (f[30] || '').slice(0, 10),
      time: (f[31] || '').slice(0, 8),
      bidPrices,
      bidVolumes,
      askPrices,
      askVolumes,
    })
  }
  return out
}

/* ===================== 解析：基金历史净值 ===================== */

interface SinaNavRaw {
  result: {
    status: { code: number }
    data: {
      data: Array<{ fbrq: string; jjjz: string; ljjz: string }>
      total_num: string
    }
  }
}

/** 分页拉取基金全部历史净值（新浪，每页 20 条，自动翻页） */
async function fetchFundNavAll(code: string, from?: string, to?: string): Promise<SinaFundNav[]> {
  const list: SinaFundNav[] = []
  let page = 1
  // 兜底上限 200 页（=4000 条），避免异常死循环
  while (page <= 200) {
    const url =
      `https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/CaihuiFundInfoService.getNav` +
      `?symbol=${encodeURIComponent(code)}` +
      `&datefrom=${encodeURIComponent(from || '2000-01-01')}` +
      `&dateto=${encodeURIComponent(to || '2099-12-31')}` +
      `&page=${page}`
    const json = await fetchJson<SinaNavRaw>(url)
    const rows = json?.result?.data?.data || []
    for (const r of rows) {
      const nav = parseFloat(r.jjjz)
      const acc = parseFloat(r.ljjz)
      if (!Number.isFinite(nav)) continue
      list.push({
        code,
        date: (r.fbrq || '').slice(0, 10),
        nav,
        accNav: Number.isFinite(acc) ? acc : nav,
      })
    }
    const total = parseInt(json?.result?.data?.total_num || '0', 10)
    if (list.length >= total || rows.length === 0) break
    page += 1
  }
  // 按日期升序，便于区间计算
  list.sort((a, b) => a.date.localeCompare(b.date))
  return list
}

/* ===================== 解析：基金盘中估值 ===================== */

/** 新浪 XinCai 估值：返回 { yes(昨净), detail("时间,净值,时间,净值,...") } */
async function fetchSinaEstimate(code: string): Promise<SinaFundEstimate | null> {
  const url = `https://app.xincai.com/fund/api/jsonp.json/var%20t1fu_${code}=/XinCaiFundService.getFundYuCeNav?symbol=${code}`
  const text = await fetchText(url, 'utf8')
  const match = text.match(/=\s*\(([\s\S]*?)\)\s*;/)
  if (!match) return null
  const obj = JSON.parse(match[1]) as { yes?: string; detail?: string }
  const lastNav = parseFloat(obj.yes || '')
  if (!Number.isFinite(lastNav)) return null
  // detail 形如 "09:30,2.6822,09:31,2.6830,...,15:00,2.7189"
  const parts = (obj.detail || '').split(',')
  let estimateNav = lastNav
  let time = ''
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const v = parseFloat(parts[i + 1])
    if (Number.isFinite(v)) {
      estimateNav = v
      time = parts[i]
    }
  }
  const estimatePercent = ((estimateNav - lastNav) / lastNav) * 100
  return {
    code,
    name: '',
    lastNav,
    estimateNav,
    estimatePercent,
    time,
    source: 'sina',
  }
}

/** 天天基金兜底估值：jsonpgz({...}) */
async function fetchEastmoneyEstimate(code: string): Promise<SinaFundEstimate | null> {
  const url = `https://fundgz.1234567.com.cn/js/${code}.js`
  const text = await fetchText(url, 'utf8')
  const match = text.match(/jsonpgz\(\s*([\s\S]*?)\s*\)\s*;?/)
  if (!match) return null
  const obj = JSON.parse(match[1]) as {
    fundcode?: string
    name?: string
    jzrq?: string
    dwjz?: string
    gsz?: string
    gszzl?: string
    gztime?: string
  }
  const lastNav = parseFloat(obj.dwjz || '')
  const estimateNav = parseFloat(obj.gsz || '')
  if (!Number.isFinite(lastNav) || !Number.isFinite(estimateNav)) return null
  const estimatePercent = parseFloat(obj.gszzl || '')
  return {
    code: obj.fundcode || code,
    name: obj.name || '',
    lastNav,
    estimateNav,
    estimatePercent: Number.isFinite(estimatePercent) ? estimatePercent : ((estimateNav - lastNav) / lastNav) * 100,
    time: (obj.gztime || '').slice(-8),
    source: 'eastmoney',
  }
}

/* ===================== 对外取数函数 ===================== */

/** 股票 / ETF 实时行情（批量，符号带前缀，逗号拼接一次请求） */
export async function getStockQuotes(codes: string[]): Promise<SinaStockQuote[]> {
  const list = Array.from(new Set(codes.map((c) => c.trim().toLowerCase()).filter(Boolean)))
  if (!list.length) return []
  const url = `https://hq.sinajs.cn/list=${list.join(',')}`
  const raw = await fetchText(url, 'gbk')
  return parseStockQuotes(raw)
}

/** 股票历史 K 线（scale: 5/15/30/60/240 代表分钟/日线；datalen 根数） */
export async function getStockKline(
  symbol: string,
  scale = 240,
  datalen = 320,
): Promise<SinaKlinePoint[]> {
  const url =
    `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData` +
    `?symbol=${encodeURIComponent(symbol)}&scale=${scale}&ma=no&datalen=${datalen}`
  const arr = await fetchJson<Array<{ day: string; open: string; high: string; low: string; close: string; volume: string }>>(url)
  return (arr || []).map((k) => ({
    day: k.day,
    open: parseFloat(k.open) || 0,
    high: parseFloat(k.high) || 0,
    low: parseFloat(k.low) || 0,
    close: parseFloat(k.close) || 0,
    volume: parseFloat(k.volume) || 0,
  }))
}

/** 基金历史净值（升序） */
export async function getFundNav(code: string, from?: string, to?: string): Promise<SinaFundNav[]> {
  return fetchFundNavAll(code, from, to)
}

/** 基金盘中估值；fallback=true 时新浪失败回落天天基金 */
export async function getFundEstimate(code: string, fallback = false): Promise<SinaFundEstimate | null> {
  try {
    const sina = await fetchSinaEstimate(code)
    if (sina) return sina
  } catch {
    // 新浪失败，落到兜底
  }
  if (fallback) {
    try {
      return await fetchEastmoneyEstimate(code)
    } catch {
      return null
    }
  }
  return null
}

/** 股票 + 基金混合批量：股票取实时行情，基金取最新净值 + 估值 */
export async function getBatchQuote(
  items: Array<{ type: 'stock' | 'fund'; symbol: string }>,
  estimateFallback = false,
): Promise<SinaBatchItem[]> {
  const stocks = items.filter((i) => i.type === 'stock')
  const funds = items.filter((i) => i.type === 'fund')
  const out: SinaBatchItem[] = []

  if (stocks.length) {
    const quotes = await getStockQuotes(stocks.map((s) => s.symbol))
    const bySymbol = new Map(quotes.map((q) => [q.symbol.toLowerCase(), q]))
    for (const s of stocks) {
      out.push({ type: 'stock', symbol: s.symbol, quote: bySymbol.get(s.symbol.toLowerCase()) })
    }
  }

  for (const f of funds) {
    const code = f.symbol
    const navList = await getFundNav(code)
    const nav = navList[navList.length - 1]
    const estimate = await getFundEstimate(code, estimateFallback)
    out.push({ type: 'fund', symbol: code, nav, estimate: estimate || undefined })
  }
  return out
}

/* ===================== IPC 注册 ===================== */

function ok<T>(data: T): SinaResult<T> {
  return { success: true, data }
}
function fail<T = unknown>(error: string): SinaResult<T> {
  return { success: false, error }
}

/** 初始化新浪财经模块：注册全部 sina:* IPC 通道 */
export function initSinaFinance() {
  // 股票 / ETF 实时行情（批量）
  ipcMain.handle('sina:getStockQuotes', async (_e, p: { codes?: string[] }) => {
    try {
      const data = await withCache(
        `quotes:${Array.isArray(p?.codes) ? p.codes.join(',') : ''}`,
        TTL.realtime,
        () => getStockQuotes(p?.codes || []),
      )
      return ok(data)
    } catch (e) {
      return fail((e as { message?: string })?.message || '获取股票行情失败')
    }
  })

  // 股票历史 K 线
  ipcMain.handle(
    'sina:getStockKline',
    async (_e, p: { symbol: string; scale?: number; datalen?: number }) => {
      try {
        if (!p?.symbol) return fail('缺少 symbol')
        const data = await withCache(
          `kline:${p.symbol}:${p.scale || 240}:${p.datalen || 320}`,
          TTL.kline,
          () => getStockKline(p.symbol, p.scale, p.datalen),
        )
        return ok(data)
      } catch (e) {
        return fail((e as { message?: string })?.message || '获取 K 线失败')
      }
    },
  )

  // 基金历史净值（按 code+区间 缓存）
  ipcMain.handle(
    'sina:getFundNav',
    async (_e, p: { code: string; from?: string; to?: string }) => {
      try {
        if (!p?.code) return fail('缺少 code')
        const data = await withCache(
          `nav:${p.code}:${p.from || ''}:${p.to || ''}`,
          TTL.nav,
          () => getFundNav(p.code, p.from, p.to),
        )
        return ok(data)
      } catch (e) {
        return fail((e as { message?: string })?.message || '获取基金净值失败')
      }
    },
  )

  // 基金盘中估值（短缓存，可用 fallback 开关）
  ipcMain.handle(
    'sina:getFundEstimate',
    async (_e, p: { code: string; fallback?: boolean }) => {
      try {
        if (!p?.code) return fail('缺少 code')
        const data = await withCache(
          `estimate:${p.code}:${p.fallback ? 'em' : 'sina'}`,
          TTL.realtime,
          () => getFundEstimate(p.code, p.fallback),
        )
        return ok(data)
      } catch (e) {
        return fail((e as { message?: string })?.message || '获取基金估值失败')
      }
    },
  )

  // 股票 + 基金混合批量
  ipcMain.handle(
    'sina:getBatchQuote',
    async (_e, p: { items?: Array<{ type: 'stock' | 'fund'; symbol: string }>; estimateFallback?: boolean }) => {
      try {
        if (!Array.isArray(p?.items) || !p.items.length) return fail('缺少 items')
        const data = await getBatchQuote(p.items, p.estimateFallback)
        return ok(data)
      } catch (e) {
        return fail((e as { message?: string })?.message || '批量获取失败')
      }
    },
  )
}
