/**
 * 周期账单 - 日期计算工具（纯函数，无副作用）
 *
 * 执行日（day 字段）的存储格式与解释：
 * - monthly：'1'~'31'，当月无该日时取月末最后一天（如 31 在 2 月取 28/29）
 * - weekly：'1'~'7'（1=周一 … 7=周日）
 * - yearly：'MM-DD'（2 月 29 日在平年自动顺延为 3 月 1 日）
 *
 * 被 recurring 子模块（自动记账引擎）与 RecurringEditDialog（下次执行日预览）共用。
 */
import type { RecurringCycle } from '@/constants/accounting'

/** 补零两位 */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 格式化 Date 为 YYYY-MM-DD */
function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 解析 YYYY-MM-DD 为本地 Date（避免 UTC 偏移问题） */
function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 日期加 n 天 */
export function addDays(dateStr: string, n: number): string {
  const d = parse(dateStr)
  d.setDate(d.getDate() + n)
  return fmt(d)
}

/** 某月的天数（month = YYYY-MM） */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/**
 * 计算某月内 day 号的实际日期（day 超出月末时收敛到月末最后一天）
 *
 * @param month - 月份 YYYY-MM
 * @param day - 几号（1~31）
 * @returns 日期字符串 YYYY-MM-DD
 */
export function clampDayInMonth(month: string, day: number): string {
  const d = Math.min(Math.max(Math.floor(day) || 1, 1), 31)
  return `${month}-${pad2(Math.min(d, daysInMonth(month)))}`
}

/**
 * 周期 + 执行日的展示文案
 *
 * @param cycle - 周期类型
 * @param day - 执行日（存储格式见文件头）
 * @returns 文案，如「每月 1 日」「每周一」「每年 01-15」
 */
export function cycleDayLabel(cycle: RecurringCycle, day: string): string {
  if (cycle === 'weekly') {
    const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    return `每${names[(Number(day) || 1) - 1] || '周一'}`
  }
  if (cycle === 'monthly') return `每月 ${Number(day) || 1} 日`
  return `每年 ${day}`
}

/**
 * 计算从 from 起（含 from）第一个符合「周期 + 执行日」的日期
 *
 * @param from - 起始日期 YYYY-MM-DD（结果 >= from）
 * @param cycle - 周期类型
 * @param day - 执行日（存储格式见文件头）
 * @returns 下一个执行日 YYYY-MM-DD
 */
export function nextOccurrenceFrom(from: string, cycle: RecurringCycle, day: string): string {
  if (cycle === 'weekly') {
    const target = ((Number(day) || 1) - 1 + 7) % 7 // 0=周一 … 6=周日
    const cur = (parse(from).getDay() + 6) % 7
    const diff = (target - cur + 7) % 7
    return addDays(from, diff)
  }
  if (cycle === 'monthly') {
    const d = Number(day) || 1
    const candidate = clampDayInMonth(from.slice(0, 7), d)
    if (candidate >= from) return candidate
    // 本月执行日已过 → 下个月（month + 1，跨年安全）
    const [y, m] = from.split('-').map(Number)
    const next = new Date(y, m, 1)
    const nm = `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`
    return clampDayInMonth(nm, d)
  }
  // yearly：day = 'MM-DD'，2 月 29 日在平年经 Date 滚动顺延为 3 月 1 日
  const [y] = from.split('-').map(Number)
  const md = day || '01-01'
  const [mm, dd] = md.split('-').map(Number)
  const candidateDate = new Date(y, mm - 1, dd)
  const candidate = fmt(candidateDate)
  if (candidate >= from) return candidate
  return fmt(new Date(y + 1, mm - 1, dd))
}

/**
 * 计算某次执行之后（不含该日）的下一期执行日
 *
 * @param done - 刚执行完的日期 YYYY-MM-DD
 * @param cycle - 周期类型
 * @param day - 执行日（存储格式见文件头）
 * @returns 下一期执行日 YYYY-MM-DD
 */
export function advanceOccurrence(done: string, cycle: RecurringCycle, day: string): string {
  return nextOccurrenceFrom(addDays(done, 1), cycle, day)
}
