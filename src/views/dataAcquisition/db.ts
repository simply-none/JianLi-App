/**
 * 数据获取模块 - 数据库访问层
 * ------------------------------------------------------------------
 * 经主进程 new-sql:execute 通道操作两张业务表：
 *   - scraper_tasks    采集任务（完整配置 JSON）
 *   - scraper_history  采集历史（结果快照 + 记录数据）
 *
 * 防坑策略（与 netRequest/db.ts 相同，遵守 db-pitfalls）：
 *   1. SELECT 结果在返回值 data.rows 中；PRAGMA 用 pragma_table_info 探测
 *   2. 两张表均由本模块显式 CREATE TABLE IF NOT EXISTS，避免 execute 自动建表劫持结构
 *   3. SQLite 无法 ALTER 加主键：id 自增主键 + 必要处 CREATE UNIQUE INDEX
 *   4. 写失败向上抛错，由调用方 ElMessage 显式提示（不静默吞错）
 */
import { deepClone } from '@/utils/deepClone'
import type { TaskItem, HistoryItem, ScrapeConfig, ScrapeTaskResult } from './types'

/** 任务表名 */
const TASK_TABLE = 'scraper_tasks'
/** 历史表名 */
const HISTORY_TABLE = 'scraper_history'
/** 历史保留条数上限（超出时清理最旧记录） */
const HISTORY_LIMIT = 100

/** IPC 句柄 */
const ipc: any = (window as any).ipcRenderer

/**
 * 去除 Vue reactive Proxy，深拷贝为可被 IPC 结构化克隆的纯数据
 * @param value 任意数据
 * @returns 纯数据副本
 */
function cloneForIpc<T>(value: T): T {
  return deepClone(value)
}

/**
 * 执行写语句（INSERT/UPDATE/DELETE/DDL）
 * @param sql SQL 语句（支持 ? 占位参数）
 * @param params 参数列表
 * @returns { lastID, changes }
 * @throws {Error} SQL 执行失败时抛出原始错误信息
 */
async function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  const res = await ipc.handlePromise('new-sql:execute', cloneForIpc({ sql, params }))
  if (!res || !res.success) {
    throw new Error((res && res.error) || 'SQL 执行失败')
  }
  return res.data || { lastID: 0, changes: 0 }
}

/**
 * 执行查询语句（SELECT）
 * @param sql SQL 语句（支持 ? 占位参数）
 * @param params 参数列表
 * @returns 行数组（结果在 data.rows 中，此处已解包）
 * @throws {Error} SQL 执行失败时抛出原始错误信息
 */
async function dbQuery(sql: string, params: any[] = []): Promise<any[]> {
  const res = await ipc.handlePromise('new-sql:execute', cloneForIpc({ sql, params }))
  if (!res || !res.success) {
    throw new Error((res && res.error) || 'SQL 查询失败')
  }
  const d = res.data
  return d && d.rows ? d.rows : Array.isArray(d) ? d : []
}

/** 表结构校验完成的标记（进程内仅校验一次） */
let tableReady = false

/**
 * 确保两张表存在且结构可用（幂等，进程内首次调用时校验）
 * - 表不存在：显式建表（id 自增主键 + 全部业务列）
 * - 缺列：ALTER 补充
 * @throws {Error} 建表/补列失败时抛出
 */
async function ensureTables(): Promise<void> {
  if (tableReady) return

  // 1. 任务表（name 上唯一索引，重名保存即更新）
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${TASK_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      config TEXT,
      updated_at INTEGER
    )
  `)
  await dbRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_scraper_task_name ON ${TASK_TABLE} (name)`
  )
  // 2. 历史表
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_name TEXT,
      status TEXT,
      url TEXT,
      item_count INTEGER DEFAULT 0,
      elapsed INTEGER DEFAULT 0,
      error TEXT,
      config TEXT,
      data TEXT,
      created_at INTEGER
    )
  `)

  // 3. 结构探测 + 缺列补充（SELECT 开头才能拿到 rows）
  const patchColumns = async (table: string, cols: Array<{ name: string; def: string }>) => {
    const colNames: string[] = (
      await dbQuery(`SELECT * FROM pragma_table_info('${table}')`)
    ).map((c: any) => c.name)
    for (const col of cols) {
      if (!colNames.includes(col.name)) {
        await dbRun(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.def}`)
      }
    }
  }
  await patchColumns(TASK_TABLE, [
    { name: 'name', def: 'TEXT' },
    { name: 'config', def: 'TEXT' },
    { name: 'updated_at', def: 'INTEGER' },
  ])
  await patchColumns(HISTORY_TABLE, [
    { name: 'task_name', def: 'TEXT' },
    { name: 'status', def: 'TEXT' },
    { name: 'url', def: 'TEXT' },
    { name: 'item_count', def: 'INTEGER DEFAULT 0' },
    { name: 'elapsed', def: 'INTEGER DEFAULT 0' },
    { name: 'error', def: 'TEXT' },
    { name: 'config', def: 'TEXT' },
    { name: 'data', def: 'TEXT' },
    { name: 'created_at', def: 'INTEGER' },
  ])

  tableReady = true
}

/* ------------------------------------------------------------------ */
/* 任务管理                                                             */
/* ------------------------------------------------------------------ */

/**
 * 保存任务（指定 id 时按 id 更新，支持改名；未指定时按 name 幂等）
 * @param config 完整任务配置
 * @param id 任务 id（编辑已有任务时传入；新建时省略）
 * @returns 任务 id
 * @throws {Error} 写库失败时抛出（改名与其他任务重复时提示友好错误）
 */
