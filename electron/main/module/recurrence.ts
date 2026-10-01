/**
 * 重复任务引擎 + 待办域主进程入口（主进程）
 * - 在应用启动与每日 00:00 扫描 todo_list 中的「重复模板」，按「天」懒生成实例（只生成当天的，不预生成未来）
 * - 每次保存重复待办后，渲染端发送 recurrence:sync 立即生成当天实例
 * - 生成完成后调用 newReminder 的 syncTodoReminders 重新排程截止提醒
 * - F2「完成后生成下一次」（on_complete 模板）：完成实例后按模板规则补生成下一期
 * - E5 回收站：每日 00:05 物理清理进站超过 30 天的软删除待办
 * - 接管 update-todo-reminders IPC：增量重排提醒 + 触发 on_complete 补生成
 *
 * 数据模型：模板行 recurrenceRule 非空且 recurrenceId 为空；实例行 recurrenceId=模板key、isRecurrenceInstance=1
 * 读取/写入均走 newSql 的 readSql/query/upsert/transaction（不使用危险通道 execute）。
 */
import { ipcMain } from 'electron';
import { CronJob } from 'cron';
import moment from 'moment';
import { randomUUID } from 'crypto';
import { query, upsert, readSql, transaction } from './newSql.ts';
import { syncTodoReminders } from './newReminder.ts';

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
  [k: string]: unknown;
}

/** 取所有重复模板：规则非空、非实例、未进回收站；仅 fixed 模式参与到点自动生成（on_complete 由完成动作驱动） */
async function getTemplates(): Promise<RawTodo[]> {
  const rows = await query({
    tableName: 'todo_list',
    SqlStr:
      "SELECT * FROM todo_list WHERE recurrenceRule IN ('daily','weekly','monthly','yearly') AND (recurrenceId IS NULL OR recurrenceId = '') AND (deleted IS NULL OR deleted = '' OR deleted = '0') AND (recurrenceMode IS NULL OR recurrenceMode = '' OR recurrenceMode = 'fixed')",
  });
  return (rows || []) as RawTodo[];
}

