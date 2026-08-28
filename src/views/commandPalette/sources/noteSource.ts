import type { CommandItem, CommandSource } from '../types'
import { matchScore, byScoreDesc } from '../utils/score'
import { queryNoteRows } from '../utils/db'
import { stripHtml, truncate, formatTime } from '../utils/text'
import { DEFAULT_LIMIT, MAX_PER_SOURCE } from '../config/paletteConfig'

const TABLE = 'note_book'

/** 笔记行字段（note_book 表，列由表结构自动演进，读时按需取） */
interface NoteRow {
  key?: string
  excerpt?: string
  mdText?: string
  html?: string
  content?: string
  updateTime?: string
  createTime?: string
}

/** 把用户输入的半角单引号转义，避免破坏 LIKE 字符串（与原始模块一致的内插写法） */
function escapeLike(keyword: string): string {
  return keyword.replace(/'/g, "''")
}

/** 摘要：优先用编辑器写入的 excerpt，否则退回正文纯文本片段 */
function notePreview(row: NoteRow): string {
  return row.excerpt || stripHtml(row.html || row.content || row.mdText || '')
}

function rowToItem(row: NoteRow, score: number): CommandItem {
  const plain = notePreview(row)
  return {
    id: `note:${row.key}`,
    type: 'note',
    title: truncate(plain, 40) || '无标题笔记',
    subtitle: formatTime(row.updateTime || row.createTime),
    icon: 'FileText',
    score,
    // 可归类的笔记页暂不支持按 key 直接定位到具体一篇，先跳到列表页
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
    const q = query.trim()

    // 照搬「可归类的笔记」模块的 SQL 写法：SELECT * + 字符串插值 LIKE
    const sql = q
      ? `SELECT * FROM ${TABLE}
         WHERE (mdText LIKE '%${escapeLike(q)}%'
            OR content LIKE '%${escapeLike(q)}%'
            OR html LIKE '%${escapeLike(q)}%'
            OR excerpt LIKE '%${escapeLike(q)}%')
         ORDER BY updateTime DESC
         LIMIT ${MAX_PER_SOURCE * 3}`
      : `SELECT * FROM ${TABLE}
         ORDER BY updateTime DESC
         LIMIT ${DEFAULT_LIMIT}`

    const rows = await queryNoteRows<NoteRow>(sql)
    if (!rows.length) return []

    // SQL 已做 LIKE 匹配，这里只按相关度排序，不删除任何命中行
    const scored: CommandItem[] = rows.map((row) => {
      const plain = notePreview(row)
      const score = q ? Math.max(matchScore(q, plain), matchScore(q, row.excerpt || '')) : 1
      return rowToItem(row, score)
    })

    return byScoreDesc(scored).slice(0, MAX_PER_SOURCE)
  },
}
