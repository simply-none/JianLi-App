import { queryRows } from './db'

/**
 * 表结构探测。
 * note_book 这类表是写入时自动建列的（历史上先后用过 mdText / html / content 存正文），
 * 直接写死列名查询会因为列不存在而整体失败。这里先探测一次实际列，再据此拼 SQL。
 */

const columnCache = new Map<string, string[]>()

/** 获取表的列名列表（进程内缓存，表结构极少变动） */
export async function getTableColumns(tableName: string): Promise<string[]> {
  const cached = columnCache.get(tableName)
  if (cached) return cached

  const rows = await queryRows<{ name: string }>(`PRAGMA table_info(${tableName})`)
  const columns = rows.map((row) => row.name).filter(Boolean)
  // 探测失败（表不存在等）时缓存空数组，避免每次查询都重试
  columnCache.set(tableName, columns)
  return columns
}

/** 在候选列里挑出表中实际存在的第一个 */
export function pickColumn(columns: string[], candidates: string[]): string | null {
  return candidates.find((name) => columns.includes(name)) || null
}
