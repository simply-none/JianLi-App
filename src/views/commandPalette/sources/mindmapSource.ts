/**
 * 命令面板 —— 思维导图数据源（P13「打开指定导图」）。
 *
 * 与其他数据源的差别只有一处：**这个动作必须把「打开哪一份」带到另一个窗口**。
 * 命令面板跑在独立小窗（`commandPalette/index.vue`），而导图页在主窗口 ——
 * 两边的 JS 运行时互不相通。所以这里走三段式：
 *
 *   ① `setStore(OPEN_DOC_STORE_KEY, id)` —— 写主进程 electron-store（两个窗口共享同一份）；
 *   ② `navigate('mindmap')` —— 复用既有 `palette-navigate` 链路，让主窗口切到导图页；
 *   ③ 导图页挂载时 `consumeOpen()` 取回 id 并 `openDoc`（见 `useMindView` / `useMindActions.bootstrap`）。
 *
 * 全程**零主进程改动**：`get-store` / `set-store` 与 `palette-navigate` 本来就有。
 *
 * 为什么不做「二级面板」：现面板的契约是「关键词 → 命中项 → 回车执行」（`CommandSource.search`），
 * 没有抽屉/下钻这一层。把每份导图直接作为一条可搜索结果，既达成同一个目的
 * （搜导图名 → 回车打开），也不需要为它单独扩出一套 UI 状态机。
 */

import type { CommandItem, CommandSource } from '../types'
import { setStore } from '@/utils/common'
import { OPEN_DOC_STORE_KEY } from '@/views/mindmap/constants'
import { matchScore, byScoreDesc } from '../utils/score'
import { formatTime } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'
import { queryMindmapRows } from '../utils/db'

const TABLE = 'mindmap'

/** mindmap 表里与本功能相关的列（其余列如 data 太大，不查） */
interface MindmapRow {
  id?: number
  name?: string
  type?: string
  create_time?: string
  update_time?: string
}

/** 把用户输入的半角单引号转义，避免破坏 LIKE 字符串（与 noteSource 同一写法） */
function escapeLike(keyword: string): string {
  return keyword.replace(/'/g, "''")
}

function rowToItem(row: MindmapRow, score: number): CommandItem | undefined {
  const id = typeof row.id === 'number' ? row.id : Number(row.id)
  if (!Number.isFinite(id) || id <= 0) return undefined
  return {
    id: `mindmap:${id}`,
    type: 'mindmap',
    title: row.name || '未命名导图',
    subtitle: `导图 · ${formatTime(row.update_time || row.create_time)}`,
    icon: 'Network',
    score,
    run: ({ hidePalette, navigate }) => {
      hidePalette()
      // ①②：先把 id 交给主进程 store，再让主窗口切路由。
      // setStore 是 sendSync，返回时值已落盘 —— 不会出现「路由先到、id 还没写好」的竞态。
      setStore(OPEN_DOC_STORE_KEY, String(id))
      navigate('mindmap')
    },
  }
}

export const mindmapSource: CommandSource = {
  id: 'mindmap',
  label: '导图',

  async search(query) {
    const q = query.trim()

    // 只取 name 匹配（导图没有正文可搜）；`type` 过滤把「万一表里混进别的东西」挡在外面
    const sql = q
      ? `SELECT id, name, create_time, update_time FROM ${TABLE}
         WHERE type = 'mindmap' AND name LIKE '%${escapeLike(q)}%'
         ORDER BY update_time DESC
         LIMIT ${MAX_PER_SOURCE * 3}`
      : `SELECT id, name, create_time, update_time FROM ${TABLE}
         WHERE type = 'mindmap'
         ORDER BY update_time DESC
         LIMIT ${DEFAULT_LIMIT}`

    const rows = await queryMindmapRows<MindmapRow>(sql)
    if (!rows.length) return []

    // SQL 已用 LIKE 匹配过，这里只做相关度排序；命中即给底分 1，保证「匹配到了就一定显示」
    const scored = rows
      .map((row) => {
        const item = rowToItem(row, q ? Math.max(matchScore(q, row.name || ''), 1) : 1)
        return item
      })
      .filter((item): item is CommandItem => Boolean(item))

    return byScoreDesc(scored).slice(0, MAX_PER_SOURCE)
  },
}
