/**
 * 命令面板的查询封装：统一走 `new-sql:execute`，只取 rows。
 * 单个数据源查询失败不应该拖垮整个面板，所以失败时返回空数组并由调用方忽略。
 */

interface ExecuteResult {
  success?: boolean
  data?: { rows?: Record<string, any>[] }
  error?: string
}

/** 执行只读 SQL，返回行数组；失败返回空数组 */
export async function queryRows<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const result = await window.ipcRenderer?.handlePromise<ExecuteResult>('new-sql:execute', { sql, params })
    if (!result?.success) return []
    return ((result.data?.rows || []) as unknown as T[])
  } catch (err) {
    console.error('[commandPalette] 查询失败:', sql, err)
    return []
  }
}

/** 构造 LIKE 参数：对 % _ \ 做转义，避免用户输入的通配符破坏查询 */
export function likeParam(keyword: string): string {
  const escaped = keyword.replace(/[\\%_]/g, (m) => `\\${m}`)
  return `%${escaped}%`
}
