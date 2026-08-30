import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { truncate } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'
import { listCountdowns } from '@/views/countdown/api/countdownApi'
import type { CountdownRow } from '@/views/countdown/types'

/**
 * 倒计时数据源（`>` 作用域）。
 * 与 habit 源一致：自己走 IPC 查库，不依赖命令面板所在渲染进程的 store。
 * 列出运行/暂停中的倒计时（按名称匹配），回车即跳转到倒计时主页；
 * 空关键词时额外提供一个「打开倒计时」入口。
 */
export const countdownSource: CommandSource = {
  id: 'countdown',
  label: '倒计时',
  async search(query) {
    const q = query.trim()
    let list: CountdownRow[] = []
    try {
      list = await listCountdowns()
    } catch {
      list = []
    }

    let active = list.filter((c) => c.status === 'running' || c.status === 'paused')
    if (q) {
      active = active.filter((c) => matchScore(q, c.name) > 0 || c.name.includes(q))
    }

    const scored = active.map((c) => ({
      c,
      score: q ? Math.max(matchScore(q, c.name), 1) : 1,
    }))

    const items: CommandItem[] = byScoreDesc(scored)
      .slice(0, q ? MAX_PER_SOURCE : DEFAULT_LIMIT)
      .map(({ c }) => buildItem(c))

    if (!q) {
      items.unshift(openPageItem())
    }
    return items
  },
}

function buildItem(row: CountdownRow): CommandItem {
  return {
    id: `countdown:${row.key}`,
    type: 'countdown',
    title: truncate(row.name, 40),
    subtitle:
      row.status === 'paused' ? '已暂停 · 回车打开倒计时页' : '进行中 · 回车打开倒计时页',
    icon: 'Timer',
    score: 0,
    run: ({ navigate }) => {
      navigate('countdown')
    },
  }
}

function openPageItem(): CommandItem {
  return {
    id: 'countdown:open',
    type: 'countdown',
    title: '打开倒计时',
    subtitle: '进入倒计时主页',
    icon: 'Timer',
    score: 0,
    run: ({ navigate }) => {
      navigate('countdown')
    },
  }
}
