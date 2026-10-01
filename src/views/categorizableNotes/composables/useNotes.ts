/**
 * 可归类笔记 —— 数据层 composable（功能化）
 *
 * 职责（仅数据，不含 UI）：
 * - note_book 表的查询 / 分页 / upsert / 删除（newSql 三件套，契约与旧版一致）
 * - 标签列表存取（basic_info store：'note_tags'）
 * - 标签计数统计（仅查 tags 列，客户端聚合，避免 GROUP BY 解析 JSON）
 * - 笔记行构建（excerpt / content / html / mdText / tags / 时间戳）
 *
 * 数据契约（保持不变）：
 * - 表 note_book：key / excerpt / content / html / mdText / tags(JSON字符串) / createTime / updateTime
 * - 标签存于 store 'note_tags'：{ key, name, color, deleted?, createTime, updateTime }
 * - 查询走 new-sql:query（顶层 SqlStr 传完整 SQL）；写入 new-sql:upsert（primaryKey:'key'）
 * - 搜索关键词已做单引号转义，防注入 / 语法错误
 */
import { computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import moment from 'moment'
import { getStore, setStoreAsync } from '@/utils/common'
import { useThemeMode } from '@/utils/themeMode'
import { stripHtml, notePlainText } from '@/utils/noteContent'

/** 笔记行（note_book 表） */
export interface NoteRow {
  key: string
  excerpt?: string
  content?: string
  html?: string
  mdText?: string
  tags?: string
  createTime?: string
  updateTime?: string
  [k: string]: any
}

/** 标签（store 'note_tags' 项） */
export interface NoteTag {
  key: string
  name: string
  color: string
  deleted?: boolean
  createTime?: string
  updateTime?: string
}

/** 新建标签的候选色板 */
export const TAG_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
]

/** 列表分页大小 */
export const PAGE_SIZE = 20

/** 右栏详情面板模式：未选中 / 查看 / 编辑 */
export type DetailMode = 'empty' | 'view' | 'edit'

/** 解析笔记 tags 字段（JSON 字符串 → key 数组），容错老数据 */
export function parseNoteTags(tags?: string): string[] {
  if (!tags) return []
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return [tags]
  }
}

/** 组装一条笔记的落库数据（纯新对象，可直接过 IPC，无 Vue Proxy） */
export function buildNoteRow(
  base: Partial<NoteRow>,
  content: string,
  html: string,
  tagKeys: string[]
): NoteRow {
  const now = moment().format('YYYY-MM-DD HH:mm:ss')
  return {
    ...base,
    key: base.key || uuidv4(),
    excerpt: (stripHtml(content) || '').substring(0, 30) + '...',
    content,
    html,
    mdText: content,
    tags: JSON.stringify(tagKeys),
    createTime: base.createTime || now,
    updateTime: now,
  }
}

/** 编辑器明暗档（复用全局 useThemeMode，替代旧版手维护的暗色主题名单） */
export function useEditorTheme() {
  const { mode } = useThemeMode()
  const editorTheme = computed(() => (mode.value === 'dark' ? 'dark' : 'light'))
  return { editorTheme }
}

