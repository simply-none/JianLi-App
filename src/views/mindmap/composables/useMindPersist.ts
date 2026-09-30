/**
 * 思维导图 —— 持久化（渲染端薄封装，走 newSql 三件套）。
 *
 * 红线：渲染端不碰 SQL、不碰 electron，一切经 IPC；
 * 只用 `new-sql:query / upsert / delete`，**严禁裸 `new-sql:execute`**。
 *
 * 表结构（首次 upsert 时由主进程按数据列自动建表）：
 *   id INTEGER 主键自增 | name TEXT | type TEXT | data TEXT(树 JSON) | create_time TEXT | update_time TEXT
 */

import moment from 'moment'

import { MINDMAP_PRIMARY_KEY, MINDMAP_TABLE } from '../constants'
import type { MindDocRecord, MindDocState } from '../types'

/** newSql IPC 的统一返回外壳 */
interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}

/** 列表 / 详情查询要取的列（避开自动建表时框架塞进来的 name/value/created_at 默认列） */
const RECORD_COLUMNS = ['id', 'name', 'type', 'data', 'create_time', 'update_time']

function invoke<T>(channel: string, args: Record<string, unknown>): Promise<IpcResult<T>> {
  return window.ipcRenderer.handlePromise<IpcResult<T>>(channel, args)
}

function nowText(): string {
  return moment().format('YYYY-MM-DD HH:mm:ss')
}

/** 全部导图（按 id 倒序 = 最近修改优先） */
export async function listDocs(limit = 200): Promise<MindDocRecord[]> {
  const res = await invoke<MindDocRecord[]>('new-sql:query', {
    tableName: MINDMAP_TABLE,
    columns: RECORD_COLUMNS,
    limit,
    orderBy: MINDMAP_PRIMARY_KEY,
    orderByDesc: true,
  })
  if (!res.success || !Array.isArray(res.data)) return []
  return res.data
}

/** 最近一次保存的导图（启动时自动恢复用） */
export async function loadLatestDoc(): Promise<MindDocRecord | undefined> {
  const rows = await listDocs(1)
  return rows[0]
}

/** 按 id 读取一条 */
export async function loadDocById(id: number): Promise<MindDocRecord | undefined> {
  const res = await invoke<MindDocRecord[]>('new-sql:query', {
    tableName: MINDMAP_TABLE,
    columns: RECORD_COLUMNS,
    conditions: { id },
    limit: 1,
  })
  if (!res.success || !Array.isArray(res.data)) return undefined
  return res.data[0]
}

/**
 * 保存（新建或覆盖）。
 * @returns 落库后的记录 id；失败返回 undefined
 */
export async function saveDoc(state: MindDocState): Promise<number | undefined> {
  const timestamp = nowText()
  const row: Record<string, unknown> = {
    name: state.name,
    type: 'mindmap',
    data: JSON.stringify(state.data),
    create_time: timestamp,
    update_time: timestamp,
  }
  // 只有已落库过的文档才带 id（带 id 才会命中 ON CONFLICT 走更新）
  if (typeof state.id === 'number') row.id = state.id

  const res = await invoke<{ lastID?: number; changes?: number }>('new-sql:upsert', {
    tableName: MINDMAP_TABLE,
    data: row,
    config: { primaryKey: MINDMAP_PRIMARY_KEY },
  })
  if (!res.success) return undefined
  return typeof state.id === 'number' ? state.id : res.data?.lastID
}

/** 删除一条记录 */
export async function removeDoc(id: number): Promise<boolean> {
  const res = await invoke<unknown>('new-sql:delete', {
    tableName: MINDMAP_TABLE,
    condition: { id },
  })
  return res.success
}
