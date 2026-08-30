/**
 * 记账 - 日/月/年范围工具函数
 *
 * 供记录列表（AccountingPage）与统计面板（StatisticsPanel）共用，
 * 消除两处重复的日期换算逻辑。
 */

/** 补零两位 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 今天日期字符串 YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 当前月份字符串 YYYY-MM */
export function currentMonth(): string {
  return todayStr().slice(0, 7)
}

/** 统计范围模式 */
export type RangeMode = 'day' | 'month' | 'year'

/**
 * 按范围模式平移日期值（上一期 / 下一期）
 *
 * @param mode - 范围模式：day / month / year
 * @param value - 当前值（YYYY-MM-DD / YYYY-MM / YYYY）
 * @param dir - 方向：-1 上一期，1 下一期
 * @returns 平移后的值（与 mode 同格式）
 */
export function shiftRangeValue(mode: RangeMode, value: string, dir: number): string {
  if (mode === 'day') {
    const [y, m, d] = value.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + dir)
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
  }
  if (mode === 'month') {
    const [y, m] = value.split('-').map(Number)
    const dt = new Date(y, m - 1 + dir, 1)
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`
  }
  return String(Number(value) + dir)
}

/**
 * 月份加减（跨年安全）
 *
 * @param month - 月份 YYYY-MM
 * @param n - 偏移月数（可负）
 * @returns 结果月份 YYYY-MM
 */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const dt = new Date(y, m - 1 + n, 1)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`
}