/** 拼装列表查询 SQL（关键词 + 标签筛选 + 分页），与旧版语义一致 */
function buildListSql(keyword: string, tagKeys: string[], offset: number, limit: number): string {
  let sql = 'SELECT * FROM note_book'
  const conditions: string[] = []

  if (keyword) {
    // 用户自由输入的关键词：转义单引号，防止 SQL 注入 / 语法错误
    const safe = keyword.replace(/'/g, "''")
    conditions.push(
      `(mdText LIKE '%${safe}%' OR content LIKE '%${safe}%' OR html LIKE '%${safe}%' OR excerpt LIKE '%${safe}%')`
    )
  }
  if (tagKeys.length > 0) {
    // tags 列是 JSON 字符串，沿用旧版 LIKE 匹配（OR 语义：命中任一标签即返回）
    // 必须整体加括号：否则「关键词 AND tags-a OR tags-b」会因优先级把仅含 tags-b 的笔记也查出来
    const tagCond = tagKeys.map((key) => `tags LIKE '%${key}%'`).join(' OR ')
    conditions.push(`(${tagCond})`)
  }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ` ORDER BY updateTime DESC LIMIT ${limit} OFFSET ${offset}`
  return sql
}

/** 查询一页笔记（返回干净行数组；失败返回空数组） */
export async function fetchNotePage(
  keyword: string,
  tagKeys: string[],
  page: number
): Promise<{ list: NoteRow[]; hasMore: boolean }> {
  const sql = buildListSql(keyword.trim(), tagKeys, (page - 1) * PAGE_SIZE, PAGE_SIZE)
  try {
    const result = await window.ipcRenderer.handlePromise('new-sql:query', {
      tableName: 'note_book',
      SqlStr: sql,
    })
    if (!result?.success) return { list: [], hasMore: false }
    const data: NoteRow[] = result.data || []
    const clean = data.filter(
      (item) => item && typeof item === 'object' && !item.$el && !item.$options && !item._componentTag
    )
    return { list: clean, hasMore: clean.length >= PAGE_SIZE }
  } catch (err) {
    console.error('获取笔记失败:', err)
    return { list: [], hasMore: false }
  }
}

/** 标签计数 + 笔记总数（仅查 tags 列，客户端聚合） */
export async function fetchTagCounts(): Promise<{ counts: Record<string, number>; total: number }> {
  try {
    const result = await window.ipcRenderer.handlePromise('new-sql:query', {
      tableName: 'note_book',
      SqlStr: 'SELECT tags FROM note_book',
    })
    const rows: NoteRow[] = result?.success ? result.data || [] : []
    const counts: Record<string, number> = {}
    for (const row of rows) {
      for (const key of parseNoteTags(row.tags)) counts[key] = (counts[key] || 0) + 1
    }
    return { counts, total: rows.length }
  } catch (err) {
    console.error('统计标签计数失败:', err)
    return { counts: {}, total: 0 }
  }
}

/** upsert 一条笔记（主键冲突即更新） */
export async function upsertNote(noteData: NoteRow): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await window.ipcRenderer.handlePromise('new-sql:upsert', {
      tableName: 'note_book',
      data: noteData,
      config: { primaryKey: 'key' },
    })
    return result?.success
      ? { success: true }
      : { success: false, error: result?.error || '未知错误' }
  } catch (err) {
    console.error('保存笔记失败:', err)
    return { success: false, error: String(err) }
  }
}

/** 按key删除一条笔记 */
export async function deleteNote(key: string): Promise<boolean> {
  try {
    const result = await window.ipcRenderer.handlePromise('new-sql:delete', {
      tableName: 'note_book',
      condition: { key },
    })
    return !!result?.success
  } catch (err) {
    console.error('删除笔记失败:', err)
    return false
  }
}

/** 读取标签列表（store 'note_tags'） */
export function loadTags(): NoteTag[] {
  try {
    const tags = getStore('note_tags')
    return Array.isArray(tags) ? tags : []
  } catch (err) {
    console.error('获取标签失败:', err)
    return []
  }
}

/** 持久化标签列表 */
export async function saveTags(tags: NoteTag[]): Promise<boolean> {
  try {
    await setStoreAsync('note_tags', tags)
    return true
  } catch (err) {
    console.error('保存标签失败:', err)
    return false
  }
}

/** 创建一个新标签（同色板随机取名色；同名复用既有标签） */
export function createTagObject(name: string, existing: NoteTag[]): NoteTag {
  const trimmed = name.trim()
  const existed = existing.find((t) => t.name === trimmed)
  if (existed) return existed
  const now = moment().format('YYYY-MM-DD HH:mm:ss')
  return {
    key: uuidv4(),
    name: trimmed,
    color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
    createTime: now,
    updateTime: now,
  }
}

/** 笔记纯文本（列表摘要 / 搜索兜底用） */
export function noteText(note: NoteRow): string {
  return notePlainText(note) + (note.excerpt || '')
}
