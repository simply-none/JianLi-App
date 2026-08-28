import moment from 'moment'

/**
 * 把富文本 HTML 还原成纯文本，用于笔记摘要展示。
 * 只做标签剔除与常见实体还原，不追求完备——摘要只用于快速扫读。
 */
export function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // 截取片段时可能留下半截标签（如 `<div clas`），单独清掉
    .replace(/<[^>]*$/, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** 截断到指定长度，超出补省略号 */
export function truncate(text: string, max = 60): string {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 相对时间：今天显示时分，今年显示月日，更早显示年月日 */
export function formatTime(time?: string): string {
  if (!time) return ''
  const m = moment(time)
  if (!m.isValid()) return ''
  if (m.isSame(moment(), 'day')) return `今天 ${m.format('HH:mm')}`
  if (m.isSame(moment(), 'year')) return m.format('MM-DD HH:mm')
  return m.format('YYYY-MM-DD')
}
