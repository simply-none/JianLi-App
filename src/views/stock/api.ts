/**
 * 股票查询渲染端封装（TickFlow）
 *
 * 统一封装主进程暴露的 8 个 IPC 通道，渲染端只需调用这些函数，
 * 不直接持有 API Key（由主进程托管）。所有返回均为主进程约定的
 * { success, data, error } 结构，这里再做一层薄封装，失败时抛错。
 */

import { toPlain } from '@/utils/common'
import type {
  Quote,
  MarketDepth,
  CompactKlineData,
  Period,
  AdjustType,
  QuotesBatchBody,
  Instrument,
  ExchangesResponse,
  ExchangeInstrumentsResponse,
  UniversesResponse,
  UniverseDetail,
} from './types'

/* 主进程约定的统一返回结构（来自 stock.ts 的 StockResult<T>） */
export interface StockResult<T> {
  success: boolean
  data?: T
  error?: string
  status?: number
}

/** 实时行情（GET /v1/quotes，按 symbols 逗号串） */
export async function getQuotes(symbols: string): Promise<Quote[]> {
  const res = await window.ipcRenderer.invoke('stock:getQuotes', { symbols })
  if (!res?.success) throw new Error(res?.error || '查询实时行情失败')
  return res.data as Quote[]
}

/** 批量实时行情（POST /v1/quotes，按 symbols[]） */
export async function getQuotesBatch(symbols: string[]): Promise<Quote[]> {
  const body: QuotesBatchBody = { symbols: toPlain(symbols) }
  const res = await window.ipcRenderer.invoke('stock:getQuotesBatch', body)
  if (!res?.success) throw new Error(res?.error || '批量查询实时行情失败')
  return res.data as Quote[]
}

/** K 线（单标的，GET /v1/klines） */
export async function getKlines(params: {
  symbol: string
  period?: Period
  count?: number
  start_time?: number
  end_time?: number
  adjust?: AdjustType
}): Promise<CompactKlineData> {
  const res = await window.ipcRenderer.invoke('stock:getKlines', params)
  if (!res?.success) throw new Error(res?.error || '查询 K 线失败')
  return res.data as CompactKlineData
}

/** 市场深度（五档，单标的） */
export async function getDepth(symbol: string): Promise<MarketDepth> {
  const res = await window.ipcRenderer.invoke('stock:getDepth', { symbol })
  if (!res?.success) throw new Error(res?.error || '查询市场深度失败')
  return res.data as MarketDepth
}

/** 查询标的元数据（GET /v1/instruments，逗号分隔字符串；可单可多） */
export async function getInstruments(symbols: string): Promise<Instrument[]> {
  const res = await window.ipcRenderer.invoke('stock:getInstruments', { symbols })
  if (!res?.success) throw new Error(res?.error || '查询标的元数据失败')
  return res.data as Instrument[]
}

/** 批量查询标的元数据（POST /v1/instruments，符号数组，最多 1000 个） */
export async function getInstrumentsBatch(symbols: string[]): Promise<Instrument[]> {
  const res = await window.ipcRenderer.invoke('stock:getInstrumentsBatch', { symbols: toPlain(symbols) })
  if (!res?.success) throw new Error(res?.error || '批量查询标的元数据失败')
  return res.data as Instrument[]
}

/** 设置 / 读取 API Key（若用户后续需要配置入口） */
export async function setApiKey(apiKey: string): Promise<void> {
  const res = await window.ipcRenderer.invoke('stock:setApiKey', apiKey)
  if (!res?.success) throw new Error(res?.error || '保存 API Key 失败')
}

export async function getApiKey(): Promise<string> {
  const res = await window.ipcRenderer.invoke('stock:getApiKey')
  if (!res?.success) throw new Error(res?.error || '读取 API Key 失败')
  return (res.data as string) || ''
}

/** 获取交易所列表（GET /v1/exchanges，缓存一周） */
export async function getExchanges(): Promise<ExchangesResponse> {
  const res = await window.ipcRenderer.invoke('stock:getExchanges', {})
  if (!res?.success) throw new Error(res?.error || '获取交易所列表失败')
  return res.data as ExchangesResponse
}

