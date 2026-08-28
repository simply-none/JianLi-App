/**
 * 命令面板的查询封装。
 *
 * 严格复用已有业务模块的查询通道，不再自创 SQL 通道：
 * - 笔记：复用「可归类的笔记」模块的 `query-data` 通道（conditions.SqlStr 直接塞 SQL），
 *         返回 result.data 即行数组。
 * - 待办：复用「待办」模块的 `new-sql:execute` 通道（sql + params + primaryKey），
 *         返回 result.data.rows。
 *
 * 单个数据源查询失败不应拖垮整个面板，所以失败时返回空数组并由调用方忽略。
 */

interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** 统一调用 preload 暴露的 ipcRenderer.handlePromise（与原功能写法一致） */
function invoke<T = unknown>(channel: string, args: any): Promise<IpcResult<T>> {
  return (window as any).ipcRenderer.handlePromise(channel, args)
}

/** 笔记查询：走 query-data 通道，sql 内已含 LIKE/ORDER/LIMIT，返回行数组 */
export async function queryNoteRows<T = Record<string, any>>(sql: string): Promise<T[]> {
  try {
    const result = await invoke<{ rows?: T[] } | T[]>('query-data', {
      tableName: 'note_book',
      conditions: { SqlStr: sql },
    })
    if (!result?.success) return []
    const data = (result as any).data
    return (Array.isArray(data) ? data : []) as T[]
  } catch (err) {
    console.error('[commandPalette] 笔记查询失败:', sql, err)
    return []
  }
}

/** 待办查询：走 new-sql:execute 通道，参数用 ? 占位（与 todoList 一致），返回 result.data.rows */
export async function queryTodoRows<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const result = await invoke<{ rows?: T[] }>('new-sql:execute', {
      sql,
      params,
      primaryKey: 'key',
    })
    if (!result?.success) return []
    const data = (result as any).data
    return (data?.rows || []) as T[]
  } catch (err) {
    console.error('[commandPalette] 待办查询失败:', sql, err)
    return []
  }
}
