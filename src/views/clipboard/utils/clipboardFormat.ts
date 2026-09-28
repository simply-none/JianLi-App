// 剪贴板卡片展示层格式化工具：相对时间、字数统计、关键词高亮切分。
// 纯函数无副作用，供 ClipboardCard / ClipboardCardContent 复用，避免在每个卡片里重复计算。
import moment from 'moment'

// 关键词高亮片段：hit 为 true 的片段由渲染层加高亮底纹
export interface TextSegment {
  text: string
  hit: boolean
}

/** 预览截断长度：超出部分不参与渲染（卡片以折叠态展示，本就不可见） */
export const PREVIEW_CHAR_LIMIT = 20000

// 列表用的相对时间：今天显示时分秒，昨天/一周内显示粗粒度，更早显示完整日期
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

// 字数统计：忽略首尾空白，按字符数计。
// 对超长文本（历史数据出现过 7.3MB 单条）先截断再 count，避免每次渲染
// 都在整段字符串上跑 trim()；显示语义上「7万+字」与精确字数无差别。
export function countChars(text?: string): number {
  if (!text) return 0
  return text.length > PREVIEW_CHAR_LIMIT ? PREVIEW_CHAR_LIMIT : text.trim().length
}

// 按关键词把文本切成「命中/未命中」片段数组，大小写不敏感；关键词为空时返回整段。
//
// 性能红线（2026-09-28）：卡片折叠用的是 `max-height` + mask 裁剪，**DOM 节点仍然真实存在**。
// 若把整条文本（历史数据里出现过 7.3MB 单条）无条件铺成 <span> 列表，关键词搜索时会切出
// 上万个片段 ⇒ 上万 DOM 节点，渲染进程直接卡死（表现为鼠标拖影、页面无响应）。
// 这里加双保险：
//  - 文本超过 PREVIEW_CHAR_LIMIT 时只取前若干字符参与渲染，预览本就是折叠态；
//  - 片段数达到 MAX_SEGMENTS 时停止切分，剩余内容整段并入最后一片。
// 片段数封顶：防止密集命中关键词时把 DOM 撑爆
const MAX_SEGMENTS = 300

// 按关键词把文本切成「命中/未命中」片段数组，大小写不敏感；关键词为空时返回整段
export function splitByKeyword(text: string, keyword?: string): TextSegment[] {
  // 超长文本先截断：反正折叠后只看得到前几行，没必要为不可见内容付出渲染代价
  const src = text.length > PREVIEW_CHAR_LIMIT ? text.slice(0, PREVIEW_CHAR_LIMIT) : text

  const kw = (keyword ?? '').trim()
  if (!kw) return [{ text: src, hit: false }]

  const lowerText = src.toLowerCase()
  const lowerKw = kw.toLowerCase()
  const segments: TextSegment[] = []
  let cursor = 0

  while (cursor < src.length) {
    // 片段数封顶：防止密集命中关键词时把 DOM 撑爆
    if (segments.length >= MAX_SEGMENTS) break
    const idx = lowerText.indexOf(lowerKw, cursor)
    if (idx === -1) break
    if (idx > cursor) segments.push({ text: src.slice(cursor, idx), hit: false })
    segments.push({ text: src.slice(idx, idx + kw.length), hit: true })
    cursor = idx + kw.length
  }
  if (cursor < src.length) segments.push({ text: src.slice(cursor), hit: false })
  return segments
}
