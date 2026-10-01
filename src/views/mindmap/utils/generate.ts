/**
 * 思维导图 —— 从「待办 / 笔记 / 主题对话」一键生成导图。
 *
 * 设计立场：**只读**。这三张表分别属于别的模块，本文件只做 `SELECT`，
 * 一个字段都不写回 —— 生成出来的是一份**新的导图文档**（`id` 置空），
 * 用户在导图里怎么改都不会影响原来的待办 / 笔记 / 主题。
 * 这也让「一键生成」天然是安全的：不满意直接不保存就行。
 *
 * 三个源各自「本来就带层级」，所以映射几乎是直译：
 *
 *   待办      todo_list.parentIds（关联父任务 key 数组，可多父）→ 取第一个有效父
 *   笔记      note_book.mdText 的 `#` 标题 / 列表 → 复用 P1 的 markdownToTree
 *   主题对话  conversation_theme.parent_id（多级子主题）→ 直译；可选挂上 conversation 条目
 *
 * 四条一致性约定（与 OPML / FreeMind 导入保持一致，行为可预期）：
 *   1. 一律**套一个合成根**，根文本由用户在弹窗里给（默认见 GENERATE_SOURCES）；
 *      即使只有一个顶级节点也套 —— 否则「根节点名称」这个输入框会时灵时不灵。
 *   2. 语义上「说明性」的字段（待办描述 / 主题备注 / 对话正文）落到节点 `note`，
 *      不进节点文本 —— 它们不该参与布局（长文本会把节点撑歪）。
 *   3. 多父 / 断链一律**降级为根节点**，绝不为了「接上」而造环：
 *      树是唯一真源，出现环会让整棵子树从画布上消失，比少一层父关系糟糕得多。
 *   4. 节点 id 一律由 createNode 现场生成，**不沿用来源表的主键** ——
 *      避免「导图里的 id 与业务表 id 混为一谈」，将来导入别的格式也不会撞车。
 */

import moment from 'moment'
import { v4 as uuidv4 } from 'uuid'

import { noteTitle, stripHtml } from '@/utils/noteContent'
import { MAX_EXPORT_TODOS, MAX_NOTE_LEN } from '../constants'
import type { MindNode } from '../types'
import { markdownToTree } from './markdown'
import { createNode } from './tree'

/* ------------------------------------------------------------------ 类型 */

export type MindSourceKey = 'todo' | 'note' | 'theme'

/** 生成参数（三个开关各自服务一个数据源） */
export interface GenerateOptions {
  /** 合成根的文本 */
  rootText: string
  /** 待办：是否包含已完成 / 已取消 */
  includeCompleted: boolean
  /** 笔记：是否附带正文大纲 */
  includeOutline: boolean
  /** 主题对话：是否附带主题下的对话条目 */
  includeConversations: boolean
}

export type GenerateToggleKey = 'includeCompleted' | 'includeOutline' | 'includeConversations'

/** 数据源描述（弹窗据此渲染选项卡与开关，数据驱动，不写死 if-else） */
export interface GenerateSource {
  key: MindSourceKey
  label: string
  desc: string
  /** 合成根的默认名称 */
  defaultRoot: string
  toggle: { key: GenerateToggleKey; label: string; hint: string }
}

export const GENERATE_SOURCES: GenerateSource[] = [
  {
    key: 'todo',
    label: '待办事项',
    desc: '按父子任务关系展开',
    defaultRoot: '待办事项',
    toggle: { key: 'includeCompleted', label: '包含已完成 / 已取消', hint: '默认只取未完成项' },
  },
  {
    key: 'note',
    label: '笔记',
    desc: '每条笔记一个分支',
    defaultRoot: '我的笔记',
    toggle: { key: 'includeOutline', label: '附带正文大纲', hint: '按 Markdown 标题展开层级' },
  },
  {
    key: 'theme',
    label: '主题对话',
    desc: '按子主题层级展开',
    defaultRoot: '主题对话',
    toggle: { key: 'includeConversations', label: '附带对话条目', hint: '把每个主题下的对话挂上' },
  },
]

