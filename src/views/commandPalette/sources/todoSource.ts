import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { queryTodoRows } from '../utils/db'
import { truncate, formatTime } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'
import { useTodoStore } from '@/store/useTodo'

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
  parentIds?: string
  recurrenceRule?: string
  recurrenceId?: string
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
    // 跳转到待办页并高亮定位到该条（由 useTodoStore.highlightKey 驱动滚动+闪烁）
    run: ({ hidePalette, navigate }) => {
      useTodoStore().highlightKey = row.key
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

    // 顶层任务为主：排除子任务（parentIds 非空）与重复模板（recurrenceId 为空但 recurrenceRule 非空）
    // 子任务/模板的排除放在客户端过滤，避免 parentIds 为 JSON 列导致 SQL 写法脆弱
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

    // 客户端排除子任务与重复模板
    const visible = rows.filter((r) => {
      if (r.recurrenceRule && !r.recurrenceId) return false // 重复模板
      if (r.parentIds) {
        try {
          const arr = JSON.parse(r.parentIds)
          if (Array.isArray(arr) && arr.length) return false // 子任务
        } catch { /* ignore */ }
      }
      return true
    })

    // SQL 已做 LIKE 匹配，这里只按相关度排序，不删除任何命中行
    const scored: CommandItem[] = visible.map((row) => {
      const score = q
        ? Math.max(matchScore(q, row.title), matchScore(q, row.description || '') - 15)
        : 1
      return rowToItem(row, score)
    })

    return byScoreDesc(scored).slice(0, MAX_PER_SOURCE)
  },
}
