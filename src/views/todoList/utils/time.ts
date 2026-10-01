/**
 * 待办时间工具（统一时间口径收口）
 * 统一「YYYY-MM-DD HH:mm:ss」的解析与逾期/到期段判断，替代散落在
 * useTodo.dueGroup（replace(/-/g,'/')）、TodoBatchDeletePanel（字符串比较）等处的多种写法。
 * 全部基于 moment 解析，空值/非法值返回安全默认，杜绝三种比较写法并存。
 * 到期段口径与移动端 todo_filter.dart 对齐，保证跨端筛选语义一致。
 */
import moment from 'moment';

/** 解析待办时间字段（YYYY-MM-DD HH:mm:ss）；空或非法返回 null */
export function parseTodoDate(value?: string | null): moment.Moment | null {
  if (!value) return null;
  const m = moment(value, 'YYYY-MM-DD HH:mm:ss');
  return m.isValid() ? m : null;
}

/**
 * 是否已逾期：有截止时间、截止时刻早于当前、且未完成。
 * @param dueDate 截止时间
 * @param isDone 是否已完成（调用方按有效状态传入，如 effectiveStatus(t) === 'completed'）
 */
export function isOverdueItem(dueDate: string | undefined | null, isDone: boolean): boolean {
  const due = parseTodoDate(dueDate);
  return !!due && !isDone && due.isBefore(moment());
}

/** 到期段（筛选用，与移动端 todo_filter.dart 的到期段口径一致） */
export type DueSegment = 'overdue' | 'today' | 'thisweek' | 'thismonth' | 'later' | 'nodate';

/** 到期段中文文案（筛选 UI 与「今日聚焦」标题共用） */
export const DUE_SEGMENT_LABELS: Record<DueSegment, string> = {
  overdue: '已逾期',
  today: '今天到期',
  thisweek: '本周到期',
  thismonth: '本月到期',
  later: '更晚',
  nodate: '无截止日期',
};

/**
 * 计算到期段（只看时间，不含完成态；「逾期」的未完成限定由筛选层叠加）。
 * - overdue：今天 00:00 之前
 * - today：今天；thisweek：2~7 天内；thismonth：本月内其余；later：更晚
 */
export function dueSegment(dueDate?: string | null): DueSegment {
  const due = parseTodoDate(dueDate);
  if (!due) return 'nodate';
  const dayDiff = due.startOf('day').diff(moment().startOf('day'), 'days');
  if (dayDiff < 0) return 'overdue';
  if (dayDiff === 0) return 'today';
  if (dayDiff <= 7) return 'thisweek';
  if (due.isSame(moment(), 'month')) return 'thismonth';
  return 'later';
}

/** 「按截止日期」分组的段 key（比筛选用 DueSegment 多「明天」一档，保持既有分组不变） */
export type DueGroupKey = 'overdue' | 'today' | 'tomorrow' | 'thisweek' | 'nodate' | 'later';

/** 计算分组用到期段（dueGroup 专用，统一走 parseTodoDate） */
export function dueGroupKeyOf(dueDate?: string | null): DueGroupKey {
  const due = parseTodoDate(dueDate);
  if (!due) return 'nodate';
  const dayDiff = due.startOf('day').diff(moment().startOf('day'), 'days');
  if (dayDiff < 0) return 'overdue';
  if (dayDiff === 0) return 'today';
  if (dayDiff === 1) return 'tomorrow';
  if (dayDiff <= 7) return 'thisweek';
  return 'later';
}
