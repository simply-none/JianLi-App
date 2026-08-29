/**
 * 网络请求工作台 - 数据库访问层
 * ------------------------------------------------------------------
 * 通过主进程 newSql.ts 暴露的 new-sql:execute 通道，操作三张业务表：
 *   - net_request_history     请求历史（完整请求配置 JSON + 响应元数据）
 *   - net_request_collection  集合（文件夹/请求树，parent_id 关联）
 *   - net_request_env         环境变量（多环境，单激活）
 *
 * 已规避 newSql.execute 的已知坑（与 weather/db.ts 相同的防御策略）：
 *   1. SELECT 结果在返回值 data.rows 中；PRAGMA 用 pragma_table_info 探测
 *   2. 三张表均由本模块显式 CREATE TABLE IF NOT EXISTS（首个建表语句来自业务方），
 *      避免 execute 自动建表劫持结构
 *   3. SQLite 无法 ALTER 加主键：id 主键自增 + 必要处 CREATE UNIQUE INDEX
 *   4. 写失败向上抛错，由调用方 ElMessage 显式提示（不静默吞错）
 */

import type {
  CollectionNode,
  CollectionNodeType,
  Environment,
  EnvVar,
  HistoryItem,
  RequestConfig,
} from './types'

/** 历史表名 */
const HISTORY_TABLE = 'net_request_history'
/** 集合表名 */
const COLLECTION_TABLE = 'net_request_collection'
/** 环境变量表名 */
const ENV_TABLE = 'net_request_env'
/** 历史保留条数上限（超出时清理最旧记录） */
const HISTORY_LIMIT = 200

/** IPC 句柄（与 weather/db.ts 相同的访问方式） */
const ipc: any = (window as any).ipcRenderer

/**
 * 去除 Vue reactive Proxy，转成可被 IPC 结构化克隆的纯数据
 * @param value 任意数据
 * @returns 纯 JSON 数据
 */
function cloneForIpc<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null))
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
 * @returns 行数组（execute 的结果在 data.rows 中，此处已解包）
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
 * 确保三张表存在且结构可用（幂等，进程内首次调用时校验）
 * - 表不存在：显式建表（id 自增主键 + 全部业务列）
 * - 缺列：ALTER 补充
 */
