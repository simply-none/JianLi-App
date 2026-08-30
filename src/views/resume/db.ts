/**
 * 简历模块 - 数据库访问层
 * ------------------------------------------------------------------
 * 经主进程 new-sql:execute 通道操作业务表 resume_data，支持多份简历管理：
 *   - resume_data：id 主键自增 + name 唯一索引 + template_id + data(JSON) + 时间戳
 *
 * 防坑策略（与 dataAcquisition/db.ts 相同，遵守 db-pitfalls）：
 *   1. SELECT 结果在返回值 data.rows 中；PRAGMA 用 pragma_table_info 探测
 *   2. 本模块显式 CREATE TABLE IF NOT EXISTS，避免 execute 自动建表劫持结构
 *   3. SQLite 无法 ALTER 加主键：id 自增主键 + name 唯一索引（CREATE UNIQUE INDEX）
 *   4. 缺列时 ALTER 补充；写失败向上抛错由调用方 ElMessage 提示
 */
import { deepClone } from '@/utils/deepClone'
import { DEFAULT_TEMPLATE_ID } from './templates'
import { mergeConfig } from './engine/defaultConfig'
import type { ResumeData, ResumeRecord, ResumeLayoutConfig, CustomSectionData } from './types'

/** 简历表名 */
const RESUME_TABLE = 'resume_data'
/** 排版配置表名（每份简历一份排版，resume_id 唯一） */
const LAYOUT_TABLE = 'resume_layout'
/** 排版预设表名（命名排版方案库，用于复用/切换展示效果） */
const PRESET_TABLE = 'resume_layout_preset'
/** 自定义模块结构模板表（保存行结构方案，供简历选择加载副本） */
const CUSTOM_TEMPLATE_TABLE = 'resume_custom_section'

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
 * 确保 resume_data 表存在且结构可用（幂等，进程内首次调用时校验）
 * - 表不存在：显式建表（id 自增主键 + 全部业务列）
 * - 缺列：ALTER 补充
 * - name 无唯一索引：CREATE UNIQUE INDEX（同名保存即更新）
 * @throws {Error} 建表/补列失败时抛出
 */
async function ensureResumeTable(): Promise<void> {
  if (tableReady) return

  // 1. 建表
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${RESUME_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      template_id TEXT,
      data TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `)

  // 2. 结构探测（SELECT 开头才能拿到 rows）
  const cols: any[] = await dbQuery(`SELECT * FROM pragma_table_info('${RESUME_TABLE}')`)
  const colNames = cols.map((c) => c.name)

  // 3. 缺列则补充
  if (!colNames.includes('name')) await dbRun(`ALTER TABLE ${RESUME_TABLE} ADD COLUMN name TEXT`)
  if (!colNames.includes('template_id')) await dbRun(`ALTER TABLE ${RESUME_TABLE} ADD COLUMN template_id TEXT`)
  if (!colNames.includes('data')) await dbRun(`ALTER TABLE ${RESUME_TABLE} ADD COLUMN data TEXT`)
  if (!colNames.includes('created_at')) await dbRun(`ALTER TABLE ${RESUME_TABLE} ADD COLUMN created_at INTEGER`)
  if (!colNames.includes('updated_at')) await dbRun(`ALTER TABLE ${RESUME_TABLE} ADD COLUMN updated_at INTEGER`)

  // 4. name 唯一索引（同名简历仅一份，保存即更新）
  await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS uq_resume_data_name ON ${RESUME_TABLE} (name)`)

  tableReady = true
}

/** 排版表结构校验完成的标记（进程内仅校验一次） */
let layoutTableReady = false

/**
 * 确保 resume_layout 排版表存在且结构可用（幂等，进程内首次调用时校验）
 * 结构：id 自增主键 + resume_id 唯一索引 + config(JSON) + updated_at
 * @throws {Error} 建表失败时抛出
 */
async function ensureLayoutTable(): Promise<void> {
  if (layoutTableReady) return

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${LAYOUT_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER,
      config TEXT,
      updated_at INTEGER
    )
  `)
  await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS uq_resume_layout_resume ON ${LAYOUT_TABLE} (resume_id)`)

  layoutTableReady = true
}

/**
 * 将数据库行解析为 ResumeRecord
 * @param row 数据库原始行
 * @returns 解析后的记录（data 解析失败返回 null）
 */
