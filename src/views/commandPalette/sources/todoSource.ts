import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { queryRows, likeParam } from '../utils/db'
import { getTableColumns, pickColumn } from '../utils/columns'
import { truncate, formatTime } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'

const TABLE = 'todo_list'

/** 必选列：待办列表页与待办小窗都在写，缺了就说明表还没建好 */
const REQUIRED_COLUMNS = ['key', 'title', 'description', 'completed', 'updateTime']
/** 可选列：早期版本可能没有，缺失时用 NULL 占位 */
const OPTIONAL_COLUMNS = ['priority', 'dueDate']

const PRIORITY_LABEL: Record<string, string> = {
  high: '高优先',
  medium: '中优先',
  low: '低优先',
}

interface TodoRow {
  key: string
  title: string
  description: string
  completed: number
  updateTime?: string
  priority?: string
  dueDate?: string
}

/** 探测表结构并拼出 SELECT 列表；必选列不全时返回 null */
async function resolveSelect(): Promise<string | null> {
  const columns = await getTableColumns(TABLE)
  const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name))
  if (missing.length) return null

  const optional = OPTIONAL_COLUMNS.map((name) =>
    columns.includes(name) ? name : `NULL AS ${name}`
  )
  return [...REQUIRED_COLUMNS, ...optional].join(', ')
}

function rowToItem(row: TodoRow, score: number): CommandItem {
  const priority = PRIORITY_LABEL[row.priority || ''] || ''
  const time = formatTime(row.updateTime)
  return {
    id: `todo:${row.key}`,
    type: 'todo',
    title: truncate(row.title, 40),
    subtitle: [row.completed === 1 ? '已完成' : priority, row.dueDate ? `截止 ${row.dueDate}` : '', time]
      .filter(Boolean)
      .join(' · '),
    icon: row.completed === 1 ? 'CircleCheck' : 'Circle',
    score,
    // TODO: 待办页暂不支持按 key 直接展开详情，先跳到列表页
    run: ({ hidePalette, navigate }) => {
      hidePalette()
      navigate('todoList')
    },
  }
}

export const todoSource: CommandSource = {
  id: 'todo',
  label: '待办',

  async search(query) {
    const select = await resolveSelect()
    if (!select) return []

    const q = query.trim()

    if (!q) {
      // 默认推荐：未完成的待办，高优先在前
      const rows = await queryRows<TodoRow>(
        `SELECT ${select} FROM ${TABLE}
         WHERE completed = 0
         ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, updateTime DESC
         LIMIT ?`,
        [DEFAULT_LIMIT]
      )
      return rows.map((row) => rowToItem(row, 1))
    }

    const like = likeParam(q)
    const rows = await queryRows<TodoRow>(
      `SELECT ${select} FROM ${TABLE}
       WHERE title LIKE ? ESCAPE '\\'
          OR description LIKE ? ESCAPE '\\'
       ORDER BY completed ASC, updateTime DESC
       LIMIT ?`,
      [like, like, MAX_PER_SOURCE * 3]
    )

    const scored: CommandItem[] = []
    rows.forEach((row) => {
      const score = Math.max(matchScore(q, row.title), matchScore(q, row.description) - 15)
      if (score <= 0) return
      scored.push(rowToItem(row, score))
    })

    return byScoreDesc(scored).slice(0, MAX_PER_SOURCE)
  },
}
