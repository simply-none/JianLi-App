/**
 * 收益看板渲染端 API 封装。
 *
 * 统一封装主进程 sina:* IPC 通道（数据来自新浪财经）。
 * 主进程返回统一结构 { success, data, error }，这里做薄封装，失败时抛错。
 */

import type {
  SinaStockQuote,
  SinaKlinePoint,
  SinaFundNav,
  SinaFundEstimate,
  SinaBatchItem,
} from './types'

interface SinaResult<T> {
  success: boolean
  data?: T
  error?: string
}

/** 股票 / ETF 实时行情（批量，符号带市场前缀） */
export async function getStockQuotes(codes: string[]): Promise<SinaStockQuote[]> {
  const res = (await window.ipcRenderer.invoke('sina:getStockQuotes', { codes })) as SinaResult<SinaStockQuote[]>
  if (!res?.success) throw new Error(res?.error || '获取股票行情失败')
  return res.data || []
}

/** 股票历史 K 线（scale: 240=日线；datalen: 根数） */
export async function getStockKline(
  symbol: string,
  scale = 240,
  datalen = 320,
): Promise<SinaKlinePoint[]> {
  const res = (await window.ipcRenderer.invoke('sina:getStockKline', { symbol, scale, datalen })) as SinaResult<
    SinaKlinePoint[]
  >
  if (!res?.success) throw new Error(res?.error || '获取 K 线失败')
  return res.data || []
}

/** 基金历史净值（升序） */
export async function getFundNav(code: string, from?: string, to?: string): Promise<SinaFundNav[]> {
  const res = (await window.ipcRenderer.invoke('sina:getFundNav', { code, from, to })) as SinaResult<SinaFundNav[]>
  if (!res?.success) throw new Error(res?.error || '获取基金净值失败')
  return res.data || []
}

/** 基金盘中估值（fallback=true 时新浪失败回落天天基金） */
export async function getFundEstimate(code: string, fallback = false): Promise<SinaFundEstimate | null> {
  const res = (await window.ipcRenderer.invoke('sina:getFundEstimate', { code, fallback })) as SinaResult<
    SinaFundEstimate | null
  >
  if (!res?.success) throw new Error(res?.error || '获取基金估值失败')
  return res.data || null
}

/** 股票 + 基金混合批量 */
export async function getBatchQuote(
  items: Array<{ type: 'stock' | 'fund'; symbol: string }>,
  estimateFallback = false,
): Promise<SinaBatchItem[]> {
  const res = (await window.ipcRenderer.invoke('sina:getBatchQuote', {
    items,
    estimateFallback,
  })) as SinaResult<SinaBatchItem[]>
  if (!res?.success) throw new Error(res?.error || '批量获取失败')
  return res.data || []
}
