/**
 * 星标城市组合式函数
 * 星标状态存储在数据库 weather_data 表的 is_starred 字段中（不使用 localStorage）；
 * 星标城市在搜索栏下方、搜索历史上方置顶展示
 */
import { ref } from 'vue'
import { listStarredCities, toggleStarInDb } from '../db'

/**
 * 创建星标城市控制器
 * @returns 星标列表与操作方法
 */
export function useStarredCities() {
  /** 星标城市列表（按更新时间倒序） */
  const starredList = ref<string[]>([])

  /**
   * 从数据库重新加载星标城市列表
   */
  async function reload() {
    try {
      starredList.value = await listStarredCities()
    } catch {
      starredList.value = []
    }
  }

  /**
   * 判断城市是否已星标
   * @param city 城市名
   * @returns 是否已星标
   */
  function isStarred(city: string): boolean {
    return starredList.value.includes(city)
  }

  /**
   * 切换城市星标状态（数据库 is_starred 字段取反后刷新列表）
   * @param city 城市名
   * @returns 切换是否成功（城市无数据行时失败）
   */
  async function toggle(city: string): Promise<boolean> {
    if (!city) return false
    try {
      await toggleStarInDb(city)
      await reload()
      return true
    } catch {
      return false
    }
  }

  return {
    /** 星标城市列表 */
    starredList,
    isStarred,
    toggle,
    /** 重新加载数据库星标列表 */
    reload,
  }
}