/** 各源的推荐默认参数 */
export function defaultOptions(key: MindSourceKey): GenerateOptions {
  return {
    rootText: GENERATE_SOURCES.find(item => item.key === key)?.defaultRoot ?? '导图',
    includeCompleted: false,
    includeOutline: true,
    includeConversations: false,
  }
}

/* ------------------------------------------------------------------ 小工具 */

/** 文本裁剪：压掉多余空白并限长（超长加省略号） */
function clip(text: string, max: number): string {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** 给节点挂备注（空串不挂，避免序列化出一堆无用字段） */
function attachNote(node: MindNode, note: string): void {
  const value = String(note ?? '').trim()
  if (value) node.note = value.slice(0, MAX_NOTE_LEN)
}

/**
 * 按「父 id」把节点接起来；接不上的（无父 / 父不存在 / 自环）一律降级为根。
 * 抽成一个函数是因为待办与主题对话的挂载逻辑完全同构。
 */
function linkByParent(entries: { id: string; node: MindNode; parentId?: string }[]): MindNode[] {
  const nodeById = new Map(entries.map(item => [item.id, item.node]))
  const roots: MindNode[] = []
  for (const item of entries) {
    const parentId = item.parentId
    const parent = parentId && parentId !== item.id ? nodeById.get(parentId) : undefined
    if (parent) parent.children.push(item.node)
    else roots.push(item.node)
  }
  return roots
}

/* ------------------------------------------------------------------ 待办 */

/** 从 new-sql 读出的待办行（只声明用得到的字段） */
export interface TodoSourceRow {
  key?: string
  title?: string
  description?: string
  completed?: number | string
  status?: string
  /** 新数据：JSON 数组字符串；旧数据：裸字符串 */
  parentIds?: string | string[] | null
  /** 更早的单父字段 */
  parentId?: string | null
  sortOrder?: number | string
}

/**
 * 解析父子关联。
 * ⚠️ 与 `views/todoList/api/todoApi.ts` 的 `parseParentIds` **必须保持一致**：
 *    那才是这个字段的权威读法；这里不 import 过去，是为了不让导图模块依赖待办模块
 *    （跨模块只走数据库，不走代码 —— 见模块文档的边界约定）。
 */
function parentIdsOf(row: TodoSourceRow): string[] {
  const raw = row.parentIds
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string')
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string')
      }
    } catch {
      /* 解析失败继续走旧字段 */
    }
  }
  if (typeof row.parentId === 'string' && row.parentId.trim()) return [row.parentId]
  return []
}

/** 待办行 → 树（多父任务挂在第一个有效父上，其余父关系丢弃） */
export function todosToTree(rows: TodoSourceRow[], options: GenerateOptions): MindNode {
  const kept = rows.filter((row) => {
    if (!row.key) return false
    if (options.includeCompleted) return true
    if (Number(row.completed) === 1) return false
    return row.status !== 'canceled'
  })

  // 同级顺序：先 sortOrder，再保持读库顺序（sortOrder 缺省都是 0，等于不排）
  const ordered = kept
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const delta = Number(a.row.sortOrder ?? 0) - Number(b.row.sortOrder ?? 0)
      return delta || a.index - b.index
    })
    .map(item => item.row)

  const entries = ordered.map((row) => {
    const node = createNode(row.title?.trim() || '未命名待办', [])
    attachNote(node, row.description ?? '')
    const parentId = parentIdsOf(row)[0]
    return { id: String(row.key), node, parentId }
  })

  return createNode(options.rootText.trim() || '待办事项', linkByParent(entries))
}

/* ------------------------------------------------------------------ 笔记 */

export interface NoteSourceRow {
  id?: number | string
  mdText?: string
  content?: string
  html?: string
  excerpt?: string
  tags?: string
}

