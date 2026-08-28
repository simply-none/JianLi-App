import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { queryTodoRows } from '../utils/db'
import { truncate, formatTime } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'

const TABLE = 'todo_list'

const PRIORITY_LABEL: Record<string, string> = {
  high: '高优先',
  medium: '中优先',
  low: '低优先',
}

interface TodoRow {
  key: string
  title: string
  description?: string
  completed?: number
  updateTime?: string
  priority?: string
  dueDate?: string
}

function rowToItem(row: TodoRow, score: number): CommandItem {
  const priority = PRIORITY_LABEL[row.priority || ''] || ''
  const time = formatTime(row.updateTime)
  return {
    id: `todo:${row.key}`,
    type: 'todo',
    title: truncate(row.title, 40),
    subtitle: [
      row.completed === 1 ? '已完成' : priority,
      row.dueDate ? `截止 ${row.dueDate}` : '',
      time,
    ]
      .filter(Boolean)
      .join(' · '),
    icon: row.completed === 1 ? 'CircleCheck' : 'Circle',
    score,
    // 待办页暂不支持按 key 直接展开详情，先跳到列表页
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
    const q = query.trim()

    // 照搬「待办」模块的写法：new-sql:execute + ? 占位参数 + SELECT *
    const sql = q
      ? `SELECT * FROM ${TABLE}
         WHERE (title LIKE ? OR description LIKE ?)
         ORDER BY completed ASC, updateTime DESC
         LIMIT ?`
      : `SELECT * FROM ${TABLE}
         WHERE completed = 0
         ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, updateTime DESC
         LIMIT ?`
    const params = q
      ? [`%${q}%`, `%${q}%`, MAX_PER_SOURCE * 3]
      : [DEFAULT_LIMIT]

    const rows = await queryTodoRows<TodoRow>(sql, params)
    if (!rows.length) return []

    // SQL 已做 LIKE 匹配，这里只按相关度排序，不删除任何命中行
    const scored: CommandItem[] = rows.map((row) => {
      const score = q
        ? Math.max(matchScore(q, row.title), matchScore(q, row.description || '') - 15)
        : 1
      return rowToItem(row, score)
    })

    return byScoreDesc(scored).slice(0, MAX_PER_SOURCE)
  },
}
