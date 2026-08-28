import { layoutRouters } from '@/router'
import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { DEFAULT_LIMIT, MAX_PER_SOURCE, PREFERRED_ROUTES } from '../config/paletteConfig'

/**
 * 功能入口数据源：直接由 layoutRouters 派生，不手写清单，
 * 以后新增任何布局内页面都会自动进命令面板。
 *
 * 隐藏的页面：被新模块取代的旧入口，避免用户同时搜到两个名字。
 */
const HIDDEN_ROUTE_NAMES = new Set(['notebookApp'])

export const routeSource: CommandSource = {
  id: 'route',
  label: '功能',

  async search(query) {
    const scored: CommandItem[] = []

    layoutRouters
      .filter((route) => !HIDDEN_ROUTE_NAMES.has(String(route.name ?? '')))
      .forEach((route) => {
      const name = String(route.name ?? '')
      const title = (route.meta?.title as string) || name
      // 标题命中为主，路由名（英文）命中为辅，取两者较高分
      const score = Math.max(matchScore(query, title), matchScore(query, name) - 10)
      if (score <= 0) return

      scored.push({
        id: `route:${name}`,
        type: 'route',
        title,
        subtitle: query ? '' : '打开页面',
        icon: 'LayoutGrid',
        score,
        run: ({ hidePalette, navigate }) => {
          hidePalette()
          navigate(name)
        },
      })
    })

    // 空关键词 = 默认推荐：取优先顺序里的常用页，再补上其余页面
    if (!query.trim()) {
      const rank = (name: string) => {
        const idx = PREFERRED_ROUTES.indexOf(name)
        return idx === -1 ? PREFERRED_ROUTES.length : idx
      }
      return scored.sort((a, b) => rank(a.id.slice(6)) - rank(b.id.slice(6))).slice(0, DEFAULT_LIMIT)
    }

    return byScoreDesc(scored).slice(0, MAX_PER_SOURCE)
  },
}
