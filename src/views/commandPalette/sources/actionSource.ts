import { send, getWindowConfig } from '@/utils/common'
import useAppLock from '@/store/useAppLock'
import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { MAX_PER_SOURCE } from '../config/paletteConfig'

/**
 * 动作数据源：放「不能靠跳路由达成」的操作，主要是唤起各类小窗。
 * 小窗配置统一用 getWindowConfig 从 basic_info 读，避免在这里硬编码尺寸。
 */
interface ActionDef {
  id: string
  title: string
  subtitle: string
  icon: string
  run: (ctx: Parameters<CommandItem['run']>[0]) => void
}

const ACTIONS: ActionDef[] = [
  {
    id: 'action:quick-note',
    title: '快速记录',
    subtitle: '打开快速记录小窗写一条笔记',
    icon: 'PenLine',
    run: ({ hidePalette }) => {
      hidePalette()
      send('open-new-window', 'quickNote', getWindowConfig('quickNote'))
    },
  },
  {
    id: 'action:clipboard-window',
    title: '剪贴板快速粘贴',
    subtitle: '打开剪贴板历史面板',
    icon: 'Copy',
    run: ({ hidePalette }) => {
      hidePalette()
      send('open-new-window', 'clipboardMiniWindow', getWindowConfig('clipboardMiniWindow'))
    },
  },
  {
    id: 'action:todo-window',
    title: '待办小窗',
    subtitle: '打开常驻待办小窗',
    icon: 'CheckSquare',
    run: ({ hidePalette }) => {
      hidePalette()
      send('open-new-window', 'todoMiniWindow', getWindowConfig('todoMiniWindow'))
    },
  },
  {
    id: 'action:pomodoro-window',
    title: '番茄钟小窗',
    subtitle: '打开番茄钟小窗',
    icon: 'Timer',
    run: ({ hidePalette }) => {
      hidePalette()
      send('open-new-window', 'pomodoro', getWindowConfig('pomodoro'))
    },
  },
  {
    id: 'action:new-todo',
    title: '新建待办',
    subtitle: '跳转到待办事项页',
    icon: 'ListPlus',
    run: ({ hidePalette, navigate }) => {
      hidePalette()
      navigate('todoList')
    },
  },
  {
    id: 'action:new-note',
    title: '新建笔记',
    subtitle: '跳转到可归类的笔记',
    icon: 'FilePlus',
    run: ({ hidePalette, navigate }) => {
      hidePalette()
      navigate('categorizableNotes')
    },
  },
  {
    id: 'action:lock-app',
    title: '立即锁定',
    subtitle: '锁定应用（需已在设置中开启应用锁）',
    icon: 'LockKeyhole',
    run: ({ hidePalette }) => {
      hidePalette()
      useAppLock().lock()
    },
  },
]

export const actionSource: CommandSource = {
  id: 'action',
  label: '动作',

  async search(query) {
    const q = query.trim()
    // 空关键词时不展示动作，默认面板留给功能入口与最近笔记/待办
    if (!q) return []

    const scored: CommandItem[] = []
    ACTIONS.forEach((action) => {
      const score = Math.max(matchScore(q, action.title), matchScore(q, action.subtitle) - 15)
      if (score <= 0) return
      scored.push({
        id: action.id,
        type: 'action',
        title: action.title,
        subtitle: action.subtitle,
        icon: action.icon,
        score,
        run: action.run,
      })
    })

    return byScoreDesc(scored).slice(0, MAX_PER_SOURCE)
  },
}
