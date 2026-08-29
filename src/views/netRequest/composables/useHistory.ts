/**
 * 网络请求工作台 - 请求历史
 * ------------------------------------------------------------------
 * 维护历史列表的加载 / 搜索 / 删除 / 清空，数据走 db.ts。
 */

import { ref } from 'vue'
import type { HistoryItem, RequestConfig } from '../types'
import { addHistory, clearHistory, deleteHistory, listHistory } from '../db'

/** 历史列表（最近在前） */
const historyList = ref<HistoryItem[]>([])

/** 搜索关键字 */
const historyKeyword = ref('')

/**
 * 加载历史列表（按当前关键字搜索）
 */
export async function refreshHistory(): Promise<void> {
  historyList.value = await listHistory(historyKeyword.value.trim())
}

/**
 * 追加历史（发送请求后调用），随后刷新列表
 * @param config 完整请求配置
 * @param meta 响应元数据
 */
export async function pushHistory(
  config: RequestConfig,
  meta: { status: number; time: number; size: number }
): Promise<void> {
  try {
    await addHistory(config, meta)
    await refreshHistory()
  } catch (err) {
    // 写历史失败不影响请求本身，仅控制台可见
    console.error('写入请求历史失败：', err)
  }
}

/**
 * 删除单条历史并刷新
 * @param id 历史 id
 */
export async function removeHistory(id: number): Promise<void> {
  await deleteHistory(id)
  await refreshHistory()
}

/**
 * 清空全部历史并刷新
 */
export async function removeAllHistory(): Promise<void> {
  await clearHistory()
  await refreshHistory()
}

/**
 * 导出历史相关状态（供侧边栏组件使用）
 * @returns { historyList, historyKeyword }
 */
export function useHistoryState() {
  return { historyList, historyKeyword }
}
