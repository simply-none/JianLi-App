// 功能化数据访问层：封装 clipboard:* IPC（后端基于 newSql.ts）。
// 渲染端统一经此模块访问数据库，不再使用旧的 query-data / delete-data 透传。
import type { ClipboardItem, ClipboardQueryParams } from '../types'

interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// 统一调用 preload 暴露的 ipcRenderer.handlePromise
function invoke<T = unknown>(channel: string, args: any = {}): Promise<IpcResult<T>> {
  return (window as any).ipcRenderer.handlePromise(channel, args)
}

export const clipboardApi = {
  // 查询（关键词 + 时间范围 + 分页）
  query(params: ClipboardQueryParams): Promise<IpcResult<ClipboardItem[]>> {
    return invoke<ClipboardItem[]>('clipboard:query', params)
  },
  // 单条删除（按 id）
  delete(id: number): Promise<IpcResult> {
    return invoke('clipboard:delete', { id })
  },
  // 批量删除（按 id 数组）
  deleteMany(ids: number[]): Promise<IpcResult> {
    return invoke('clipboard:delete-many', { ids })
  },
  // 清空全部
  clear(): Promise<IpcResult> {
    return invoke('clipboard:clear', {})
  },
  // 按时间范围删除（高级查询-删除场景）
  deleteByCondition(params: { startTime?: string; endTime?: string }): Promise<IpcResult> {
    return invoke('clipboard:delete-by-condition', params)
  },
  // 去重删除：相同 text 仅保留一条
  dedup(): Promise<IpcResult> {
    return invoke('clipboard:dedup', {})
  },
}
