/**
 * 收益看板（earning）渲染端类型契约。
 *
 * 与主进程 sinaFinance.ts 返回结构对应（但独立放置于渲染端，
 * 避免渲染构建依赖主进程模块）。渲染端通过
 * window.ipcRenderer.invoke('sina:xxx', params) 调用主进程。
 */

/** 持仓类型 */
export type HoldingType = 'stock' | 'fund'

/** 持仓记录（落库 earning_holdings，key 主键 = `${type}:${code}`） */
export interface Holding {
  /** 主键：${type}:${code} */
  key: string
  type: HoldingType
  /** 股票带市场前缀（sh600519）；基金为 6 位代码 */
  code: string
  name: string
  /** 持仓数量（股数 / 基金份额） */
  shares: number
  /** 单位成本（股票买入价 / 基金申购净值） */
  costPrice: number
  /** 买入日期 yyyy-MM-dd（可选） */
  buyDate?: string
  /** 创建时间（落库自动写入） */
  created_at?: string
}

/** 行情快照（来自新浪实时 / 净值 / 估值） */
export interface QuoteSnapshot {
  type: HoldingType
  symbol: string
  name: string
  /** 股票最新价 / 昨收 */
  last?: number
  prevClose?: number
  /** 基金最新确认净值 / 累计净值 / 估算净值 / 估算涨跌幅 */
  nav?: number
  accNav?: number
  estimateNav?: number
  estimatePercent?: number
  time?: string
  /** 估值数据来源 sina / eastmoney */
  source?: string
}

/** 持仓行（持仓 + 行情 + 计算后的盈亏） */
export interface HoldingRow extends Holding {
  snapshot?: QuoteSnapshot
  /** 持仓市值 */
  marketValue: number
  /** 成本 */
  cost: number
  /** 累计盈亏 */
  profit: number
  /** 累计收益率 % */
  profitPercent: number
  /** 当日盈亏 */
  dayProfit: number
  /** 当日收益率 % */
  dayPercent: number
}

/** 组合总览 */
export interface PortfolioSummary {
  totalMarketValue: number
  totalCost: number
  totalProfit: number
  totalProfitPercent: number
  dayProfit: number
}

/** 区间收益（单标的或组合） */
export interface PeriodReturn {
  label: string
  /** 区间收益率 % */
  percent: number
}

/** 主进程返回的股票实时行情 */
export interface SinaStockQuote {
  symbol: string
  name: string
  open: number
  prevClose: number
  last: number
  high: number
  low: number
  volume: number
  amount: number
  date: string
  time: string
  bidPrices: number[]
  bidVolumes: number[]
  askPrices: number[]
  askVolumes: number[]
}

/** 主进程返回的单根 K 线 */
export interface SinaKlinePoint {
  day: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** 主进程返回的基金历史净值 */
export interface SinaFundNav {
  code: string
  date: string
  nav: number
  accNav: number
}

/** 主进程返回的基金盘中估值 */
export interface SinaFundEstimate {
  code: string
  name: string
  lastNav: number
  estimateNav: number
  estimatePercent: number
  time: string
  source: 'sina' | 'eastmoney'
}

/** 主进程返回的批量条目 */
export interface SinaBatchItem {
  type: 'stock' | 'fund'
  symbol: string
  quote?: SinaStockQuote
  nav?: SinaFundNav
  estimate?: SinaFundEstimate | null
}
