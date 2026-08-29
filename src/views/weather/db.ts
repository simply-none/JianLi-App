/**
 * 天气模块 - 数据库访问层
 * ------------------------------------------------------------------
 * 复用主进程 newSql.ts 暴露的 new-sql:execute 通道，操作天气表 weather_data：
 *   - city       城市查询词（主键）
 *   - data       优化后的天气数据 JSON（WeatherData 全量）
 *   - updated_at 最近更新时间戳（ms，同时作为缓存时效与历史排序依据）
 *   - is_starred 是否星标（1=星标，0=普通）
 *
 * 天气数据一律以数据库为唯一本地存储：
 *   - 查询成功后写入入库（保留星标状态）
 *   - 展示前先读库判断缓存是否有效（updated_at 未过期直接用）
 *   - 历史记录 = 按 updated_at 倒序取最近 10 条
 *   - 星标列表 = is_starred = 1 的记录
 *
 * 注意（newSql.execute 的已知行为，均已在下方规避）：
 *   1. SELECT 结果在返回值的 data.rows 中，非 SELECT 只有 lastID/changes；
 *      且 isSelect 仅认 SELECT 开头 —— PRAGMA 会被当写语句执行导致拿不到结果，
 *      结构探测统一改用 `SELECT * FROM pragma_table_info(...)`（table-valued function）
 *   2. execute 会按默认 schema（id 主键 + TEXT 列）自动建表，
 *      因此本模块不重建表（SQLite 无法 ALTER 加主键），按项目惯例改为：
 *      id 主键 + city 唯一索引（CREATE UNIQUE INDEX）+ 缺列时 ALTER 补充
 */

import type { WeatherData } from './types'

/** 天气表名 */
const WEATHER_TABLE = 'weather_data'

/** 天气表行结构（数据库读取后的解析形态） */
export interface WeatherRow {
  /** 城市查询词 */
  city: string
  /** 天气数据 */
  data: WeatherData
  /** 最近更新时间戳（ms） */
  updatedAt: number
  /** 是否星标 */
  isStarred: boolean
}

/** IPC 句柄（与 themeConversation/db.ts 相同的访问方式） */
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
 * 确保天气表存在且结构可用（幂等，进程内首次调用时校验）
 * 遵循项目主键惯例（SQLite 无法 ALTER 加主键）：id 主键 + city 唯一索引
 * - 表不存在：显式建表（id 主键，与 newSql 默认结构一致，避免被再次劫持）
 * - 缺列：ALTER 补充
 * - city 无唯一索引：CREATE UNIQUE INDEX（保证同城市只有一行，支撑「先查后插/更」）
 * - 顺手清理历史版本遗留的 weather_data_new 迁移残留表
 */
async function ensureWeatherTable(): Promise<void> {
  if (tableReady) return

  // 1. 建表（id 主键 + 全部业务列，避免 execute 自动建表时列类型/缺失不一致）
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${WEATHER_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT,
      data TEXT,
      updated_at INTEGER,
      is_starred INTEGER DEFAULT 0
    )
  `)

  // 2. 结构探测（SELECT 开头才能拿到 rows）
  const cols: any[] = await dbQuery(
    `SELECT * FROM pragma_table_info('${WEATHER_TABLE}')`
  )
  const colNames = cols.map((c) => c.name)

  // 3. 缺列则补充
  if (!colNames.includes('city')) {
    await dbRun(`ALTER TABLE ${WEATHER_TABLE} ADD COLUMN city TEXT`)
  }
  if (!colNames.includes('data')) {
    await dbRun(`ALTER TABLE ${WEATHER_TABLE} ADD COLUMN data TEXT`)
  }
  if (!colNames.includes('updated_at')) {
    await dbRun(`ALTER TABLE ${WEATHER_TABLE} ADD COLUMN updated_at INTEGER`)
  }
  if (!colNames.includes('is_starred')) {
    await dbRun(`ALTER TABLE ${WEATHER_TABLE} ADD COLUMN is_starred INTEGER DEFAULT 0`)
  }

  // 4. city 唯一索引（同城市仅一行）
  await dbRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_data_city ON ${WEATHER_TABLE}(city)`
  )

  // 5. 清理旧迁移残留表
  await dbRun(`DROP TABLE IF EXISTS ${WEATHER_TABLE}_new`)

  tableReady = true
}