/** 笔记行 → 树（每条笔记一个分支，可选把正文大纲挂进去） */
export function notesToTree(rows: NoteSourceRow[], options: GenerateOptions): MindNode {
  const children: MindNode[] = []

  for (const row of rows) {
    const markdown = String(row.mdText ?? '').trim()
    const rich = String(row.content ?? '').trim()
    // 一句话都没有的笔记没有信息量，跳过（免得导图里一排「无标题」）
    if (!markdown && !rich) continue

    const title = noteTitle(row)
    const node = createNode(title, [])
    if (options.includeOutline) appendOutline(node, markdown, title)
    // 正文摘要进备注：不参与布局，但选中节点时能在「节点属性」里看到内容
    attachNote(node, clip(rich ? stripHtml(rich) : markdown, 400))
    children.push(node)
  }

  return createNode(options.rootText.trim() || '我的笔记', children)
}

/**
 * 把笔记正文的 Markdown 大纲挂到节点下。
 * 若解析出来的根文本与笔记标题恰好相同（很常见：正文第一行就是 `# 标题`），
 * 就只取它的子节点，避免出现「标题 → 同名标题」的重复层。
 */
function appendOutline(node: MindNode, markdownText: string, title: string): void {
  if (!markdownText) return
  const outline = markdownToTree(markdownText, title)
  if (!outline) return
  if (outline.text.trim() === title.trim()) {
    node.children.push(...outline.children)
    return
  }
  node.children.push(outline)
}

/* -------------------------------------------------------------- 主题对话 */

export interface ThemeSourceRow {
  id?: number | string
  title?: string
  remark?: string
  /** '0' / 空串 / null = 顶级主题 */
  parent_id?: string | null
}

export interface ConversationSourceRow {
  id?: number | string
  theme_id?: number | string
  content?: string
  is_deleted?: string
}

/** 主题 + 对话 → 树 */
export function themesToTree(
  themes: ThemeSourceRow[],
  conversations: ConversationSourceRow[],
  options: GenerateOptions,
): MindNode {
  const entries = themes
    .filter(theme => theme.id !== undefined && theme.id !== null)
    .map((theme) => {
      const id = String(theme.id)
      const node = createNode(theme.title?.trim() || `主题 ${id}`, [])
      attachNote(node, theme.remark ?? '')
      const raw = String(theme.parent_id ?? '').trim()
      return { id, node, parentId: raw && raw !== '0' ? raw : undefined }
    })

  // 先把主题层级接好，再挂对话条目 —— 这样每个主题下**子主题在前、对话在后**
  const roots = linkByParent(entries)

  if (options.includeConversations) {
    const nodeById = new Map(entries.map(item => [item.id, item.node]))
    const grouped = new Map<string, ConversationSourceRow[]>()
    for (const item of conversations) {
      if (String(item.is_deleted ?? '') === '1') continue
      const themeId = String(item.theme_id ?? '')
      if (!themeId || !nodeById.has(themeId)) continue
      const list = grouped.get(themeId) ?? []
      list.push(item)
      grouped.set(themeId, list)
    }
    for (const [themeId, list] of grouped) {
      const parent = nodeById.get(themeId)
      if (!parent) continue
      for (const item of list) {
        const plain = stripHtml(String(item.content ?? ''))
        const node = createNode(clip(plain, 40) || `对话 ${String(item.id ?? '')}`, [])
        attachNote(node, plain)
        parent.children.push(node)
      }
    }
  }

  return createNode(options.rootText.trim() || '主题对话', roots)
}

/* ============================================================ 反向：导图 → 待办 */

/**
 * 一条待办写入载荷。
 *
 * ⚠️ 字段与 `views/todoList/types.ts` 的 `TodoItem` **一一对应**
 *    （读写都吃同一份表结构）。刻意不 import 那边的类型：
 *    跨模块只走数据库、不走代码 —— 与「一键生成导图」只读 SELECT 是同一条边界约定。
 */
export interface TodoWritePayload {
  key: string
  title: string
  description: string
  /** 标签 key 列表的 JSON 字符串（这里恒为空数组） */
  tags: string
  completed: number
  completedTime: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string
  status: string
  deadlineReminder: number
  remindCount: number
  remindInterval: number
  remindIntervalUnit: string
  createTime: string
  updateTime: string
  /**
   * 父任务 key 数组的 **JSON 字符串**（不是数组！）
   * —— `views/todoList/api/todoApi.ts` 的 `parseParentIds` 是这一字段的权威读法：
   *    它 `JSON.parse` 一个字符串，失败才退回旧的单值 `parentId`。
   *    写成真数组会让那边的解析走到 catch 分支，层级直接丢光。
   */
  parentIds: string
  sortOrder: number
  recurrenceRule: string | null
  recurrenceInterval: number
  recurrenceWeekdays: string | null
  recurrenceEnd: string | null
  recurrenceId: string | null
  isRecurrenceInstance: number
}

