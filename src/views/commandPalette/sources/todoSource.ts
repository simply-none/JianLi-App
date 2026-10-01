import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { queryTodoRows } from '../utils/db'
import { truncate, formatTime } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'
import { useTodoStore } from '@/store/useTodo'
import { normalize, saveTodo } from '@/views/todoList/api/todoApi'
import { v4 as uuidv4 } from 'uuid'
import moment from 'moment'

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

    // 无关键词：首位给「今日待办」快捷命令（D2），一键开启今日聚焦并跳转
    if (!q) {
      const rows = await searchTodos(q)
      return [
        {
          id: 'todo:today-focus',
          type: 'todo',
          title: '查看今日待办',
          subtitle: '今天到期 + 已逾期的未完成项',
          icon: 'Calendar',
          score: 999,
          run: ({ hidePalette, navigate }) => {
            useTodoStore().setTodayFocus(true)
            hidePalette()
            navigate('todoList')
          },
        },
        ...rows,
      ]
    }

    const rows = await searchTodos(q)
    if (!rows.length) return [buildQuickCreateItem(q)]
    return rows
  },
}

/** 查询并组装待办候选（排除子任务/模板的既有逻辑抽出复用） */
async function searchTodos(q: string): Promise<CommandItem[]> {
  // 顶层任务为主：排除子任务（parentIds 非空）、重复模板、回收站内条目（E5）
  // 子任务/模板的排除放在客户端过滤，避免 parentIds 为 JSON 列导致 SQL 写法脆弱
  const notDeleted = "AND (deleted IS NULL OR deleted = '' OR deleted = '0')"
  const sql = q
    ? `SELECT * FROM ${TABLE}
       WHERE (title LIKE ? OR description LIKE ?) ${notDeleted}
       ORDER BY completed ASC, updateTime DESC
       LIMIT ?`
    : `SELECT * FROM ${TABLE}
       WHERE completed = 0 ${notDeleted}
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
}

/** 快速新建（D3）：搜索无命中时给出「新建待办：<关键词>」，回车直接落库并跳转定位 */
function buildQuickCreateItem(title: string): CommandItem {
  return {
    id: 'todo:quick-create',
    type: 'todo',
    title: `新建待办：「${truncate(title, 24)}」`,
    subtitle: '回车创建并打开待办页',
    icon: 'Plus',
    score: 100,
    run: async ({ hidePalette, navigate }) => {
      const now = moment().format('YYYY-MM-DD HH:mm:ss')
      const todo = normalize({
        key: uuidv4(),
        title,
        description: '',
        tags: '[]',
        completed: 0,
        completedTime: '',
        priority: 'medium',
        dueDate: '',
        createTime: now,
        updateTime: now,
      })
      await saveTodo(todo)
      const store = useTodoStore()
      // 先刷新再定位：新条目尚未进入 store，直接设 highlightKey 会滚动不到
      await store.fetchTodos()
      store.highlightKey = todo.key
      hidePalette()
      navigate('todoList')
    },
  }
}