/**
 * 将数据库行解析为 WeatherRow
 * @param row 数据库原始行
 * @returns 解析后的行对象（data 解析失败返回 null）
 */
function parseRow(row: any): WeatherRow | null {
  try {
    return {
      city: row.city,
      data: JSON.parse(row.data) as WeatherData,
      updatedAt: row.updated_at,
      isStarred: !!row.is_starred,
    }
  } catch {
    return null
  }
}

/**
 * 保存天气数据到数据库（同城市覆盖更新，保留星标状态）
 * 采用「先查后插/更」而非 ON CONFLICT，兼容旧 SQLite 与被错误建的表
 * @param city 城市查询词
 * @param data 优化后的天气数据
 */
export async function saveWeatherToDb(city: string, data: WeatherData): Promise<void> {
  await ensureWeatherTable()
  const json = JSON.stringify(data)
  const now = Date.now()
  const exists = await dbQuery(`SELECT city FROM ${WEATHER_TABLE} WHERE city = ?`, [city])
  if (exists && exists.length > 0) {
    await dbRun(`UPDATE ${WEATHER_TABLE} SET data = ?, updated_at = ? WHERE city = ?`, [
      json,
      now,
      city,
    ])
  } else {
    await dbRun(
      `INSERT INTO ${WEATHER_TABLE} (city, data, updated_at) VALUES (?, ?, ?)`,
      [city, json, now]
    )
  }
}

/**
 * 读取城市天气行
 * @param city 城市查询词
 * @returns 命中返回行数据（含 data/updatedAt/isStarred），未命中返回 null
 */
export async function getWeatherRow(city: string): Promise<WeatherRow | null> {
  await ensureWeatherTable()
  const rows = await dbQuery(
    `SELECT city, data, updated_at, is_starred FROM ${WEATHER_TABLE} WHERE city = ?`,
    [city]
  )
  if (!rows || rows.length === 0) return null
  return parseRow(rows[0])
}

/**
 * 查询最近的城市历史（按更新时间倒序）
 * @param limit 条数上限，默认 10
 * @returns 城市查询词数组（最近查询在前）
 */
export async function listRecentWeatherCities(limit = 10): Promise<string[]> {
  await ensureWeatherTable()
  const rows = await dbQuery(
    `SELECT city FROM ${WEATHER_TABLE} ORDER BY updated_at DESC LIMIT ?`,
    [limit]
  )
  return (rows || []).map((r: any) => r.city)
}

/**
 * 查询星标城市列表
 * @returns 星标城市数组（按更新时间倒序）
 */
export async function listStarredCities(): Promise<string[]> {
  await ensureWeatherTable()
  const rows = await dbQuery(
    `SELECT city FROM ${WEATHER_TABLE} WHERE is_starred = 1 ORDER BY updated_at DESC`
  )
  return (rows || []).map((r: any) => r.city)
}

/**
 * 切换城市星标状态
 * @param city 城市查询词
 * @returns 切换后的星标状态（true=已星标）
 * @throws 城市无数据行时抛错（星标需先查询过该城市）
 */
export async function toggleStarInDb(city: string): Promise<boolean> {
  await ensureWeatherTable()
  const rows = await dbQuery(`SELECT is_starred FROM ${WEATHER_TABLE} WHERE city = ?`, [city])
  if (!rows || rows.length === 0) {
    throw new Error(`城市 ${city} 暂无天气数据，无法星标`)
  }
  const next = rows[0].is_starred ? 0 : 1
  await dbRun(`UPDATE ${WEATHER_TABLE} SET is_starred = ? WHERE city = ?`, [next, city])
  return !!next
}

/**
 * 删除城市的天气数据（历史列表中删除单条）
 * @param city 城市查询词
 */
export async function deleteWeatherRow(city: string): Promise<void> {
  await ensureWeatherTable()
  await dbRun(`DELETE FROM ${WEATHER_TABLE} WHERE city = ?`, [city])
}

/**
 * 清空历史数据（保留星标城市，星标数据不删除）
 */
export async function clearWeatherRows(): Promise<void> {
  await ensureWeatherTable()
  await dbRun(`DELETE FROM ${WEATHER_TABLE} WHERE is_starred = 0`)
}