function parseRow(row: any): ResumeRecord | null {
  try {
    return {
      id: row.id,
      name: row.name,
      templateId: row.template_id || DEFAULT_TEMPLATE_ID,
      data: migrateCustomSections(JSON.parse(row.data || '{}')),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  } catch {
    return null
  }
}

/**
 * 自定义模块结构迁移：v1（kind=entry/text 固定字段）→ v2（行结构 rows）
 * 已是 v2（含 rows 数组）的原样返回；旧结构无损转换为等效行组合。
 * @param data 简历数据
 * @returns 迁移后的简历数据
 */
function migrateCustomSections(data: ResumeData): ResumeData {
  const sections = (data as any)?.customSections
  if (!Array.isArray(sections)) {
    return { ...data, customSections: [] }
  }
  const migrated: CustomSectionData[] = sections.map((sec: any) => {
    // 已是 v2 行结构
    if (sec && Array.isArray(sec.rows)) return sec as CustomSectionData
    // v1 文本型 → 单个整行段落块
    if (sec?.kind === 'text') {
      return {
        id: sec.id,
        title: sec.title || '自定义模块',
        rows: [
          {
            id: `${sec.id}-r1`,
            blocks: [{ id: `${sec.id}-b1`, type: 'textbox', span: 'full', text: sec.content || '' }],
          },
        ],
      }
    }
    // v1 条目型 → 每条目两行：条目头行（主字段/副字段/日期）+ 描述列表行
    const rows = (sec?.entries || []).flatMap((e: any, i: number) => {
      const headBlocks: any[] = []
      if (e?.field1) headBlocks.push({ id: `${sec.id}-r${i}-b1`, type: 'heading', span: 'left', text: e.field1 })
      if (e?.field2) headBlocks.push({ id: `${sec.id}-r${i}-b2`, type: 'text', span: 'left', text: e.field2 })
      const date = [e?.startTime, e?.endTime].filter((s: string) => s && String(s).trim()).join(' ~ ')
      if (date) headBlocks.push({ id: `${sec.id}-r${i}-b3`, type: 'text', span: 'right', text: date })
      const out: any[] = []
      if (headBlocks.length > 0) out.push({ id: `${sec.id}-r${i}-head`, blocks: headBlocks })
      if (e?.description) {
        out.push({
          id: `${sec.id}-r${i}-desc`,
          blocks: [{ id: `${sec.id}-r${i}-b4`, type: 'list', span: 'full', text: e.description }],
        })
      }
      return out
    })
    return { id: sec.id, title: sec.title || '自定义模块', rows }
  })
  return { ...data, customSections: migrated }
}

/**
 * 查询全部简历（按更新时间倒序）
 * @returns 简历记录列表
 */
export async function listResumes(): Promise<ResumeRecord[]> {
  await ensureResumeTable()
  const rows = await dbQuery(
    `SELECT id, name, template_id, data, created_at, updated_at FROM ${RESUME_TABLE} ORDER BY updated_at DESC`
  )
  return (rows || []).map(parseRow).filter(Boolean) as ResumeRecord[]
}

/**
 * 按 id 查询单份简历
 * @param id 记录 id
 * @returns 命中返回记录，未命中返回 null
 */
export async function getResumeById(id: number): Promise<ResumeRecord | null> {
  await ensureResumeTable()
  const rows = await dbQuery(
    `SELECT id, name, template_id, data, created_at, updated_at FROM ${RESUME_TABLE} WHERE id = ?`,
    [id]
  )
  return rows && rows.length > 0 ? parseRow(rows[0]) : null
}

/**
 * 新增简历（同名时抛错，由调用方提示改名）
 * @param name 简历名称
 * @param data 简历内容
 * @param templateId 模板 id，默认 compact
 * @returns 新记录 id
 * @throws {Error} 同名简历已存在时抛出
 */
export async function createResume(name: string, data: ResumeData, templateId = DEFAULT_TEMPLATE_ID): Promise<number> {
  await ensureResumeTable()
  const now = Date.now()
  const res = await dbRun(
    `INSERT INTO ${RESUME_TABLE} (name, template_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [name, templateId, JSON.stringify(cloneForIpc(data)), now, now]
  )
  return res.lastID
}

/**
 * 更新简历内容（按 id，可同时改名）
 * @param id 记录 id
 * @param data 简历内容
 * @param opts 可选项：name 新名称 / templateId 模板 id
 * @throws {Error} 更新失败时抛出
 */
export async function updateResume(
  id: number,
  data: ResumeData,
  opts: { name?: string; templateId?: string } = {}
): Promise<void> {
  await ensureResumeTable()
  const sets: string[] = ['data = ?', 'updated_at = ?']
  const params: any[] = [JSON.stringify(cloneForIpc(data)), Date.now()]
  if (opts.name !== undefined) {
    sets.push('name = ?')
    params.push(opts.name)
  }
  if (opts.templateId !== undefined) {
    sets.push('template_id = ?')
    params.push(opts.templateId)
  }
  params.push(id)
  await dbRun(`UPDATE ${RESUME_TABLE} SET ${sets.join(', ')} WHERE id = ?`, params)
}

/**
 * 删除简历
 * @param id 记录 id
 */
export async function deleteResume(id: number): Promise<void> {
  await ensureResumeTable()
  await dbRun(`DELETE FROM ${RESUME_TABLE} WHERE id = ?`, [id])
  // 联动清理该简历的排版配置
  await deleteLayout(id)
}

/**
 * 读取某份简历的排版配置（未配置或解析失败返回默认配置）
 * @param resumeId 简历 id
 * @returns 补全默认值后的完整排版配置
 */
export async function getLayoutByResumeId(resumeId: number): Promise<ResumeLayoutConfig> {
  await ensureLayoutTable()
  const rows = await dbQuery(`SELECT config FROM ${LAYOUT_TABLE} WHERE resume_id = ?`, [resumeId])
  let saved: any = null
  try {
    saved = rows && rows.length > 0 ? JSON.parse(rows[0].config || 'null') : null
  } catch {
    saved = null
  }
  return mergeConfig(saved)
}

/**
 * 保存某份简历的排版配置（覆盖式，每份简历仅一条）
 * @param resumeId 简历 id
 * @param config 排版配置
 */
export async function saveLayout(resumeId: number, config: ResumeLayoutConfig): Promise<void> {
  await ensureLayoutTable()
  const json = JSON.stringify(deepClone(config))
  const now = Date.now()
  const exists = await dbQuery(`SELECT id FROM ${LAYOUT_TABLE} WHERE resume_id = ?`, [resumeId])
  if (exists && exists.length > 0) {
    await dbRun(`UPDATE ${LAYOUT_TABLE} SET config = ?, updated_at = ? WHERE resume_id = ?`, [json, now, resumeId])
  } else {
    await dbRun(`INSERT INTO ${LAYOUT_TABLE} (resume_id, config, updated_at) VALUES (?, ?, ?)`, [resumeId, json, now])
  }
}

/**
 * 删除某份简历的排版配置（删简历时联动）
 * @param resumeId 简历 id
 */
export async function deleteLayout(resumeId: number): Promise<void> {
  await ensureLayoutTable()
  await dbRun(`DELETE FROM ${LAYOUT_TABLE} WHERE resume_id = ?`, [resumeId])
}

/** 排版预设记录（preset 表解析后的形态） */
export interface LayoutPresetRecord {
  /** 预设 id */
  id: number
  /** 预设名称（唯一） */
  name: string
  /** 排版配置 */
  config: ResumeLayoutConfig
  /** 更新时间戳（ms） */
  updatedAt: number
}

/** 预设表结构校验完成的标记（进程内仅校验一次） */
let presetTableReady = false

/**
 * 确保 resume_layout_preset 排版预设表存在且结构可用（幂等）
 * 结构：id 自增主键 + name 唯一索引 + config(JSON) + created_at + updated_at
 * @throws {Error} 建表失败时抛出
 */
async function ensurePresetTable(): Promise<void> {
  if (presetTableReady) return

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${PRESET_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      config TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `)
  await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS uq_resume_preset_name ON ${PRESET_TABLE} (name)`)

  presetTableReady = true
}

/**
 * 查询全部排版预设（按更新时间倒序）
 * @returns 预设列表（config 已过 mergeConfig 补全）
 */
export async function listLayoutPresets(): Promise<LayoutPresetRecord[]> {
  await ensurePresetTable()
  const rows = await dbQuery(
    `SELECT id, name, config, updated_at FROM ${PRESET_TABLE} ORDER BY updated_at DESC`
  )
  return (rows || []).map((row: any) => {
    let saved: any = null
    try {
      saved = JSON.parse(row.config || 'null')
    } catch {
      saved = null
    }
    return {
      id: row.id,
      name: row.name,
      config: mergeConfig(saved),
      updatedAt: row.updated_at,
    }
  })
}

/**
 * 按名称查询排版预设
 * @param name 预设名称
 * @returns 命中返回记录，未命中返回 null
 */
export async function getLayoutPresetByName(name: string): Promise<LayoutPresetRecord | null> {
  await ensurePresetTable()
  const rows = await dbQuery(
    `SELECT id, name, config, updated_at FROM ${PRESET_TABLE} WHERE name = ?`,
    [name]
  )
  if (!rows || rows.length === 0) return null
  const row = rows[0]
  let saved: any = null
  try {
    saved = JSON.parse(row.config || 'null')
  } catch {
    saved = null
  }
  return { id: row.id, name: row.name, config: mergeConfig(saved), updatedAt: row.updated_at }
}

/**
 * 保存排版预设（新增/编辑一体）
 * @param name 预设名称（同名时按 overwrite 决定覆盖或失败）
 * @param config 排版配置
 * @param opts.overwrite 是否允许覆盖同名（保存=允许即编辑语义；另存为=禁止即新增语义）
 * @returns { ok, created, message? } created=true 表示新增，false 表示覆盖更新
 */
export async function saveLayoutPreset(
  name: string,
  config: ResumeLayoutConfig,
  opts: { overwrite: boolean }
): Promise<{ ok: boolean; created: boolean; message?: string }> {
  await ensurePresetTable()
  const existing = await getLayoutPresetByName(name)
  const now = Date.now()
  const json = JSON.stringify(deepClone(config))

  if (existing) {
    if (!opts.overwrite) {
      return { ok: false, created: false, message: `已存在同名排版「${name}」` }
    }
    await dbRun(`UPDATE ${PRESET_TABLE} SET config = ?, updated_at = ? WHERE id = ?`, [json, now, existing.id])
    return { ok: true, created: false }
  }

  await dbRun(
    `INSERT INTO ${PRESET_TABLE} (name, config, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    [name, json, now, now]
  )
  return { ok: true, created: true }
}

/**
 * 删除排版预设
 * @param id 预设 id
 */
export async function deleteLayoutPreset(id: number): Promise<void> {
  await ensurePresetTable()
  await dbRun(`DELETE FROM ${PRESET_TABLE} WHERE id = ?`, [id])
}

/** 自定义模块结构模板记录（模板表解析后的形态） */
export interface CustomSectionTemplateRecord {
  /** 模板 id */
  id: number
  /** 模板名称（唯一） */
  name: string
  /** 模块结构（title + rows，加载时深拷贝为简历自己的数据副本） */
  structure: CustomSectionData
  /** 更新时间戳（ms） */
  updatedAt: number
}

/** 模板表结构校验完成的标记（进程内仅校验一次） */
let customTemplateTableReady = false

/**
 * 确保 resume_custom_section 模板表存在且结构可用（幂等）
 * 结构：id 自增主键 + name 唯一索引 + structure(JSON) + created_at + updated_at
 * @throws {Error} 建表失败时抛出
 */
async function ensureCustomTemplateTable(): Promise<void> {
  if (customTemplateTableReady) return

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ${CUSTOM_TEMPLATE_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      structure TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `)
  await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS uq_resume_custom_tpl_name ON ${CUSTOM_TEMPLATE_TABLE} (name)`)

  customTemplateTableReady = true
}

/**
 * 解析模板 structure 列（失败回退空行结构）
 * @param raw JSON 字符串
 * @param fallbackName 兜底标题
 * @returns 结构对象
 */
function parseCustomStructure(raw: string, fallbackName: string): CustomSectionData {
  try {
    const parsed = JSON.parse(raw || 'null')
    if (parsed && Array.isArray(parsed.rows)) return parsed as CustomSectionData
  } catch {
    /* 解析失败走兜底 */
  }
  return { id: '', title: fallbackName, rows: [] }
}

/**
 * 查询全部自定义模块模板（按更新时间倒序）
 * @returns 模板列表
 */
export async function listCustomSectionTemplates(): Promise<CustomSectionTemplateRecord[]> {
  await ensureCustomTemplateTable()
  const rows = await dbQuery(
    `SELECT id, name, structure, updated_at FROM ${CUSTOM_TEMPLATE_TABLE} ORDER BY updated_at DESC`
  )
  return (rows || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    structure: parseCustomStructure(row.structure, row.name),
    updatedAt: row.updated_at,
  }))
}

