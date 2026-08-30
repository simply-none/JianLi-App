/**
 * 待办模块集中类型定义
 * - 消除原 4 处重复声明（index / TodoList / TodoDetailDialog / todoMiniWindow）
 * - 新增子任务关联字段（parentIds / sortOrder）与重复任务字段（recurrence*）
 * - 渲染端统一从这里 import，主进程 recurrence 引擎也复用字段约定
 */
import type { TodoStatus } from './statusConfig';

/** 优先级：高 / 中 / 低 */
export type Priority = 'high' | 'medium' | 'low';

/** 重复规则：每天 / 每周 / 不重复(null) */
export type RecurrenceRule = 'daily' | 'weekly' | null;

/** 标签（todo_tags 表） */
export interface Tag {
  key: string;
  name: string;
  color: string;
}

/**
 * 待办条目（对应 SQLite todo_list 表的一行）
 * 说明：
 * - 子任务：parentIds 为关联父任务 key 数组（可为多个），空数组/空表示根任务；子任务作为独立待办展示
 * - 重复任务：recurrenceRule 非空且 recurrenceId 为空的行是「模板」；
 *   recurrenceId 非空、isRecurrenceInstance=1 的行是自动生成的「周期实例」
 */
export interface TodoItem {
  key: string;
  title: string;
  description: string;
  /** 标签 key 列表的 JSON 字符串，如 '["k1","k2"]' */
  tags: string;
  completed: number;
  completedTime: string;
  priority: Priority;
  /** 截止时间 YYYY-MM-DD HH:mm:ss */
  dueDate: string;
  /** 状态：未开始/进行中/阻塞/已完成/已取消/重新开始，缺省按 completed 推导 */
  status?: TodoStatus;
  /** 是否开启截止提醒（0/1） */
  deadlineReminder?: number;
  remindCount?: number;
  remindInterval?: number;
  remindIntervalUnit?: string; // 'minute' | 'hour'
  createTime: string;
  updateTime: string;
  // ===== 新增：子任务关联（可关联多个父任务）=====
  /** 关联父任务 key 数组；空数组/空表示根任务 */
  parentIds?: string[] | null;
  /** 同级排序权重（用 sortOrder 而非 order，避免 SQL 保留字冲突） */
  sortOrder?: number;
  // ===== 新增：重复任务 =====
  /** 重复规则：daily / weekly / null */
  recurrenceRule?: RecurrenceRule;
  /** 间隔：每 N 天 / 每 N 周 */
  recurrenceInterval?: number;
  /** 每周生效的星期（0-6 数组的 JSON）；空则取模板创建日所在星期 */
  recurrenceWeekdays?: string | null;
  /** 重复结束日期 YYYY-MM-DD；空=无限 */
  recurrenceEnd?: string | null;
  /** 关联模板 key；实例行非空 */
  recurrenceId?: string | null;
  /** 是否为周期自动生成的实例（0/1） */
  isRecurrenceInstance?: number;
}