export async function saveTask(config: ScrapeConfig, id?: number | null): Promise<number> {
  await ensureTables()
  const configJson = JSON.stringify(config)
  // 编辑已有任务：按 id 更新（含改名），不按名称匹配（否则改名会被当成新任务）
  if (id) {
    try {
      const res = await dbRun(
        `UPDATE ${TASK_TABLE} SET name = ?, config = ?, updated_at = ? WHERE id = ?`,
        [config.name, configJson, Date.now(), id]
      )
      if (res.changes > 0) return id
      // 任务已被删除（changes=0）时回退为按名称幂等的新增流程
    } catch (err) {
      // 名称唯一索引冲突 → 改成了其他任务的名称
      throw new Error(`保存失败：任务名称「${config.name}」与其他任务重复，请换一个名称`)
    }
  }
  const existing = await dbQuery(`SELECT id FROM ${TASK_TABLE} WHERE name = ?`, [config.name])
  if (existing.length) {
    const existId = existing[0].id
    await dbRun(`UPDATE ${TASK_TABLE} SET config = ?, updated_at = ? WHERE id = ?`, [
      configJson,
      Date.now(),
      existId,
    ])
    return existId
  }
  const res = await dbRun(
    `INSERT INTO ${TASK_TABLE} (name, config, updated_at) VALUES (?, ?, ?)`,
    [config.name, configJson, Date.now()]
  )
  return res.lastID
}

/**
 * 查询全部任务（按更新时间倒序）
 * @returns 任务列表
 * @throws {Error} 查询失败时抛出
 */
export async function listTasks(): Promise<TaskItem[]> {
  await ensureTables()
  const rows = await dbQuery(`SELECT * FROM ${TASK_TABLE} ORDER BY updated_at DESC`)
  return (rows || [])
    .map((row: any) => {
      try {
        return {
          id: row.id,
          name: row.name || '',
          config: JSON.parse(row.config) as ScrapeConfig,
          updatedAt: row.updated_at || 0,
        }
      } catch {
        return null
      }
    })
    .filter(Boolean) as TaskItem[]
}

/**
 * 删除任务
 * @param id 任务 id
 * @throws {Error} 删除失败时抛出
 */
export async function deleteTask(id: number): Promise<void> {
  await ensureTables()
  await dbRun(`DELETE FROM ${TASK_TABLE} WHERE id = ?`, [id])
}

/* ------------------------------------------------------------------ */
/* 采集历史                                                             */
/* ------------------------------------------------------------------ */

/**
 * 追加一条采集历史（自动清理超出上限的旧记录）
 * @param config 任务配置快照
 * @param result 任务结果
 * @throws {Error} 写库失败时抛出
 */
export async function addHistory(config: ScrapeConfig, result: ScrapeTaskResult): Promise<void> {
  await ensureTables()
  // 记录数据超 2MB 不落库（保留统计信息，防止单行过大拖垮查询）
  const dataJson = JSON.stringify(result.records || [])
  const dataStore = dataJson.length > 2 * 1024 * 1024 ? '[]' : dataJson
  await dbRun(
    `INSERT INTO ${HISTORY_TABLE} (task_name, status, url, item_count, elapsed, error, config, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      config.name || '',
      result.success ? 'success' : result.reason === '任务已手动停止' ? 'stopped' : 'error',
      result.url || '',
      result.records?.length || 0,
      result.elapsed || 0,
      result.reason || '',
      JSON.stringify(config),
      dataStore,
      Date.now(),
    ]
  )
  // 清理超出上限的旧记录（保留最近 HISTORY_LIMIT 条）
  await dbRun(
    `DELETE FROM ${HISTORY_TABLE} WHERE id NOT IN (
      SELECT id FROM ${HISTORY_TABLE} ORDER BY created_at DESC LIMIT ?
    )`,
    [HISTORY_LIMIT]
  )
}

/**
 * 解析历史表行 → HistoryItem
 * @param row 数据库原始行
 * @returns 解析后的历史项（解析失败返回 null）
 */
function parseHistoryRow(row: any): HistoryItem | null {
  try {
    return {
      id: row.id,
      taskName: row.task_name || '',
      status: row.status || 'error',
      url: row.url || '',
      itemCount: row.item_count || 0,
      elapsed: row.elapsed || 0,
      error: row.error || '',
      config: row.config ? JSON.parse(row.config) : null,
      data: row.data ? JSON.parse(row.data) : null,
      createdAt: row.created_at || 0,
    }
  } catch {
    return null
  }
}

/**
 * 查询采集历史（按时间倒序）
 * @param keyword 搜索关键字（对任务名模糊匹配，空串查全部）
 * @param limit 条数上限，默认 50
 * @returns 历史项数组（最近在前）
 * @throws {Error} 查询失败时抛出
 */
export async function listHistory(keyword = '', limit = 50): Promise<HistoryItem[]> {
  await ensureTables()
  const rows = keyword
    ? await dbQuery(
        `SELECT * FROM ${HISTORY_TABLE} WHERE task_name LIKE ? ORDER BY created_at DESC LIMIT ?`,
        [`%${keyword}%`, limit]
      )
    : await dbQuery(`SELECT * FROM ${HISTORY_TABLE} ORDER BY created_at DESC LIMIT ?`, [limit])
  return (rows || []).map(parseHistoryRow).filter(Boolean) as HistoryItem[]
}

/**
 * 删除单条历史
 * @param id 历史 id
 * @throws {Error} 删除失败时抛出
 */
export async function deleteHistory(id: number): Promise<void> {
  await ensureTables()
  await dbRun(`DELETE FROM ${HISTORY_TABLE} WHERE id = ?`, [id])
}

/**
 * 清空全部历史
 * @throws {Error} 删除失败时抛出
 */
export async function clearHistory(): Promise<void> {
  await ensureTables()
  await dbRun(`DELETE FROM ${HISTORY_TABLE}`)
}
