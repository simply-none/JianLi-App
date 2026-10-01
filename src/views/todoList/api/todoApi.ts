/**
 * 待办数据访问层（渲染端）
 * 严格遵循 jianli-app 红线：
 * - 读：走 new-sql:query（SqlStr 不带参，参数化由客户端过滤完成，杜绝注入）
 * - 写：走 new-sql:upsert / new-sql:delete
 * - 严禁裸 new-sql:execute（会 ALTER 污染表结构）
 * 全表一次拉取后由 useTodo store 做客户端过滤/分组/统计。
 */
import type { TodoItem, Tag } from '../types';
import { deriveStatusFromCompleted } from '../statusConfig';

/** 统一 IPC 调用封装 */
function ipc<T = any>(method: string, payload: Record<string, unknown>): Promise<T> {
  return window.ipcRenderer.handlePromise(method, payload) as Promise<T>;
}

/** 解析父子关联：新数据 parentIds(JSON 数组)，旧数据兼容单 parentId */
function parseParentIds(row: Record<string, any>): string[] {
  if (row.parentIds) {
    try {
      const arr = JSON.parse(row.parentIds);
      if (Array.isArray(arr)) return arr.filter((x: any) => typeof x === 'string');
    } catch {
      /* 解析失败回退 */
    }
  }
  if (row.parentId) return [row.parentId];
  return [];
}

/** 行归一化：补全默认值，旧数据无 status 时按 completed 推导 */
export function normalize(row: Record<string, any>): TodoItem {
  return {
    key: row.key,
    title: row.title || '',
    description: row.description || '',
    tags: row.tags || '[]',
    completed: Number(row.completed) || 0,
    completedTime: row.completedTime || '',
    priority: (row.priority as TodoItem['priority']) || 'medium',
    dueDate: row.dueDate || '',
    status: (row.status as TodoItem['status']) || deriveStatusFromCompleted(row.completed),
    deadlineReminder: Number(row.deadlineReminder) || 0,
    remindCount: Number(row.remindCount) || 1,
    remindInterval: Number(row.remindInterval) || 30,
    remindIntervalUnit: row.remindIntervalUnit === 'hour' ? 'hour' : 'minute',
    createTime: row.createTime || '',
    updateTime: row.updateTime || '',
    parentIds: parseParentIds(row),
    sortOrder: Number((row as any).sortOrder ?? (row as any).order) || 0,
    recurrenceRule: (row.recurrenceRule as TodoItem['recurrenceRule']) || null,
    recurrenceInterval: Number(row.recurrenceInterval) || 1,
    recurrenceWeekdays: row.recurrenceWeekdays || null,
    recurrenceEnd: row.recurrenceEnd || null,
    recurrenceId: row.recurrenceId || null,
    isRecurrenceInstance: Number(row.isRecurrenceInstance) || 0,
    // E5 回收站 / E3 专注累计 / F2 生成方式（缺省：未删除 / 0 / 到点自动生成）
    deleted: Number(row.deleted) || 0,
    focusedMinutes: Number(row.focusedMinutes) || 0,
    recurrenceMode: row.recurrenceMode === 'on_complete' ? 'on_complete' : 'fixed',
  };
}

/** 拉取全部待办（无 WHERE，避免 execute；过滤在 store 客户端完成） */
export async function fetchAllTodos(): Promise<TodoItem[]> {
  const res: any = await ipc('new-sql:query', {
    tableName: 'todo_list',
    SqlStr: 'SELECT * FROM todo_list ORDER BY updateTime DESC',
  });
  const rows: any[] = res?.data || res?.rows || [];
  return rows.map(normalize);
}

/** 拉取全部标签 */
export async function fetchTags(): Promise<Tag[]> {
  const res: any = await ipc('new-sql:query', { tableName: 'todo_tags', conditions: {} });
  return (res?.data || res?.rows || []) as Tag[];
}

/** 保存（新增/更新）单条待办，按 key 主键 upsert */
export async function saveTodo(todo: TodoItem) {
  return ipc('new-sql:upsert', {
    tableName: 'todo_list',
    data: todo,
    config: { primaryKey: 'key' },
  });
}

/** 删除单条待办 */
export async function deleteTodo(key: string) {
  return ipc('new-sql:delete', { tableName: 'todo_list', condition: { key } });
}

/**
 * 保存标签（新增标签时调用）。
 * todo_tags 主键是 INTEGER 自增 id：不带 id 的 upsert 永远不会命中 ON CONFLICT(id)，
 * 会退化为每次重复插入 —— 故先按 name 查已有标签，命中则携带其 id/key 更新原行。
 * 返回落库后的最终标签（含生效 key，供调用方自动选中，避免选中悬空的临时 key）。
 * 显式携带 id 时（标签管理编辑）直接按 id 更新。
 */
export async function saveTag(tag: Tag): Promise<Tag> {
  const existing = await fetchTags();
  const hit = tag.id ? undefined : existing.find((t) => t.name === tag.name);
  const finalTag: Tag = hit ? { ...tag, id: hit.id, key: hit.key } : tag;
  await ipc('new-sql:upsert', {
    tableName: 'todo_tags',
    data: finalTag,
    config: { primaryKey: 'id' },
  });
  return finalTag;
}

/** 删除标签（todo_tags 按 id 物理删除）；待办上的引用由调用方（标签管理弹窗）清理 */
export async function deleteTag(id: number) {
  return ipc('new-sql:delete', { tableName: 'todo_tags', condition: { id } });
}
