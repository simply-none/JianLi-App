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

/** 指数移动平均（EMA），首值以首根收盘价播种 */
function calcEMA(values: number[], n: number): number[] {
  const k = 2 / (n + 1)
  const out: number[] = []
  let prev = values[0] ?? 0
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

/** MACD：返回 DIF、DEA 双线以及 MACD 柱（= 2 * (DIF - DEA)），与 bars 等长 */
export function calcMACD(
  bars: KlineBar[],
  fast = 12,
  slow = 26,
  signal = 9,
): { dif: number[]; dea: number[]; macd: number[] } {
  const closes = bars.map((b) => b.close)
  const emaFast = calcEMA(closes, fast)
  const emaSlow = calcEMA(closes, slow)
  const dif = closes.map((_, i) => emaFast[i] - emaSlow[i])
  const dea = calcEMA(dif, signal)
  const macd = dif.map((d, i) => 2 * (d - dea[i]))
  return { dif, dea, macd }
}

/** KDJ（默认 9 日），前 n-1 根以 50 播种，返回 K/D/J 三线 */
export function calcKDJ(bars: KlineBar[], n = 9): { k: number[]; d: number[]; j: number[] } {
  const k: number[] = []
  const d: number[] = []
  const j: number[] = []
  let prevK = 50
  let prevD = 50
  for (let i = 0; i < bars.length; i++) {
    const start = Math.max(0, i - n + 1)
    let low = Infinity
    let high = -Infinity
    for (let m = start; m <= i; m++) {
      low = Math.min(low, bars[m].low)
      high = Math.max(high, bars[m].high)
    }
    const rsv = high === low ? 0 : ((bars[i].close - low) / (high - low)) * 100
    const kk = (2 / 3) * prevK + (1 / 3) * rsv
    const dd = (2 / 3) * prevD + (1 / 3) * kk
    const jj = 3 * kk - 2 * dd
    k.push(kk)
    d.push(dd)
    j.push(jj)
    prevK = kk
    prevD = dd
  }
  return { k, d, j }
}

/** RSI（Wilder 平滑，默认 14 日），前 n 根为 null */
export function calcRSI(bars: KlineBar[], n = 14): Array<number | null> {
  const out: Array<number | null> = []
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      out.push(null)
      continue
    }
    const ch = bars[i].close - bars[i - 1].close
    const gain = ch > 0 ? ch : 0
    const loss = ch < 0 ? -ch : 0
    if (i <= n) {
      avgGain += gain
      avgLoss += loss
      if (i === n) {
        avgGain /= n
        avgLoss /= n
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss
        out.push(rs === Infinity ? 100 : 100 - 100 / (1 + rs))
      } else {
        out.push(null)
      }
    } else {
      avgGain = (avgGain * (n - 1) + gain) / n
      avgLoss = (avgLoss * (n - 1) + loss) / n
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss
      out.push(rs === Infinity ? 100 : 100 - 100 / (1 + rs))
    }
  }
  return out
}

/** 布林带（Bollinger Bands）：中轨 = SMA(n)，上下轨 = 中轨 ± k × 标准差；返回三根等长序列，前 n-1 根为 null */
export function calcBOLL(
  bars: KlineBar[],
  n = 20,
  k = 2,
): { mid: Array<number | null>; upper: Array<number | null>; lower: Array<number | null> } {
  const mid: Array<number | null> = []
  const upper: Array<number | null> = []
  const lower: Array<number | null> = []
  let sum = 0
  let sumSq = 0
  for (let i = 0; i < bars.length; i++) {
    const c = bars[i].close
    sum += c
    sumSq += c * c
    if (i >= n) {
      sum -= bars[i - n].close
      sumSq -= bars[i - n].close * bars[i - n].close
    }
    if (i >= n - 1) {
      const mean = sum / n
      const variance = Math.max(0, sumSq / n - mean * mean)
      const sd = Math.sqrt(variance)
      mid.push(mean)
      upper.push(mean + k * sd)
      lower.push(mean - k * sd)
    } else {
      mid.push(null)
      upper.push(null)
      lower.push(null)
    }
  }
  return { mid, upper, lower }
}

/** CCI（顺势指标，默认 14 日），前 n-1 根为 null */
export function calcCCI(bars: KlineBar[], n = 14): Array<number | null> {
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3)
  const out: Array<number | null> = []
  let sum = 0
  for (let i = 0; i < bars.length; i++) {
    sum += tp[i]
    if (i >= n) sum -= tp[i - n]
    if (i < n - 1) {
      out.push(null)
      continue
    }
    const ma = sum / n
    let md = 0
    for (let m = i - n + 1; m <= i; m++) md += Math.abs(tp[m] - ma)
    md /= n
    out.push(md === 0 ? 0 : (tp[i] - ma) / (0.015 * md))
  }
  return out
}

/** WR（威廉指标，默认 10 日），取值范围 0~100；前 n-1 根为 null */
export function calcWR(bars: KlineBar[], n = 10): Array<number | null> {
  const out: Array<number | null> = []
  for (let i = 0; i < bars.length; i++) {
    if (i < n - 1) {
      out.push(null)
      continue
    }
    let hh = -Infinity
    let ll = Infinity
    for (let m = i - n + 1; m <= i; m++) {
      hh = Math.max(hh, bars[m].high)
      ll = Math.min(ll, bars[m].low)
    }
    const c = bars[i].close
    out.push(hh === ll ? 0 : ((hh - c) / (hh - ll)) * 100)
  }
  return out
}

/** BIAS（乖离率，默认 6 日），=(收盘 - MA(n)) / MA(n) × 100；前 n-1 根为 null */
export function calcBIAS(bars: KlineBar[], n = 6): Array<number | null> {
  const out: Array<number | null> = []
  let sum = 0
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close
    if (i >= n) sum -= bars[i - n].close
    if (i < n - 1) {
      out.push(null)
      continue
    }
    const ma = sum / n
    out.push(ma === 0 ? 0 : ((bars[i].close - ma) / ma) * 100)
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