/**
 * 保存自定义模块结构模板（新增/编辑一体）
 * @param name 模板名称（同名按 overwrite 决定覆盖或失败）
 * @param structure 模块结构
 * @param opts.overwrite 是否允许覆盖同名
 * @returns { ok, created, message? }
 */
export async function saveCustomSectionTemplate(
  name: string,
  structure: CustomSectionData,
  opts: { overwrite: boolean }
): Promise<{ ok: boolean; created: boolean; message?: string }> {
  await ensureCustomTemplateTable()
  const rows = await dbQuery(`SELECT id FROM ${CUSTOM_TEMPLATE_TABLE} WHERE name = ?`, [name])
  const now = Date.now()
  const json = JSON.stringify(deepClone({ ...structure, title: structure.title || name }))

  if (rows && rows.length > 0) {
    if (!opts.overwrite) {
      return { ok: false, created: false, message: `已存在同名模板「${name}」` }
    }
    await dbRun(`UPDATE ${CUSTOM_TEMPLATE_TABLE} SET structure = ?, updated_at = ? WHERE id = ?`, [json, now, rows[0].id])
    return { ok: true, created: false }
  }

  await dbRun(
    `INSERT INTO ${CUSTOM_TEMPLATE_TABLE} (name, structure, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    [name, json, now, now]
  )
  return { ok: true, created: true }
}

/**
 * 删除自定义模块结构模板
 * @param id 模板 id
 */
export async function deleteCustomSectionTemplate(id: number): Promise<void> {
  await ensureCustomTemplateTable()
  await dbRun(`DELETE FROM ${CUSTOM_TEMPLATE_TABLE} WHERE id = ?`, [id])
}
