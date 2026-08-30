/**
 * 数据获取模块 - 采集历史 composable
 * ------------------------------------------------------------------
 * 职责：历史列表查询/删除/清空（scraper_history 表），
 * 结果写入（任务完成后落库）、CSV / JSON 导出。
 */
import { ref } from 'vue'
import type { HistoryItem, ScrapeConfig, ScrapeTaskResult } from '../types'
import { addHistory, listHistory, deleteHistory, clearHistory } from '../db'

/**
 * 采集历史状态与操作
 * @returns 历史列表、查询/删除/清空/落库/导出方法
 */
export function useHistory() {
  /** 历史列表 */
  const history = ref<HistoryItem[]>([])
  /** 关键字过滤 */
  const keyword = ref('')

  /**
   * 刷新历史列表（按创建时间倒序）
   * @throws 写库失败时抛出（调用方提示）
   */
  async function refreshHistory(): Promise<void> {
    history.value = await listHistory(keyword.value || '')
  }

  /**
   * 任务结果落库（自动截断超大数据）并刷新列表
   * @param config 任务配置
   * @param result 任务结果
   * @throws 写库失败时抛出
   */
  async function recordResult(config: ScrapeConfig, result: ScrapeTaskResult): Promise<void> {
    await addHistory(config, result)
    await refreshHistory()
  }

  /**
   * 删除单条历史并刷新
   * @param id 历史 id
   * @throws 写库失败时抛出
   */
  async function removeHistory(id: number): Promise<void> {
    await deleteHistory(id)
    await refreshHistory()
  }

  /**
   * 清空全部历史并刷新
   * @throws 写库失败时抛出
   */
  async function removeAllHistory(): Promise<void> {
    await clearHistory()
    await refreshHistory()
  }

  return {
    history,
    keyword,
    refreshHistory,
    recordResult,
    removeHistory,
    removeAllHistory,
  }
}

/**
 * 记录数组转 CSV 文本（带 BOM，Excel 直开不乱码）
 * @param records 记录数组（取首条记录的键并集作为列，值统一 String 化）
 * @returns CSV 文本
 */
export function buildCsv(records: any[]): string {
  if (!records || !records.length) return ''
  const headers = Array.from(
    records.reduce((set: Set<string>, row: any) => {
      Object.keys(row || {}).forEach((k) => set.add(k))
      return set
    }, new Set<string>())
  )
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(';') : String(v)
    return `"${s.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of records) {
    lines.push(headers.map((h) => escape(row?.[h])).join(','))
  }
  return '\uFEFF' + lines.join('\r\n')
}

/**
 * 采集结果导出（CSV），经系统保存对话框写盘（复用 net-request:save-file 通用出口）
 * @param records 记录数组
 * @param name 导出文件名基础（不含扩展名）
 * @returns 成功返回保存路径，取消/失败返回 null
 */
export async function exportRecords(records: any[], name: string): Promise<string | null> {
  if (!records || !records.length) return null
  const ipc: any = (window as any).ipcRenderer
  const res = await ipc.handlePromise('net-request:save-file', {
    title: '导出采集结果',
    defaultName: `${name}.csv`,
    text: buildCsv(records),
  })
  return res?.path || null
}