export interface TreeToTodosOptions {
  /** key 生成器（注入点，纯逻辑断言里传确定性实现） */
  makeKey?: () => string
  /** 时间戳文案（注入点，同上） */
  now?: string
  /** 最多生成多少条（默认 `MAX_EXPORT_TODOS`） */
  max?: number
  /** 生成待办的优先级（v1 统一给一个值，不做映射） */
  priority?: 'high' | 'medium' | 'low'
}

/**
 * 导图子树 → 待办数组（**纯函数，不碰 IPC**）。
 *
 * 映射规则：
 *   · 节点文本 → 待办标题；节点备注 → 待办描述；
 *   · 父子结构 → `parentIds`，且**指向本次新生成的父待办 key**，
 *     **绝不沿用导图节点 id**（与坑 32「不沿用来源表主键」是同一条红线的反向）。
 *     被导出的那棵子树的根 ⇒ `parentIds: '[]'`（是根任务，不挂在任何外来父下）。
 *   · 折叠态 / 三类颜色 / 图标 / 链接 / 手动坐标 **一律不映射** —— 待办表达不了，
 *     硬塞进去只会污染待办数据。
 *   · **空文本节点被跳过**，但它的子节点**不会跟着丢**：继续以「被跳过节点的父」为父
 *     往下走一层，宁可少一层层级，也不要静默吞掉一整支。
 *   · 超过 `max` 条直接截断（调用方在确认弹窗里已经告知了数量）。
 *
 * v1 **不做去重**：这是一次性导出，明确不同步、不记录映射关系。
 * 半截的同步语义（改了导图待办不跟着变）比「明确的一次性导出」更难解释。
 */
export function treeToTodos(root: MindNode, options: TreeToTodosOptions = {}): TodoWritePayload[] {
  const makeKey = options.makeKey ?? (() => uuidv4())
  const now = options.now ?? moment().format('YYYY-MM-DD HH:mm:ss')
  const max = options.max ?? MAX_EXPORT_TODOS
  const priority = options.priority ?? 'medium'

  const out: TodoWritePayload[] = []

  const make = (title: string, description: string, parentKey: string | null, sortOrder: number) => {
    out.push({
      key: makeKey(),
      title,
      description,
      tags: '[]',
      completed: 0,
      completedTime: '',
      priority,
      dueDate: '',
      status: 'not_started',
      deadlineReminder: 0,
      remindCount: 1,
      remindInterval: 30,
      remindIntervalUnit: 'minute',
      createTime: now,
      updateTime: now,
      parentIds: parentKey ? JSON.stringify([parentKey]) : '[]',
      sortOrder,
      recurrenceRule: null,
      recurrenceInterval: 1,
      recurrenceWeekdays: null,
      recurrenceEnd: null,
      recurrenceId: null,
      isRecurrenceInstance: 0,
    })
    return out[out.length - 1]
  }

  /**
   * 递归写入。`parentKey` 是**本次新建的父待办 key**（顶层为 null ⇒ 根任务）。
   * 空文本节点只跳过自己，后代继续挂到它的父下 —— 不吞子树。
   */
  const walk = (node: MindNode, parentKey: string | null, sortOrder: number): void => {
    if (out.length >= max) return
    const title = node.text.trim().slice(0, MAX_NOTE_LEN)
    if (!title) {
      node.children.forEach((child, index) => walk(child, parentKey, sortOrder + index))
      return
    }
    const created = make(title, node.note?.trim() ?? '', parentKey, sortOrder)
    node.children.forEach((child, index) => {
      if (out.length >= max) return
      walk(child, created.key, index)
    })
  }

  walk(root, null, 0)
  return out
}
