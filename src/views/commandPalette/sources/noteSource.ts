import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { queryRows, likeParam } from '../utils/db'
import { getTableColumns, pickColumn } from '../utils/columns'
import { stripHtml, truncate, formatTime } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'

const TABLE = 'note_book'

/** 正文列候选：历史上先后用过 html / content / mdText，按优先级取实际存在的那个 */
const CONTENT_CANDIDATES = ['html', 'content', 'mdText']
/** 摘要列候选 */
const EXCERPT_CANDIDATES = ['excerpt', 'excerptText', 'summary']

/** 摘要取正文前 2000 字符即可，避免把整篇富文本拉进内存 */
const CONTENT_PREVIEW_LENGTH = 2000

interface NoteRow {
  key?: string
  excerpt?: string
  createTime?: string
  updateTime?: string
  /** 正文列，列名由探测结果决定 */
  content?: string
}

/** 探测表结构，返回可用的正文列 / 摘要列；取不到返回 null，由调用方降级 */
async function resolveColumns() {
  const columns = await getTableColumns(TABLE)
  if (!columns.length) return null
  return {
    content: pickColumn(columns, CONTENT_CANDIDATES),
    excerpt: pickColumn(columns, EXCERPT_CANDIDATES),
  }
}

function rowToItem(row: NoteRow, score: number): CommandItem {
  // 优先用编辑器写入的纯文本摘要，没有才退回正文片段
  const plain = row.excerpt || stripHtml(row.content || '')
  return {
    id: `note:${row.key}`,
    type: 'note',
    title: truncate(plain, 40) || '无标题笔记',
    subtitle: formatTime(row.updateTime || row.createTime),
    icon: 'FileText',
    score,
    // TODO: 可归类的笔记页暂不支持按 key 直接定位到具体一篇，先跳到列表页
    run: ({ hidePalette, navigate }) => {
      hidePalette()
      navigate('categorizableNotes')
    },
  }
}

export const noteSource: CommandSource = {
  id: 'note',
  label: '笔记',

  async search(query) {
    const resolved = await resolveColumns()
    if (!resolved) return []

    const q = query.trim()
    // 正文列取片段，摘要列取全量；两者都可能不存在，用 NULL 占位保持列顺序稳定
    const contentSelect = resolved.content
      ? `substr(${resolved.content}, 1, ${CONTENT_PREVIEW_LENGTH}) AS content`
      : 'NULL AS content'
    const excerptSelect = resolved.excerpt || 'NULL'
    const select = `key, ${excerptSelect} AS excerpt, ${contentSelect}, createTime, updateTime`

    if (!q) {
      // 默认推荐：最近更新的笔记
      const rows = await queryRows<NoteRow>(
        `SELECT ${select} FROM ${TABLE} ORDER BY updateTime DESC LIMIT ?`,
        [DEFAULT_LIMIT]
      )
      return rows.map((row) => rowToItem(row, 1))
    }

    const like = likeParam(q)
    // 只在实际存在的文本列上做匹配
    const matchColumns = [resolved.excerpt, resolved.content].filter(Boolean) as string[]
    if (!matchColumns.length) return []
    const where = matchColumns.map((col) => `${col} LIKE ? ESCAPE '\\'`).join(' OR ')

    const rows = await queryRows<NoteRow>(
      `SELECT ${select} FROM ${TABLE} WHERE ${where} ORDER BY updateTime DESC LIMIT ?`,
      [...matchColumns.map(() => like), MAX_PER_SOURCE * 3]
    )

    const scored: CommandItem[] = []
    rows.forEach((row) => {
      const plain = row.excerpt || stripHtml(row.content || '')
      const score = Math.max(matchScore(q, plain), matchScore(q, stripHtml(row.content || '')) - 10)
      if (score <= 0) return
      scored.push(rowToItem(row, score))
    })

    return byScoreDesc(scored).slice(0, MAX_PER_SOURCE)
  },
}
