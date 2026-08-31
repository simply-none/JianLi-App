/**
 * 排版引擎 - 文本原子渲染
 * ------------------------------------------------------------------
 * TextStyle → 内联 CSS 的转换与多字段拼接（含分隔符），
 * 全部输出内联样式，保证 printToPDF 与预览完全一致。
 */

import { resolveFontSize, resolveInkColor } from '../tokens'
import type { SeparatorStyle, TextStyle } from '../types'

/** HTML 特殊字符转义 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 当前渲染的中西文间距（px，正=边界撑开，负=边界收紧），由 renderResume 每次渲染前注入 */
let cjkGapPx = 0

/** 汉字区段（CJK 统一表意文字及扩展 A / 兼容区） */
const CJK_RANGE = '\\u4e00-\\u9fff\\u3400-\\u4dbf\\uf900-\\ufaff'

/**
 * 中西文边界零宽断言（四种位置，零宽断言可正确处理连写多边界）：
 *   1. 汉字|字母数字 直接相邻
 *   2. 字母数字|汉字 直接相邻
 *   3. 汉字|空格|字母数字（间隔节点插在汉字与空格之间）
 *   4. 字母数字|空格|汉字（间隔节点插在空格与汉字之间）
 * 实际简历文本中英文间通常已手敲空格（如「前 10%」），必须覆盖带空格的边界才有实际效果；
 * 空格宽度由字体决定无法用固定 px 替代，故不消费空格、只在边界位置插入间隔节点。
 */
const CJK_GAP_RE = new RegExp(
  `(?<=[${CJK_RANGE}])(?=[A-Za-z0-9])|` +
    `(?<=[A-Za-z0-9])(?=[${CJK_RANGE}])|` +
    `(?<=[${CJK_RANGE}])(?=[ \\u3000][A-Za-z0-9])|` +
    `(?<=[A-Za-z0-9][ \\u3000])(?=[${CJK_RANGE}])`,
  'g'
)

/**
 * 注入本次渲染的中西文间距（renderResume 入口统一调用）
 * @param px 间距像素（0 = 关闭，不插入任何间隔节点）
 */
export function setCjkGap(px: number): void {
  cjkGapPx = Number(px) || 0
}

/**
 * 构建中西文边界间隔节点：
 * 正间距用宽度撑开；负间距用负外边距收紧（inline-block 不支持负宽度）
 * @returns 间隔 span 的 HTML
 */
function buildGapSpacer(): string {
  return `<span style="display:inline-block;width:${Math.max(0, cjkGapPx)}px;margin-left:${Math.min(0, cjkGapPx)}px"></span>`
}

/**
 * 在已转义文本的中西文边界插入间隔节点（不做转义，调用方需保证文本已经 esc）
 * @param escaped 已转义文本
 * @returns 插入边界间隔后的 HTML 文本（间距为 0 时原样返回）
 */
export function insertCjkGaps(escaped: string): string {
  if (cjkGapPx === 0) return escaped
  return escaped.replace(CJK_GAP_RE, buildGapSpacer())
}

/**
 * 渲染可见内容文本：转义 + 中西文边界间距处理（引擎各模块内容文本的统一出口）
 * @param raw 原始文本
 * @returns 可直接嵌入 HTML 的文本
 */
export function renderContent(raw: unknown): string {
  return insertCjkGaps(esc(raw))
}

/**
 * TextStyle 转内联 style 字符串
 * 注意：字间距统一由页面全局 letterSpacing 控制（body 继承），元素级不再输出，
 * 保证整张简历字间距一致。
 * @param t 文本样式
 * @param baseFontSize 全局正文字号 pt
 * @returns style 属性值（不含 style="）
 */
export function textStyleToCss(t: TextStyle, baseFontSize: number): string {
  return [
    `font-size:${resolveFontSize(t.size, baseFontSize)}pt`,
    `font-weight:${t.weight}`,
    `color:${resolveInkColor(t.ink)}`,
    t.italic ? 'font-style:italic' : '',
  ]
    .filter(Boolean)
    .join(';')
}

/**
 * 渲染一个原子字段 span（含显隐判断）
 * @param content 文本内容
 * @param style 字段样式
 * @param baseFontSize 全局正文字号
 * @returns HTML 片段（内容为空或字段隐藏返回空串）
 */
export function renderField(content: string, style: TextStyle, baseFontSize: number): string {
  if (!style.visible) return ''
  const text = String(content ?? '').trim()
  if (!text) return ''
  return `<span style="${textStyleToCss(style, baseFontSize)}">${renderContent(text)}</span>`
}

/**
 * 渲染分隔符 span
 * @param sep 分隔符样式
 * @param baseFontSize 全局正文字号
 * @returns HTML 片段
 */
export function renderSeparator(sep: SeparatorStyle, baseFontSize: number): string {
  if (sep.type === 'none') return `<span style="display:inline-block;width:${sep.gap}px"></span>`
  const glyphs: Record<string, string> = { space: '', dot: '·', bar: '|', slash: '/' }
  const glyph = glyphs[sep.type] || ''
  const half = sep.gap
  return `<span style="display:inline-block;padding:0 ${half}px;color:${resolveInkColor(sep.ink)};font-size:${baseFontSize}pt">${esc(glyph)}</span>`
}

/**
 * 渲染「字段组」：按顺序拼接多个可见字段，字段间插入分隔符
 * @param fields 字段列表（已渲染好的 span HTML，空串自动跳过）
 * @param sep 分隔符样式
 * @param baseFontSize 全局正文字号
 * @returns HTML 片段
 */
export function renderFieldGroup(spans: string[], sep: SeparatorStyle, baseFontSize: number): string {
  const visible = spans.filter(Boolean)
  if (visible.length === 0) return ''
  if (visible.length === 1) return visible[0]
  const parts: string[] = []
  visible.forEach((s, i) => {
    parts.push(s)
    if (i < visible.length - 1) parts.push(renderSeparator(sep, baseFontSize))
  })
  return parts.join('')
}