/** 取某模板已有的实例（按 recurrenceId）；走 readSql 参数化查询，禁止字符串拼接 SQL */
async function getInstances(templateKey: string): Promise<string[]> {
  const rows = await readSql('SELECT dueDate FROM todo_list WHERE recurrenceId = ?', [templateKey]);
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

/** 模板选中的周几（空则取锚点所在星期） */
function templateWeekdays(t: RawTodo): number[] {
  if (t.recurrenceRule !== 'weekly') return [];
  let weekdays: number[] = [];
  try {
    weekdays = (JSON.parse(t.recurrenceWeekdays || '[]') as number[]).filter((n) => n >= 0 && n <= 6);
  } catch {
    weekdays = [];
  }
  if (!weekdays.length) weekdays = [anchorDate(t).day()];
  return weekdays;
}

/**
 * 判定某日期是否命中模板周期（daily/weekly/monthly/yearly 共用）。
 * 统一要求 daysDiff >= 0（锚点在前不回溯生成）：
 * - daily：距锚点天数为间隔整数倍
 * - weekly：落在选中周几，且距锚点周数为间隔整数倍
 * - monthly：命中锚点的「几号」（该月无此号则不命中，如 31 号），且距锚点月数为间隔整数倍
 * - yearly：命中锚点的「月-日」（2/29 锚点只在闰年命中），且年差为间隔整数倍
 */
function ruleHit(
  rule: string,
  anchor: moment.Moment,
  d: moment.Moment,
  weekdays: number[],
  interval: number,
): boolean {
  const daysDiff = d.diff(anchor, 'days');
  if (daysDiff < 0) return false;
  if (rule === 'daily') return daysDiff % interval === 0;
  if (rule === 'weekly') {
    if (!weekdays.includes(d.day())) return false;
    return Math.floor(daysDiff / 7) % interval === 0;
  }
  if (rule === 'monthly') {
    if (d.date() !== anchor.date()) return false;
    const monthDiff = (d.year() - anchor.year()) * 12 + (d.month() - anchor.month());
    return monthDiff >= 0 && monthDiff % interval === 0;
  }
  if (rule === 'yearly') {
    if (d.month() !== anchor.month() || d.date() !== anchor.date()) return false;
    return (d.year() - anchor.year()) >= 0 && (d.year() - anchor.year()) % interval === 0;
  }
  return false;
}

/**
 * 计算模板在 base 之后（不含 base 当天）的第一个命中日期；超出 recurrenceEnd 返回 null。
 * 供 F2「完成后生成下一次」使用；逐日扫描上限两年（覆盖 yearly interval≤2 与大间隔 daily/monthly）。
 */
function nextHitDate(t: RawTodo, base: moment.Moment): moment.Moment | null {
  const anchor = anchorDate(t);
  const interval = Math.max(1, Number(t.recurrenceInterval) || 1);
  const weekdays = templateWeekdays(t);
  const endStr = t.recurrenceEnd ? moment(t.recurrenceEnd, 'YYYY-MM-DD').format('YYYY-MM-DD') : null;
  for (let i = 1; i <= 730; i++) {
    const d = base.clone().add(i, 'days');
    if (endStr && d.format('YYYY-MM-DD') > endStr) return null;
    if (ruleHit(t.recurrenceRule, anchor, d, weekdays, interval)) return d;
  }
  return null;
}

/** 按模板构造一条实例行（dueDate 取 occ 当天 + 模板时分秒） */
function buildInstance(t: RawTodo, occ: moment.Moment, interval: number) {
  const due = `${occ.format('YYYY-MM-DD')} ${timeOfDay(t)}`;
  return {
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
    parentIds: null,
    sortOrder: 0,
    recurrenceRule: t.recurrenceRule,
    recurrenceInterval: interval,
    recurrenceWeekdays: t.recurrenceWeekdays || null,
    recurrenceEnd: t.recurrenceEnd || null,
    recurrenceId: t.key,
    recurrenceMode: (t.recurrenceMode as string) || 'fixed',
    isRecurrenceInstance: 1,
  };
}

/**
 * 按「天」懒生成：只生成「今天」当天应存在的实例（已存在的按日期去重跳过）
 * 不预生成未来——未来某天的实例交由每日 00:00 的定时任务在其当天开始(00:00)时生成，
 * 避免一次性刷出大量实例。
 */
async function generateForTemplate(t: RawTodo) {
  const anchor = anchorDate(t);
  const interval = Math.max(1, Number(t.recurrenceInterval) || 1);
  const end = moment().endOf('day');
  const endStr = t.recurrenceEnd ? moment(t.recurrenceEnd, 'YYYY-MM-DD').format('YYYY-MM-DD') : null;
  const start = moment().startOf('day');
  const weekdays = templateWeekdays(t);

  const existingDays = new Set(await getInstances(t.key));
  const toCreate: moment.Moment[] = [];

  for (let d = start.clone(); d.isSameOrBefore(end); d.add(1, 'day')) {
    if (!ruleHit(t.recurrenceRule, anchor, d, weekdays, interval)) continue;
    const dayStr = d.format('YYYY-MM-DD');
    if (endStr && dayStr > endStr) break;
    if (existingDays.has(dayStr)) continue;
    toCreate.push(d.clone());
  }

  for (const occ of toCreate) {
    await upsert({
      tableName: 'todo_list',
      data: buildInstance(t, occ, interval),
      config: { primaryKey: 'key' },
    });
  }
}

/**
 * F2「完成后生成下一次」：完成某实例后，按其模板规则生成其后第一个命中日的实例。
 * 仅当模板 recurrenceMode = 'on_complete' 时生效；按（模板, dueDate 日）去重；超出 recurrenceEnd 不生成。
 * 由 update-todo-reminders（带 key）在提醒重排后调用。
 */
export async function generateOnCompleteNext(instKey?: string) {
  if (!instKey) return;
  try {
    const instRows = (await readSql('SELECT * FROM todo_list WHERE key = ?', [instKey])) as any[];
    const inst = (instRows || [])[0] as any | undefined;
    if (!inst || Number(inst.isRecurrenceInstance) !== 1 || !inst.recurrenceId) return;
    const isDone = inst.status === 'completed' || Number(inst.completed) === 1;
    if (!isDone) return;

    const tplRows = (await readSql('SELECT * FROM todo_list WHERE key = ?', [inst.recurrenceId])) as any[];
    const tpl = (tplRows || [])[0] as RawTodo | undefined;
    if (!tpl || tpl.recurrenceMode !== 'on_complete') return;

    // 基准日 = max(今天, 已完成实例的截止日)；下一次必须严格晚于基准日
    const today = moment().startOf('day');
    const instDue = moment(String(inst.dueDate || ''), 'YYYY-MM-DD HH:mm:ss').startOf('day');
    const base = instDue.isValid() && instDue.isAfter(today) ? instDue : today;
    const next = nextHitDate(tpl, base);
    if (!next) return;

    const dayStr = next.format('YYYY-MM-DD');
    const exist = (await readSql('SELECT key FROM todo_list WHERE recurrenceId = ? AND dueDate LIKE ?', [
      tpl.key,
      `${dayStr}%`,
    ])) as any[];
    if ((exist || []).length) return;

    await upsert({
      tableName: 'todo_list',
      data: buildInstance(tpl, next, Math.max(1, Number(tpl.recurrenceInterval) || 1)),
      config: { primaryKey: 'key' },
    });
    syncTodoReminders();
  } catch (e) {
    console.error('[recurrence] on_complete 生成下一次失败:', e);
  }
}

/** 全量补生成所有模板「当天」的实例，并刷新提醒排程 */
export async function generateRecurrenceInstances() {
  try {
    // 先兜底新列（幂等；否则存量库首次启动 getTemplates 会报 no such column）
    await ensureTodoColumns();
    const templates = await getTemplates();
    for (const t of templates) {
      await generateForTemplate(t);
    }
    syncTodoReminders();
  } catch (e) {
    console.error('[recurrence] 生成实例失败:', e);
  }
}

/** E5：物理删除进回收站超过 30 天的待办（每日 00:05 + 启动兜底各跑一次） */
async function purgeExpiredDeleted() {
  try {
    const cutoff = moment().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss');
    await transaction({
      sqls: ["DELETE FROM todo_list WHERE deleted = '1' AND updateTime < ?"],
      params: [[cutoff]],
    });
  } catch (e) {
    console.error('[recurrence] 回收站清理失败:', e);
  }
}

/**
 * 启动列兜底：本引擎的 SELECT 引用了 deleted / focusedMinutes / recurrenceMode 三个新列，
 * 而渲染端 newSql 的自动加列只在 upsert 时触发 —— 存量库若从未保存过含新列的数据，
 * 启动查询会报 no such column。这里在生成前按 newSql 惯例（ADD COLUMN TEXT）补齐。
 */
async function ensureTodoColumns() {
  try {
    const rows = (await query({ tableName: 'todo_list', SqlStr: 'PRAGMA table_info(todo_list)' })) as any[];
    const have = new Set(((rows || []) as any[]).map((c) => String(c?.name || '')));
    const need = ['deleted', 'focusedMinutes', 'recurrenceMode'].filter((c) => !have.has(c));
    for (const col of need) {
      await transaction({ sqls: [`ALTER TABLE todo_list ADD COLUMN ${col} TEXT`], params: [[]] });
    }
  } catch (e) {
    console.error('[recurrence] 确保 todo_list 新列失败:', e);
  }
}

export function initRecurrence() {
  // 启动时仅补生成「当天」实例（内部先兜底新列）
  generateRecurrenceInstances();
  purgeExpiredDeleted();

  // 渲染端保存重复待办后触发即时补生成（系列配置同步由渲染端直写完成后再触发本通道）
  ipcMain.on('recurrence:sync', () => {
    generateRecurrenceInstances();
  });

  // 待办增删改/状态切换后（渲染端发 update-todo-reminders）：
  // 先增量重排截止提醒，再按需补生成 on_complete 模板的下一期实例
  ipcMain.on('update-todo-reminders', (_event: unknown, key?: unknown) => {
    const k = typeof key === 'string' && key ? key : undefined;
    syncTodoReminders(k).then(() => generateOnCompleteNext(k));
  });

  // 每日 00:00 补生成未来实例；00:05 清理回收站
  try {
    new CronJob('0 0 0 * * *', () => generateRecurrenceInstances(), null, true, 'Asia/Shanghai');
    new CronJob('0 5 0 * * *', () => purgeExpiredDeleted(), null, true, 'Asia/Shanghai');
  } catch (e) {
    console.error('[recurrence] 定时任务注册失败:', e);
  }
}
