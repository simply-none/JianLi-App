/**
 * 重复任务引擎（主进程）
 * - 在应用启动与每日 00:00 扫描 todo_list 中的「重复模板」，补生成未来一段时间内的周期实例
 * - 每次保存重复待办后，渲染端发送 recurrence:sync 立即补生成
 * - 生成完成后调用 applyTodoReminders 重新排程截止提醒
 *
 * 数据模型：模板行 recurrenceRule 非空且 recurrenceId 为空；实例行 recurrenceId=模板key、isRecurrenceInstance=1
 * 读取/写入均走 newSql 的 query/upsert（不使用危险通道）。
 */
import { ipcMain } from 'electron';
import { CronJob } from 'cron';
import moment from 'moment';
import { randomUUID } from 'crypto';
import { query, upsert } from './newSql.ts';
import { applyTodoReminders } from './job.ts';

/** 向前预生成多少天的实例 */
const LOOKAHEAD_DAYS = 60;

interface RawTodo {
  key: string;
  title: string;
  description: string;
  tags: string;
  priority: string;
  dueDate: string;
  deadlineReminder: number;
  remindCount: number;
  remindInterval: number;
  remindIntervalUnit: string;
  recurrenceRule: string;
  recurrenceInterval: number;
  recurrenceWeekdays: string | null;
  recurrenceEnd: string | null;
  createTime: string;
}

/** 取所有重复模板（recurrenceRule 非空且非实例） */
async function getTemplates(): Promise<RawTodo[]> {
  const rows = await query({
    tableName: 'todo_list',
    SqlStr:
      "SELECT * FROM todo_list WHERE recurrenceRule IN ('daily','weekly') AND (recurrenceId IS NULL OR recurrenceId = '')",
  });
  return (rows || []) as RawTodo[];
}

/** 取某模板已有的实例（按 recurrenceId） */
async function getInstances(templateKey: string): Promise<string[]> {
  const rows = await query({
    tableName: 'todo_list',
    SqlStr: `SELECT dueDate FROM todo_list WHERE recurrenceId = '${templateKey}'`,
  });
  return ((rows || []) as { dueDate: string }[]).map((r) => (r.dueDate || '').slice(0, 10));
}

/** 计算模板锚点（用于推算周期）：优先 dueDate 的日期，回退 createTime 日期 */
function anchorDate(t: RawTodo): moment.Moment {
  const base = t.dueDate || t.createTime;
  if (base) {
    const m = moment(base, 'YYYY-MM-DD HH:mm:ss');
    if (m.isValid()) return m;
  }
  return moment();
}

/** 取锚点的时分秒（无则默认 09:00:00） */
function timeOfDay(t: RawTodo): string {
  if (t.dueDate && moment(t.dueDate, 'YYYY-MM-DD HH:mm:ss').isValid()) {
    return moment(t.dueDate).format('HH:mm:ss');
  }
  return '09:00:00';
}

/**
 * 生成某模板在未来 LOOKAHEAD_DAYS 内的所有应存在实例
 * 已存在的（按 日期 去重）跳过，避免重复生成
 */
async function generateForTemplate(t: RawTodo) {
  const anchor = anchorDate(t);
  const tod = timeOfDay(t);
  const interval = Math.max(1, Number(t.recurrenceInterval) || 1);
  const end = moment().add(LOOKAHEAD_DAYS, 'days').endOf('day');
  const endStr = t.recurrenceEnd ? moment(t.recurrenceEnd, 'YYYY-MM-DD').format('YYYY-MM-DD') : null;
  const start = moment().startOf('day');

  let weekdays: number[] = [];
  if (t.recurrenceRule === 'weekly') {
    try {
      weekdays = (JSON.parse(t.recurrenceWeekdays || '[]') as number[]).filter((n) => n >= 0 && n <= 6);
    } catch {
      weekdays = [];
    }
    if (!weekdays.length) weekdays = [anchor.day()];
  }

  const existingDays = new Set(await getInstances(t.key));
  const toCreate: moment.Moment[] = [];

  for (let d = start.clone(); d.isSameOrBefore(end); d.add(1, 'day')) {
    const daysDiff = d.diff(anchor, 'days');
    let hit = false;
    if (t.recurrenceRule === 'daily') {
      hit = daysDiff >= 0 && daysDiff % interval === 0;
    } else if (t.recurrenceRule === 'weekly') {
      // 与锚点同星期、且间隔周数整除
      const weeksDiff = Math.floor(d.diff(anchor, 'weeks', true));
      hit = d.day() === weekdays[0] || weekdays.includes(d.day());
      // 仅在「锚点所在星期」对齐时才计入，避免每周多天重复生成
      const anchorWeekday = anchor.day();
      if (weekdays.includes(d.day())) {
        const wdiff = Math.floor(Math.abs(d.diff(anchor, 'days')) / 7);
        hit = wdiff % interval === 0;
        void anchorWeekday;
      } else {
        hit = false;
      }
    }
    if (!hit) continue;

    const dayStr = d.format('YYYY-MM-DD');
    if (endStr && dayStr > endStr) break;
    if (existingDays.has(dayStr)) continue;
    toCreate.push(d.clone());
  }

  for (const occ of toCreate) {
    const due = `${occ.format('YYYY-MM-DD')} ${tod}`;
    const instance = {
      key: randomUUID(),
      title: t.title,
      description: t.description || '',
      tags: t.tags || '[]',
      completed: 0,
      completedTime: '',
      priority: t.priority || 'medium',
      dueDate: due,
      status: 'not_started',
      deadlineReminder: Number(t.deadlineReminder) || 0,
      remindCount: Number(t.remindCount) || 1,
      remindInterval: Number(t.remindInterval) || 30,
      remindIntervalUnit: t.remindIntervalUnit === 'hour' ? 'hour' : 'minute',
      createTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      parentId: null,
      order: 0,
      recurrenceRule: t.recurrenceRule,
      recurrenceInterval: interval,
      recurrenceWeekdays: t.recurrenceWeekdays || null,
      recurrenceEnd: t.recurrenceEnd || null,
      recurrenceId: t.key,
      isRecurrenceInstance: 1,
    };
    await upsert({ tableName: 'todo_list', data: instance, config: { primaryKey: 'key' } });
  }
}

/** 全量补生成所有模板的实例，并刷新提醒排程 */
export async function generateRecurrenceInstances() {
  try {
    const templates = await getTemplates();
    for (const t of templates) {
      await generateForTemplate(t);
    }
    applyTodoReminders();
  } catch (e) {
    console.error('[recurrence] 生成实例失败:', e);
  }
}

export function initRecurrence() {
  // 启动时立即补生成一次
  generateRecurrenceInstances();

  // 渲染端保存重复待办后触发即时补生成
  ipcMain.on('recurrence:sync', () => {
    generateRecurrenceInstances();
  });

  // 每日 00:00 补生成未来实例
  try {
    new CronJob(
      '0 0 0 * * *',
      () => generateRecurrenceInstances(),
      null,
      true,
      'Asia/Shanghai',
    );
  } catch (e) {
    console.error('[recurrence] 定时任务注册失败:', e);
  }
}
