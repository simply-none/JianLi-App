/**
 * 笔记内容纯文本工具（功能化）
 *
 * 数据约定：
 * - 新笔记正文存于 `content`（HTML，来自富文本编辑器）
 * - 老笔记正文存于 `mdText`（纯文本 / Markdown，直接当文本处理，不转 HTML）
 *
 * 展示 / 搜索 / 摘要统一走纯文本，保证新老笔记行为一致。
 */

/** 去掉 HTML 标签与常见实体，得到可读纯文本 */
export function stripHtml(html: string): string {
  if (!html) return ''
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 笔记纯文本：优先 content(去标签)，否则 mdText 原样 */
export function notePlainText(note: Record<string, any> | null | undefined): string {
  if (!note) return ''
  if (note.content) return stripHtml(note.content)
  return note.mdText || ''
}

/** 笔记标题：取纯文本首行，去掉 # 号前缀 */
export function noteTitle(note: Record<string, any> | null | undefined): string {
  const text = notePlainText(note)
  if (!text) return '无标题'
  const lines = text
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean)
  const first = lines[0] || ''
  return first.replace(/^#+\s*/, '').substring(0, 50) || '无标题'
}

/** 笔记摘要：纯文本前 len 个字符 */
export function noteExcerpt(note: Record<string, any> | null | undefined, len = 30): string {
  const text = notePlainText(note)
  if (!text) return ''
  return text.length > len ? text.substring(0, len) + '...' : text
}
