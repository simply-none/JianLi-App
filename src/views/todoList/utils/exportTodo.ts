/**
 * 待办导出（D4）：Markdown / CSV 双格式。
 * 走统一导出规范（references/export.md）：exportTextToCache 直写缓存目录，
 * 成功后 fileNotify 蓝色可点击路径提示，不弹系统保存框。
 * 数据由调用方传入（通常为 store.filteredTodos，导出所见即所得）。
 */
import moment from 'moment';
import { exportTextToCache } from '@/utils/exportToFile';
import type { TodoItem, Tag } from '../types';
import { getTodoStatusMeta } from '../statusConfig';
import { dueGroupKeyOf, type DueGroupKey } from './time';

const PRIORITY_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' };

/** 分组顺序与文案（与「按截止日期」分组一致） */
const GROUP_ORDER: DueGroupKey[] = ['overdue', 'today', 'tomorrow', 'thisweek', 'later', 'nodate'];
const GROUP_LABEL: Record<DueGroupKey, string> = {
  overdue: '已逾期',
  today: '今天截止',
  tomorrow: '明天截止',
  thisweek: '本周截止',
  later: '更晚',
  nodate: '无截止日期',
};

/** 解析待办的标签 key 数组 */
function tagKeys(t: TodoItem): string[] {
  try {
    const arr = JSON.parse(t.tags || '[]');
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 导出 Markdown：按到期段分组分节，任务用复选框语法（完成态可勾选展示） */
export function buildTodoMarkdown(todos: TodoItem[], tags: Tag[]): string {
  const tagName = new Map(tags.map((t) => [t.key, t.name]));
  const lines: string[] = [];
  lines.push(`# 待办导出`);
  lines.push('');
  lines.push(`- 导出时间：${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  lines.push(`- 共 ${todos.length} 条`);
  lines.push('');

  for (const key of GROUP_ORDER) {
    const items = todos.filter((t) => dueGroupKeyOf(t.dueDate) === key);
    if (!items.length) continue;
    lines.push(`## ${GROUP_LABEL[key]}（${items.length}）`);
    lines.push('');
    for (const t of items) {
      const done = getTodoStatusMeta(t.status).value === 'completed';
      const check = done ? '- [x]' : '- [ ]';
      const parts: string[] = [];
      parts.push(`状态:${getTodoStatusMeta(t.status).label}`);
      parts.push(`优先级:${PRIORITY_LABEL[t.priority] || '中'}`);
      if (t.dueDate) parts.push(`截止:${t.dueDate}`);
      const names = tagKeys(t).map((k) => tagName.get(k)).filter(Boolean);
      if (names.length) parts.push(`标签:${names.map((n) => '#' + n).join(' ')}`);
      lines.push(`${check} ${t.title || '无标题'}（${parts.join(' ｜ ')}）`);
      if (t.description) lines.push(`  > ${t.description.replace(/\n/g, '\n  > ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** CSV 字段转义：含逗号/引号/换行时加引号，内部引号翻倍 */
function csvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** 导出 CSV：全字段平铺（带 BOM，Excel 直开不乱码） */
export function buildTodoCsv(todos: TodoItem[], tags: Tag[]): string {
  const tagName = new Map(tags.map((t) => [t.key, t.name]));
  const header = ['标题', '状态', '优先级', '截止时间', '标签', '子任务', '完成时间', '创建时间', '更新时间', '描述'];
  const rows = todos.map((t) => {
    const keys = tagKeys(t);
    const names = keys.map((k) => tagName.get(k) || k).join(' ');
    return [
      t.title || '',
      getTodoStatusMeta(t.status).label,
      PRIORITY_LABEL[t.priority] || '中',
      t.dueDate || '',
      names,
      keys.length ? '是' : '',
      t.completedTime || '',
      t.createTime || '',
      t.updateTime || '',
      (t.description || '').replace(/\r?\n/g, ' '),
    ]
      .map(csvCell)
      .join(',');
  });
  // \uFEFF BOM：Excel 识别 UTF-8
  return '\uFEFF' + [header.map(csvCell).join(','), ...rows].join('\r\n');
}

/** 导出入口：md / csv 落盘到缓存目录并提示（统一规范） */
export function exportTodos(todos: TodoItem[], tags: Tag[], format: 'md' | 'csv'): void {
  if (!todos.length) return;
  const stamp = moment().format('YYYYMMDD_HHmmss');
  if (format === 'md') {
    exportTextToCache(buildTodoMarkdown(todos, tags), `待办_${stamp}.md`, { title: '待办 Markdown 已导出' });
  } else {
    exportTextToCache(buildTodoCsv(todos, tags), `待办_${stamp}.csv`, { title: '待办 CSV 已导出' });
  }
}
