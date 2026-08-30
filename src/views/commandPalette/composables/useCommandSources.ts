import type { CommandItem, CommandSource } from '../types'
import { routeSource } from '../sources/routeSource'
import { actionSource } from '../sources/actionSource'
import { noteSource } from '../sources/noteSource'
import { todoSource } from '../sources/todoSource'
import { habitSource } from '../sources/habitSource'
import { countdownSource } from '../sources/countdownSource'
import { MAX_TOTAL, SCOPE_PREFIX_MAP } from '../config/paletteConfig'

/**
 * 数据源注册表。
 * 新增一个可搜索的模块：写好 source 后在这里加一行即可，面板本体不用改。
 */
const REGISTRY: CommandSource[] = [routeSource, actionSource, noteSource, todoSource, habitSource, countdownSource]

export type SearchOptions = {
  /** 作用域前缀（'@' / '#' / '/' / '!'），为空表示搜索全部数据源 */
  scope?: string
  /** 请求序号，用于丢弃过期结果（异步返回顺序不保证） */
  token?: number
}

export function useCommandSources() {
  /** 最近一次请求的序号，只有序号匹配的返回值才会被采纳 */
  let latestToken = 0

  /** 按作用域过滤出本次要查询的数据源 */
  function pickSources(scope?: string): CommandSource[] {
    if (!scope) return REGISTRY
    const ids = SCOPE_PREFIX_MAP[scope]
    if (!ids || !ids.length) return REGISTRY
    return REGISTRY.filter((source) => ids.includes(source.id))
  }

  /**
   * 并发查询所有命中数据源。
   * 单个源抛错只会被忽略，不影响其它源的结果（Promise.allSettled）。
   */
  async function search(query: string, options: SearchOptions = {}): Promise<CommandItem[]> {
    const token = ++latestToken
    const sources = pickSources(options.scope)

    const settled = await Promise.allSettled(sources.map((source) => source.search(query)))

    // 查询期间又发起了新请求，丢弃本次结果
    if (token !== latestToken) return []

    const items: CommandItem[] = []
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        items.push(...result.value)
      } else {
        console.error(`[commandPalette] 数据源 ${sources[index].id} 查询失败:`, result.reason)
      }
    })

    // 分数降序；分数相同的保持注册表顺序（V8 的 sort 是稳定的）
    return items.sort((a, b) => b.score - a.score).slice(0, MAX_TOTAL)
  }

  return { search }
}
