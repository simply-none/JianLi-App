// 待办状态配置：集中管理状态枚举、中文名与配色，供列表/表单/筛选复用，避免三处重复声明
import moment from 'moment';
import type { TodoItem } from './types';

export type TodoStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'restart';

export interface TodoStatusMeta {
  value: TodoStatus;
  label: string;
  color: string; // 文字/边框色
  bg: string;    // 徽标背景色
}

// 6 种状态：未开始 / 进行中 / 阻塞 / 已完成 / 已取消 / 重新开始
export const TODO_STATUS_LIST: TodoStatusMeta[] = [
  { value: 'not_started', label: '未开始', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  { value: 'in_progress', label: '进行中', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  { value: 'blocked', label: '阻塞', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  { value: 'completed', label: '已完成', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  { value: 'cancelled', label: '已取消', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  { value: 'restart', label: '重新开始', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
];

export const DEFAULT_TODO_STATUS: TodoStatus = 'not_started';

const STATUS_MAP: Record<string, TodoStatusMeta> = TODO_STATUS_LIST.reduce(
  (acc, item) => {
    acc[item.value] = item;
    return acc;
  },
  {} as Record<string, TodoStatusMeta>,
);

/** 取状态元信息，未命中时回退到默认"未开始" */
export function getTodoStatusMeta(status: string | undefined | null): TodoStatusMeta {
  return STATUS_MAP[status as string] || STATUS_MAP[DEFAULT_TODO_STATUS];
}

/** 由旧 completed 字段推导状态（兼容历史数据迁移） */
export function deriveStatusFromCompleted(completed: number | string | undefined): TodoStatus {
  return Number(completed) === 1 ? 'completed' : 'not_started';
}

// ============ 状态变更统一入口（状态双写收口） ============

/**
 * 状态双写收口：todo_list 的 status 与旧 completed 字段并存，提醒引擎两个字段都看，
 * 任何状态切换必须走这里一次性维护 status / completed / completedTime / updateTime 四字段，
 * 禁止在视图层散落手写（漏写其一即状态漂移）。
 * @param item 原待办（展开整行，不丢其它字段）
 * @param status 目标状态
 * @param now 可选时间戳（YYYY-MM-DD HH:mm:ss），缺省取当前时间
 */
export function applyStatus(item: TodoItem, status: TodoStatus, now?: string): TodoItem {
  const ts = now || moment().format('YYYY-MM-DD HH:mm:ss');
  const isDone = status === 'completed';
  return {
    ...item,
    status,
    completed: isDone ? 1 : 0,
    // 再次完成时保留既有 completedTime（语义 = 首次完成时刻，供统计使用），无则取当前
    completedTime: isDone ? item.completedTime || ts : '',
    updateTime: ts,
  };
}

// ============ 重复任务展示文案 ============
export type RecurrenceRule = 'daily' | 'weekly' | 'monthly' | 'yearly' | null;

export const RECURRENCE_OPTIONS: { value: RecurrenceRule; label: string }[] = [
  { value: null, label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
];

export const RECURRENCE_MODE_OPTIONS: { value: 'fixed' | 'on_complete'; label: string; hint: string }[] = [
  { value: 'fixed', label: '到点自动生成', hint: '每到周期日在列表自动出现一条实例' },
  { value: 'on_complete', label: '完成后生成下一次', hint: '完成当前实例后才生成下一期（攒着不催）' },
];

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 把重复配置格式化为可读文案，如「每 2 天」「每周一、三」「每 2 月」 */
export function formatRecurrence(
  rule: RecurrenceRule | undefined | null,
  interval = 1,
  weekdays?: string | null,
): string {
  if (!rule) return '';
  if (rule === 'daily') {
    return interval > 1 ? `每 ${interval} 天` : '每天';
  }
  if (rule === 'monthly') {
    return interval > 1 ? `每 ${interval} 个月` : '每月';
  }
  if (rule === 'yearly') {
    return interval > 1 ? `每 ${interval} 年` : '每年';
  }
  // weekly
  let days: number[] = [];
  try {
    days = (JSON.parse(weekdays || '[]') as number[]).sort((a, b) => a - b);
  } catch {
    days = [];
  }
  const dayText = days.length
    ? days.map((d) => '周' + WEEKDAY_LABELS[d]).join('、')
    : '每周';
  return interval > 1 ? `${interval} 周（${dayText}）` : dayText;
}
