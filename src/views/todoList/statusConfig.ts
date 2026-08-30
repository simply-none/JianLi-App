// 待办状态配置：集中管理状态枚举、中文名与配色，供列表/表单/筛选复用，避免三处重复声明
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

// ============ 重复任务展示文案 ============
export type RecurrenceRule = 'daily' | 'weekly' | null;

export const RECURRENCE_OPTIONS: { value: RecurrenceRule; label: string }[] = [
  { value: null, label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
];

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 把重复配置格式化为可读文案，如「每 2 天」「每周一、三」 */
export function formatRecurrence(
  rule: RecurrenceRule | undefined | null,
  interval = 1,
  weekdays?: string | null,
): string {
  if (!rule) return '';
  if (rule === 'daily') {
    return interval > 1 ? `每 ${interval} 天` : '每天';
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
