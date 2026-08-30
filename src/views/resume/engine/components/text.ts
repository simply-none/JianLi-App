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
  return `<span style="${textStyleToCss(style, baseFontSize)}">${esc(text)}</span>`
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
