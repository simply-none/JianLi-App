/**
 * 命令面板的查询封装。
 *
 * 严格复用已有业务模块的查询通道，不再自创 SQL 通道：
 * - 笔记：走 newSql 数据层 `new-sql:query` 通道（顶层 SqlStr 传完整 SQL），
 *         返回 result.data 即行数组。
 * - 待办：走 `new-sql:read` 通道（仅 SELECT、参数化、只读连接、不建表），
 *         返回 result.data 行数组。❌ 不用 new-sql:execute（缺列时会自动 ALTER 污染表结构）。
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

/** 笔记查询：走 new-sql:query 通道（顶层 SqlStr），sql 内已含 LIKE/ORDER/LIMIT，返回行数组 */
export async function queryNoteRows<T = Record<string, any>>(sql: string): Promise<T[]> {
  try {
    const result = await invoke<{ rows?: T[] } | T[]>('new-sql:query', {
      tableName: 'note_book',
      SqlStr: sql,
    })
    if (!result?.success) return []
    const data = (result as any).data
    return (Array.isArray(data) ? data : []) as T[]
  } catch (err) {
    console.error('[commandPalette] 笔记查询失败:', sql, err)
    return []
  }
}

/** 待办查询：走 new-sql:read 通道（仅 SELECT、? 参数化、只读连接、不建表），返回 result.data 行数组 */
export async function queryTodoRows<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const result = await invoke<T[]>('new-sql:read', { sql, params });
    if (!result?.success) return []
    const data = (result as any).data
    return (Array.isArray(data) ? data : []) as T[]
  } catch (err) {
    console.error('[commandPalette] 待办查询失败:', sql, err)
    return []
  }
}

/**
 * 思维导图文档查询：与笔记同款 `new-sql:query` 通道（顶层 SqlStr）。
 *
 * ⚠️ 表可能**还不存在**（用户从没保存过导图）：这时主进程会返回 success:false 或抛错，
 *    两种情况都在这里收敛成空数组 —— 面板不该因为「一个还没用过的功能」而报错。
 */
export async function queryMindmapRows<T = Record<string, any>>(sql: string): Promise<T[]> {
  try {
    const result = await invoke<{ rows?: T[] } | T[]>('new-sql:query', {
      tableName: 'mindmap',
      SqlStr: sql,
    })
    if (!result?.success) return []
    const data = (result as any).data
    return (Array.isArray(data) ? data : []) as T[]
  } catch (err) {
    console.error('[commandPalette] 导图查询失败:', sql, err)
    return []
  }
}
