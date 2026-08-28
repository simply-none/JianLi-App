// 剪贴板卡片展示层格式化工具：相对时间、字数统计、关键词高亮切分。
// 纯函数无副作用，供 ClipboardCard / ClipboardCardContent 复用，避免在每个卡片里重复计算。
import moment from 'moment'

// 关键词高亮片段：hit 为 true 的片段由渲染层加高亮底纹
export interface TextSegment {
  text: string
  hit: boolean
}

// 列表用的相对时间：今天显示时分秒，昨天/一周内显示粗粒度，更早显示完整日期
export function formatTime(time?: string): string {
  if (!time) return '--'
  const itemTime = moment(time)
  if (!itemTime.isValid()) return '--'
  const diffDays = moment().diff(itemTime, 'days')
  if (diffDays === 0) return itemTime.format('HH:mm:ss')
  if (diffDays === 1) return '昨天 ' + itemTime.format('HH:mm')
  if (diffDays < 7) return diffDays + '天前'
  return itemTime.format('YYYY-MM-DD HH:mm')
}

// 悬浮提示用的完整时间
export function formatFullTime(time?: string): string {
  if (!time) return '未知时间'
  const itemTime = moment(time)
  return itemTime.isValid() ? itemTime.format('YYYY-MM-DD HH:mm:ss') : '未知时间'
}

// 字数统计：忽略首尾空白，按字符数计
export function countChars(text?: string): number {
  return (text ?? '').trim().length
}

// 按关键词把文本切成「命中/未命中」片段数组，大小写不敏感；关键词为空时返回整段
export function splitByKeyword(text: string, keyword?: string): TextSegment[] {
  const kw = (keyword ?? '').trim()
  if (!kw) return [{ text, hit: false }]

  const lowerText = text.toLowerCase()
  const lowerKw = kw.toLowerCase()
  const segments: TextSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerKw, cursor)
    if (idx === -1) break
    if (idx > cursor) segments.push({ text: text.slice(cursor, idx), hit: false })
    segments.push({ text: text.slice(idx, idx + kw.length), hit: true })
    cursor = idx + kw.length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
  return segments
}