/** 获取某交易所的标的列表（GET /v1/exchanges/{exchange}/instruments，缓存一周） */
export async function getExchangeInstruments(exchange: string): Promise<ExchangeInstrumentsResponse> {
  const res = await window.ipcRenderer.invoke('stock:getExchangeInstruments', { exchange })
  if (!res?.success) throw new Error(res?.error || '获取交易所标的列表失败')
  return res as ExchangeInstrumentsResponse
}

/** 获取标的池列表（行业分类）（GET /v1/universes，缓存一周） */
export async function getUniverses(): Promise<UniversesResponse> {
  const res = await window.ipcRenderer.invoke('stock:getUniverses', {})
  if (!res?.success) throw new Error(res?.error || '获取标的池列表失败')
  return res.data as UniversesResponse
}

/** 获取标的池详情（含行业分类下的股票列表）（GET /v1/universes/{id}，缓存一周） */
export async function getUniverseDetail(id: string): Promise<UniverseDetail> {
  const res = await window.ipcRenderer.invoke('stock:getUniverseDetail', { id })
  if (!res?.success) throw new Error(res?.error || '获取标的池详情失败')
  return res.data as UniverseDetail
}

/** 常用股票：从缓存表提炼最近访问过的个股代码（最多 limit 个，默认 30） */
export async function getRecentSymbols(limit = 30): Promise<string[]> {
  const res = await window.ipcRenderer.invoke('stock:getRecentSymbols', { limit })
  if (!res?.success) throw new Error(res?.error || '读取常用股票失败')
  return (res.data as string[]) || []
}

/** 读取本地持久化的交易所主表（每次交易所列表请求都会 upsert） */
export async function getExchangesDb(): Promise<
  Array<{ exchange: string; region: string; count: number; updated_at: number }>
> {
  const res = await window.ipcRenderer.invoke('stock:getExchangesDb')
  if (!res?.success) throw new Error(res?.error || '读取交易所表失败')
  return (res.data as any[]) || []
}

/** 读取本地持久化的个股主表（可选按 exchange 过滤） */
export async function getInstrumentsDb(exchange?: string): Promise<
  Array<{ symbol: string; exchange: string; region: string; name: string; type: string; ext: unknown; updated_at: number }>
> {
  const res = await window.ipcRenderer.invoke('stock:getInstrumentsDb', { exchange })
  if (!res?.success) throw new Error(res?.error || '读取个股表失败')
  return (res.data as any[]) || []
}

/** 本地个股模糊搜索：按 代码 / 名称 / 简写 匹配（命中本地股票主表） */
export async function searchInstruments(
  keyword: string,
  limit = 50,
): Promise<Array<{ symbol: string; exchange: string; region: string; name: string; type: string }>> {
  const res = await window.ipcRenderer.invoke('stock:searchInstruments', { keyword, limit })
  if (!res?.success) throw new Error(res?.error || '个股搜索失败')
  return (res.data as any[]) || []
}

/** 缓存 TTL 配置（默认 + 当前覆盖），毫秒 */
export interface CacheTtlConfig {
  defaults: Record<string, number>
  overrides: Record<string, number>
}

/** 读取缓存 TTL 配置（供设置面板渲染） */
export async function getCacheTtl(): Promise<CacheTtlConfig> {
  const res = await window.ipcRenderer.invoke('stock:getCacheTtl')
  if (!res?.success) throw new Error(res?.error || '读取缓存配置失败')
  return res.data as CacheTtlConfig
}

/** 保存缓存 TTL 覆盖配置（仅影响后续写入的缓存条目）。传入 { 通道: 毫秒 } */
export async function setCacheTtl(overrides: Record<string, number>): Promise<CacheTtlConfig> {
  const res = await window.ipcRenderer.invoke('stock:setCacheTtl', overrides)
  if (!res?.success) throw new Error(res?.error || '保存缓存配置失败')
  return res.data as CacheTtlConfig
}