async function ensureTables(): Promise<void> {
  if (tableReady) return

  // 1. 历史表
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT,
      url TEXT,
      status INTEGER DEFAULT 0,
      time INTEGER DEFAULT 0,
      size INTEGER DEFAULT 0,
      config TEXT,
      created_at INTEGER
    )
  `)
  // 2. 集合表
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${COLLECTION_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER DEFAULT 0,
      node_type TEXT,
      name TEXT,
      method TEXT,
      url TEXT,
      config TEXT,
      sort INTEGER DEFAULT 0,
      updated_at INTEGER
    )
  `)
  // 3. 环境变量表
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${ENV_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      vars TEXT,
      is_active INTEGER DEFAULT 0,
      updated_at INTEGER
    )
  `)

  // 4. 结构探测 + 缺列补充（SELECT 开头才能拿到 rows）
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
  await patchColumns(HISTORY_TABLE, [
    { name: 'method', def: 'TEXT' },
    { name: 'url', def: 'TEXT' },
    { name: 'status', def: 'INTEGER DEFAULT 0' },
    { name: 'time', def: 'INTEGER DEFAULT 0' },
    { name: 'size', def: 'INTEGER DEFAULT 0' },
    { name: 'config', def: 'TEXT' },
    { name: 'created_at', def: 'INTEGER' },
  ])
  await patchColumns(COLLECTION_TABLE, [
    { name: 'parent_id', def: 'INTEGER DEFAULT 0' },
    { name: 'node_type', def: 'TEXT' },
    { name: 'name', def: 'TEXT' },
    { name: 'method', def: 'TEXT' },
    { name: 'url', def: 'TEXT' },
    { name: 'config', def: 'TEXT' },
    { name: 'sort', def: 'INTEGER DEFAULT 0' },
    { name: 'updated_at', def: 'INTEGER' },
  ])
  await patchColumns(ENV_TABLE, [
    { name: 'name', def: 'TEXT' },
    { name: 'vars', def: 'TEXT' },
    { name: 'is_active', def: 'INTEGER DEFAULT 0' },
    { name: 'updated_at', def: 'INTEGER' },
  ])

  tableReady = true
}

/* ------------------------------------------------------------------ */
/* 请求历史                                                            */
/* ------------------------------------------------------------------ */

/**
 * 追加一条请求历史（自动清理超出上限的旧记录）
 * @param config 完整请求配置
 * @param meta 响应元数据（状态码/耗时/大小；失败时 status 传 0）
 */
export async function addHistory(
  config: RequestConfig,
  meta: { status: number; time: number; size: number }
): Promise<void> {
  await ensureTables()
  await dbRun(
    `INSERT INTO ${HISTORY_TABLE} (method, url, status, time, size, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      config.method,
      config.url,
      meta.status,
      meta.time,
      meta.size,
      JSON.stringify(config),
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
 * 解析历史表行 → HistoryItem（config JSON 解析失败返回 null）
 * @param row 数据库原始行
 * @returns 解析后的历史项
 */
function parseHistoryRow(row: any): HistoryItem | null {
  try {
    return {
      id: row.id,
      method: row.method,
      url: row.url,
      status: row.status || 0,
      time: row.time || 0,
      size: row.size || 0,
      createdAt: row.created_at,
      config: JSON.parse(row.config),
    }
  } catch {
    return null
  }
}

/**
 * 查询请求历史（按时间倒序）
 * @param keyword 搜索关键字（对 url 模糊匹配，空串查全部）
 * @param limit 条数上限，默认 50
 * @returns 历史项数组（最近在前）
 */
export async function listHistory(keyword = '', limit = 50): Promise<HistoryItem[]> {
  await ensureTables()
  const rows = keyword
    ? await dbQuery(
        `SELECT * FROM ${HISTORY_TABLE} WHERE url LIKE ? ORDER BY created_at DESC LIMIT ?`,
        [`%${keyword}%`, limit]
      )
    : await dbQuery(
        `SELECT * FROM ${HISTORY_TABLE} ORDER BY created_at DESC LIMIT ?`,
        [limit]
      )
  return (rows || []).map(parseHistoryRow).filter(Boolean) as HistoryItem[]
}

/**
 * 删除单条历史
 * @param id 历史 id
 */
export async function deleteHistory(id: number): Promise<void> {
  await ensureTables()
  await dbRun(`DELETE FROM ${HISTORY_TABLE} WHERE id = ?`, [id])
}

/**
 * 清空全部历史
 */
export async function clearHistory(): Promise<void> {
  await ensureTables()
  await dbRun(`DELETE FROM ${HISTORY_TABLE}`)
}

/* ------------------------------------------------------------------ */
/* 集合管理                                                            */
/* ------------------------------------------------------------------ */

/**
 * 解析集合表行 → CollectionNode（不含 children）
 * @param row 数据库原始行
 * @returns 集合节点
 */
function parseCollectionRow(row: any): CollectionNode {
  let config: RequestConfig | null = null
  try {
    config = row.config ? JSON.parse(row.config) : null
  } catch {
    config = null
  }
  return {
    id: row.id,
    parentId: row.parent_id || 0,
    nodeType: (row.node_type as CollectionNodeType) || 'request',
    name: row.name || '',
    method: row.method || 'GET',
    url: row.url || '',
    config,
    sort: row.sort || 0,
    updatedAt: row.updated_at || 0,
    children: [],
  }
}

/**
 * 查询全部集合并构建树（parent_id 关联，sort 升序）
 * @returns 根级节点数组（children 已挂载）
 */
export async function listCollectionTree(): Promise<CollectionNode[]> {
  await ensureTables()
  const rows = await dbQuery(
    `SELECT * FROM ${COLLECTION_TABLE} ORDER BY sort ASC, id ASC`
  )
  const nodes = (rows || []).map(parseCollectionRow)
  const nodeMap = new Map<number, CollectionNode>()
  nodes.forEach((n) => nodeMap.set(n.id, n))
  const roots: CollectionNode[] = []
  nodes.forEach((n) => {
    const parent = nodeMap.get(n.parentId)
    if (parent) {
      parent.children.push(n)
    } else {
      roots.push(n)
    }
  })
  return roots
}

/**
 * 插入集合节点（文件夹或请求）
 * @param node 节点数据（id 由自增主键生成，传入值忽略）
 * @returns 新节点的自增 id
 */
export async function insertCollectionNode(
  node: Omit<CollectionNode, 'id' | 'children' | 'updatedAt'>
): Promise<number> {
  await ensureTables()
  const res = await dbRun(
    `INSERT INTO ${COLLECTION_TABLE} (parent_id, node_type, name, method, url, config, sort, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      node.parentId,
      node.nodeType,
      node.name,
      node.method,
      node.url,
      node.config ? JSON.stringify(node.config) : null,
      node.sort,
      Date.now(),
    ]
  )
  return res.lastID
}

/**
 * 更新集合节点（名称 / 请求配置 / 父节点 / 排序）
 * @param id 节点 id
 * @param patch 待更新字段（仅支持 name/method/url/config/parentId/sort）
 */
export async function updateCollectionNode(
  id: number,
  patch: Partial<Pick<CollectionNode, 'name' | 'method' | 'url' | 'config' | 'parentId' | 'sort'>>
): Promise<void> {
  await ensureTables()
  const sets: string[] = ['updated_at = ?']
  const params: any[] = [Date.now()]
  if (patch.name !== undefined) {
    sets.push('name = ?')
    params.push(patch.name)
  }
  if (patch.method !== undefined) {
    sets.push('method = ?')
    params.push(patch.method)
  }
  if (patch.url !== undefined) {
    sets.push('url = ?')
    params.push(patch.url)
  }
  if (patch.config !== undefined) {
    sets.push('config = ?')
    params.push(patch.config ? JSON.stringify(patch.config) : null)
  }
  if (patch.parentId !== undefined) {
    sets.push('parent_id = ?')
    params.push(patch.parentId)
  }
  if (patch.sort !== undefined) {
    sets.push('sort = ?')
    params.push(patch.sort)
  }
  params.push(id)
  await dbRun(`UPDATE ${COLLECTION_TABLE} SET ${sets.join(', ')} WHERE id = ?`, params)
}

/**
 * 删除集合节点（文件夹会级联删除其全部子孙节点）
 * @param id 节点 id
 */
export async function deleteCollectionNode(id: number): Promise<void> {
  await ensureTables()
  // 递归收集全部子孙 id 后统一删除（SQLite 无递归 CTE 依赖，应用层遍历更稳）
  const rows = await dbQuery(`SELECT id, parent_id FROM ${COLLECTION_TABLE}`)
  const childrenMap = new Map<number, number[]>()
  ;(rows || []).forEach((r: any) => {
    const pid = r.parent_id || 0
    if (!childrenMap.has(pid)) childrenMap.set(pid, [])
    childrenMap.get(pid)!.push(r.id)
  })
  const ids: number[] = [id]
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    const children = childrenMap.get(cur) || []
    children.forEach((c) => {
      ids.push(c)
      stack.push(c)
    })
  }
  await dbRun(
    `DELETE FROM ${COLLECTION_TABLE} WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  )
}

/* ------------------------------------------------------------------ */
/* 环境变量                                                            */
/* ------------------------------------------------------------------ */

/**
 * 解析环境表行 → Environment
 * @param row 数据库原始行
 * @returns 环境对象
 */
function parseEnvRow(row: any): Environment {
  let vars: EnvVar[] = []
  try {
    vars = row.vars ? JSON.parse(row.vars) : []
  } catch {
    vars = []
  }
  return {
    id: row.id,
    name: row.name || '',
    vars,
    isActive: !!row.is_active,
    updatedAt: row.updated_at || 0,
  }
}

/**
 * 查询全部环境（激活环境排最前，其余按更新时间倒序）
 * @returns 环境数组
 */
export async function listEnvs(): Promise<Environment[]> {
  await ensureTables()
  const rows = await dbQuery(
    `SELECT * FROM ${ENV_TABLE} ORDER BY is_active DESC, updated_at DESC`
  )
  return (rows || []).map(parseEnvRow)
}

/**
 * 保存环境（存在 id 则更新，否则插入）
 * @param env 环境对象
 * @returns 环境的 id（新插入时为自增 id）
 */
export async function saveEnv(env: Environment): Promise<number> {
  await ensureTables()
  const varsJson = JSON.stringify(env.vars)
  const now = Date.now()
  if (env.id) {
    await dbRun(`UPDATE ${ENV_TABLE} SET name = ?, vars = ?, updated_at = ? WHERE id = ?`, [
      env.name,
      varsJson,
      now,
      env.id,
    ])
    return env.id
  }
  const res = await dbRun(
    `INSERT INTO ${ENV_TABLE} (name, vars, is_active, updated_at) VALUES (?, ?, ?, ?)`,
    [env.name, varsJson, 0, now]
  )
  return res.lastID
}

/**
 * 删除环境
 * @param id 环境 id
 */
export async function deleteEnv(id: number): Promise<void> {
  await ensureTables()
  await dbRun(`DELETE FROM ${ENV_TABLE} WHERE id = ?`, [id])
}

/**
 * 激活指定环境（同一时刻仅一个激活：先清空全部 is_active 再置位）
 * @param id 环境 id
 */
export async function activateEnv(id: number): Promise<void> {
  await ensureTables()
  await dbRun(`UPDATE ${ENV_TABLE} SET is_active = 0`)
  await dbRun(`UPDATE ${ENV_TABLE} SET is_active = 1 WHERE id = ?`, [id])
}
