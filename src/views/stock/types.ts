/**
 * 股票查询渲染端类型契约。
 *
 * 与 electron/main/module/stock.ts 主进程模块的接口保持一致，
 * 但独立放置于渲染端，避免渲染构建依赖主进程模块（ipcMain / node 内置等）。
 * 渲染端通过 window.ipcRenderer.invoke('stock:xxx', params) 调用主进程，
 * 返回统一包裹结构 { success, data, error }。
 */

/** K 线周期 */
export type Period =
  | '1m' | '5m' | '10m' | '15m' | '30m' | '60m'
  | '1d' | '1w' | '1M' | '1Q' | '1Y'

/** 复权方式 */
export type AdjustType =
  | 'forward'
  | 'backward'
  | 'forward_additive'
  | 'backward_additive'
  | 'none'

/** 地区 */
export type Region = string

/** 实时行情单条记录 */
export interface Quote {
  symbol: string
  region?: Region
  last_price?: number
  prev_close?: number
  open?: number
  high?: number
  low?: number
  volume?: number
  amount?: number
  timestamp?: number
  ext?: Record<string, unknown>
  session?: string
}

/** 五档行情 */
export interface MarketDepth {
  symbol?: string
  region?: Region
  timestamp?: number
  bid_prices?: number[]
  bid_volumes?: number[]
  ask_prices?: number[]
  ask_volumes?: number[]
}

/** K 线（列式存储） */
export interface CompactKlineData {
  symbol?: string
  timestamp?: number[]
  open?: number[]
  high?: number[]
  low?: number[]
  close?: number[]
  volume?: number[]
  amount?: number[]
}

/** 标的元数据扩展字段（ext 子对象） */
export interface InstrumentExt {
  /** 标的类别，如 cn_equity / us_equity / hk_equity */
  type?: string
  /** 流通股本 */
  float_shares?: number
  /** 涨停价 */
  limit_up?: number
  /** 跌停价 */
  limit_down?: number
  /** 上市日期（字符串，如 1999-11-10） */
  listing_date?: string
  /** 英文名 */
  name_en?: string
  /** 最小价格变动单位 */
  tick_size?: number
  /** 总股本 */
  total_shares?: number
  /** 其它未知扩展字段 */
  [key: string]: unknown
}

/** 单个标的元数据（GET/POST /v1/instruments 返回 data 数组元素） */
export interface Instrument {
  /** 代码（通常为空或等同于 symbol 内部编码） */
  code?: string
  /** 交易所，如 SSE / SZSE / XNAS / XHKG */
  exchange?: string
  /** 地区，如 cn / us / hk */
  region?: string
  /** 标的代码（带市场后缀，如 600000.SH） */
  symbol: string
  /** 中文名 */
  name?: string
  /** 顶层类型，如 stock / index / etf */
  type?: string
  /** 扩展字段 */
  ext?: InstrumentExt
}

/** 主进程经 IPC 返回给渲染端的统一结构 */
export interface StockResult<T> {
  success: boolean
  data?: T
  error?: string
  status?: number
}

/** 批量查询实时行情请求体（POST /v1/quotes） */
export interface QuotesBatchBody {
  symbols?: string[]
  universes?: string[]
}

/** 交易所信息（GET /v1/exchanges） */
export interface ExchangeInfo {
  /** 交易所代码，如 SSE / SZSE / XNAS / XHKG */
  exchange: string
  /** 所属地区，如 cn / us / hk */
  region: string
  /** 该交易所标的数量 */
  count: number
}

/** 交易所列表响应（data 为数组） */
export type ExchangesResponse = ExchangeInfo[]

/** 某交易所的标的列表响应（外层信封 + data 列表） */
export interface ExchangeInstrumentsResponse {
  /** 交易所代码 */
  exchange: string
  /** 标的数量 */
  count: number
  /** 标的元数据列表（复用 Instrument 定义） */
  data: Instrument[]
}

/** 标的池（行业分类）概要（GET /v1/universes） */
export interface UniverseSummary {
  /** 唯一标识，如 CN_Equity_A */
  id: string
  /** 显示名称 */
  name: string
  /** 地区代码，如 cn / us / hk */
  region: string
  /** 分类，如 equity / etf / index */
  category: string
  /** 标的数量 */
  symbol_count: number
  /** 描述（可选） */
  description?: string
}

/** 标的池列表响应（data 为数组） */
export type UniversesResponse = UniverseSummary[]

/** 标的池详情（GET /v1/universes/{id}），在概要基础上含具体股票列表 */
export interface UniverseDetail extends UniverseSummary {
  /** 标的代码列表，如 ["600000.SH","000001.SZ"] */
  symbols: string[]
}
