/**
 * 自选股共享状态（模块级单例）
 *
 * 与「常用」不同：自选股是用户主动维护的标的集合，长期落库、可增删。
 * 这里把响应式 items 放在模块作用域，使「详情头部加入按钮」和「自选股 Tab」
 * 共享同一份数据，任一处增删都会即时联动（按钮状态 / 列表同步刷新）。
 *
 * 数据操作都以后端返回的全量列表为准，避免前端本地合并导致的顺序/一致性问题。
 */

import { ref } from 'vue'
import { getWatchlist, addToWatchlist as apiAdd, removeFromWatchlist as apiRemove } from './api'
import type { WatchlistItem, WatchlistInput } from './api'

/** 自选股列表（内存镜像，按后端返回顺序：新加入的在前） */
const items = ref<WatchlistItem[]>([])
/** 是否已从本地库加载过（避免重复拉取；也用于判断 has() 是否可信） */
const loaded = ref(false)
const loading = ref(false)

/** 从主进程读取全量自选股 */
async function load(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    items.value = await getWatchlist()
    loaded.value = true
  } catch (e) {
    console.error('加载自选股失败:', e)
  } finally {
    loading.value = false
  }
}

/** 判断某标的是否已加入自选（symbol 大小写不敏感） */
function has(symbol?: string): boolean {
  const s = (symbol || '').toUpperCase()
  if (!s) return false
  return items.value.some((i) => i.symbol.toUpperCase() === s)
}

/** 加入自选（可带名称/交易所/地区/类型），以后端全量为准刷新 */
async function add(item: WatchlistInput): Promise<void> {
  items.value = await apiAdd([item])
}

/** 移出自选（按 symbol），以后端全量为准刷新 */
async function remove(symbol: string): Promise<void> {
  items.value = await apiRemove([symbol])
}

export function useWatchlistStore() {
  return { items, loaded, loading, load, has, add, remove }
}
