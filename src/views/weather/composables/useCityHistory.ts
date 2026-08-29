/**
 * 城市搜索历史组合式函数
 * 历史记录以数据库 weather_data 表为唯一数据源：
 * 每次查询成功会更新该城市的 updated_at，历史列表即按 updated_at 倒序取最近 10 条
 */
import { ref } from 'vue'
import { HISTORY_LIMIT } from '../constants'
import {
  listRecentWeatherCities,
  deleteWeatherRow,
  clearWeatherRows,
} from '../db'

/**
 * 创建城市搜索历史控制器
 * @returns 历史列表与操作方法
 */
export function useCityHistory() {
  /** 历史城市列表（最近查询在前，最多 HISTORY_LIMIT 条） */
  const historyList = ref<string[]>([])

  /**
   * 从数据库重新加载历史记录（最近 10 条）
   */
  async function reload() {
    try {
      historyList.value = await listRecentWeatherCities(HISTORY_LIMIT)
    } catch {
      historyList.value = []
    }
  }

  /**
   * 记录一次查询城市（查询成功后调用；数据已入库，这里只需刷新列表）
   */
  async function add() {
    await reload()
  }

  /**
   * 删除单条历史记录（连同该城市的天气数据一并删除，星标城市同理）
   * @param city 城市名
   */
  async function remove(city: string) {
    try {
      await deleteWeatherRow(city)
    } finally {
      await reload()
    }
  }

  /**
   * 清空历史记录（星标城市保留）
   */
  async function clear() {
    try {
      await clearWeatherRows()
    } finally {
      await reload()
    }
  }

  return { historyList, reload, add, remove, clear }
}
