/**
 * K 线数据工具：列式 -> 行式转换，以及基于 K 线可衍生的分析指标。
 * 纯函数，无 Vue 依赖，便于测试与组件复用。
 */

import type { CompactKlineData, Period } from './types'

/** 单根 K 线 */
export interface KlineBar {
  /** 毫秒时间戳 */
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

/** 将列式 CompactKlineData 转成按时间升序的行式数组 */export function toBars(k: CompactKlineData | undefined): KlineBar[] {
  if (!k) return []
  const ts = k.timestamp || []
  const open = k.open || []
  const high = k.high || []
  const low = k.low || []
  const close = k.close || []
  const volume = k.volume || []
  const amount = k.amount || []
  const len = Math.min(
    ts.length,
    open.length,
    high.length,
    low.length,
    close.length,
  )
  const bars: KlineBar[] = []
  for (let i = 0; i < len; i++) {
    bars.push({
      timestamp: ts[i],
      open: open[i],
      high: high[i],
      low: low[i],
      close: close[i],
      volume: volume[i] ?? 0,
      amount: amount[i] ?? 0,
    })
  }
  return bars
}

/** 按周期格式化 K 线时间戳（用于坐标轴与区间标题展示） */
export function formatKlineDate(ts: number, period: Period): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  // 年K/月K 用更粗的粒度展示，避免拥挤
  if (period === '1Y') return `${d.getFullYear()}`
  if (period === '1M') return `${d.getFullYear()}-${p(d.getMonth() + 1)}`
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 周期对应的中文单位（用于「单日/单周/单月/单年」等文案） */
const PERIOD_UNIT: Record<Period, string> = {
  '1m': '分钟',
  '5m': '5分钟',
  '10m': '10分钟',
  '15m': '15分钟',
  '30m': '30分钟',
  '60m': '60分钟',
  '1d': '日',
  '1w': '周',
  '1M': '月',
  '1Q': '季',
  '1Y': '年',
}
export function periodUnit(period: Period): string {
  return PERIOD_UNIT[period] || '周期'
}

/** 简单移动平均（按收盘价计算），返回与 bars 等长的数组，前 n-1 项为 null */
export function calcMA(bars: KlineBar[], n: number): Array<number | null> {
  const out: Array<number | null> = []
  let sum = 0
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close
    if (i >= n) sum -= bars[i - n].close
    out.push(i >= n - 1 ? sum / n : null)
  }
  return out
}


/** 振幅 = (最高 - 最低) / 前收 * 100（首根用当根开盘替代前收以避免异常） */
export function amplitudePercent(bar: KlineBar, prevClose?: number): number {
  const base = prevClose ?? bar.open
  if (!base) return 0
  return ((bar.high - bar.low) / base) * 100
}

export interface KlineAnalysisResult {
  /** 总交易日 */
  totalDays: number
  /** 振幅超过阈值 x% 的天数 */
  ampOverCount: number
  /** 涨停天数（收盘涨幅 >= 涨停阈值） */
  limitUpCount: number
  /** 跌停天数（收盘跌幅 <= -跌停阈值） */
  limitDownCount: number
  /** 平均振幅（%） */
  avgAmplitude: number
  /** 最大回撤（%） */
  maxDrawdown: number
  /** 最大单日涨幅（%） */
  maxGain: number
  /** 最大单日跌幅（%） */
  maxLoss: number
  /** 连涨最长天数 */
  maxUpStreak: number
  /** 连跌最长天数 */
  maxDownStreak: number
  /** 区间累计涨跌幅（%） */
  cumulativeChange: number
}

export interface AnalysisOptions {
  /** 振幅阈值（%），默认 5 */
  ampThreshold?: number
  /** 涨停阈值（%），默认 10 */
  limitUpThreshold?: number
  /** 跌停阈值（%），默认 10（通常等同涨停阈值） */
  limitDownThreshold?: number
}

/** 计算 K 线分析指标 */
export function analyzeKline(
  bars: KlineBar[],
  opts: AnalysisOptions = {},
): KlineAnalysisResult {
  const ampThreshold = opts.ampThreshold ?? 5
  const limitUpThreshold = opts.limitUpThreshold ?? 10
  const limitDownThreshold = opts.limitDownThreshold ?? limitUpThreshold

  const totalDays = bars.length
  if (totalDays === 0) {
    return {
      totalDays: 0,
      ampOverCount: 0,
      limitUpCount: 0,
      limitDownCount: 0,
      avgAmplitude: 0,
      maxDrawdown: 0,
      maxGain: 0,
      maxLoss: 0,
      maxUpStreak: 0,
      maxDownStreak: 0,
      cumulativeChange: 0,
    }
  }

  let ampOverCount = 0
  let sumAmp = 0
  let limitUpCount = 0
  let limitDownCount = 0
  let maxGain = -Infinity
  let maxLoss = Infinity
  let maxDrawdown = 0
  let peak = bars[0].close
  let upStreak = 0
  let downStreak = 0
  let maxUpStreak = 0
  let maxDownStreak = 0

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]
    const prevClose = i === 0 ? bar.open : bars[i - 1].close
    const amp = amplitudePercent(bar, prevClose)
    sumAmp += amp
    if (amp >= ampThreshold) ampOverCount++

    const change = ((bar.close - prevClose) / prevClose) * 100
    if (change >= limitUpThreshold) limitUpCount++
    if (change <= -limitDownThreshold) limitDownCount++
    if (change > maxGain) maxGain = change
    if (change < maxLoss) maxLoss = change

    if (change > 0) {
      upStreak++
      downStreak = 0
      if (upStreak > maxUpStreak) maxUpStreak = upStreak
    } else if (change < 0) {
      downStreak++
      upStreak = 0
      if (downStreak > maxDownStreak) maxDownStreak = downStreak
    } else {
      upStreak = 0
      downStreak = 0
    }

    if (bar.close > peak) peak = bar.close
    const dd = ((peak - bar.close) / peak) * 100
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const first = bars[0]
  const last = bars[bars.length - 1]
  const cumulativeChange = ((last.close - first.open) / first.open) * 100

  return {
    totalDays,
    ampOverCount,
    limitUpCount,
    limitDownCount,
    avgAmplitude: sumAmp / totalDays,
    maxDrawdown,
    maxGain,
    maxLoss,
    maxUpStreak,
    maxDownStreak,
    cumulativeChange,
  }
}
