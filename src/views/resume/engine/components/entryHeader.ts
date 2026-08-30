/**
 * 排版引擎 - 条目头组件
 * ------------------------------------------------------------------
 * 渲染经历条目头：字段组（如 公司·职位）+ 日期（右端/跟随/隐藏）。
 * 字段样式以组件 textStyle 为底、fields 覆盖为辅。
 */

import { renderField, renderFieldGroup, textStyleToCss } from './text'
import type { EntryHeaderStyle, TextStyle } from '../types'

/**
 * 单个条目头字段描述
 */
export interface EntryFieldItem {
  /** 字段 id（对应 entryHeader.fieldOrder 与 fields 覆盖表） */
  id: string
  /** 字段文本内容 */
  content: string
}

/**
 * 解析字段最终样式（组件基础样式 + 字段覆盖合并）
 * @param base 组件基础样式
 * @param override 字段覆盖（可空）
 * @returns 合并后的样式
 */
export function resolveFieldStyle(base: TextStyle, override?: Partial<TextStyle> & { visible?: boolean }): TextStyle {
  return { ...base, ...(override || {}) }
}

/**
 * 渲染条目头行
 * @param fields 全部候选字段（按 id 索引）
 * @param eh 条目头配置
 * @param fieldsOverride 字段级覆盖表
 * @param baseFontSize 全局正文字号 pt
 * @returns HTML 片段（所有字段隐藏/为空返回空串）
 */
export function renderEntryHeader(
  fields: EntryFieldItem[],
  eh: EntryHeaderStyle,
  fieldsOverride: Record<string, Partial<TextStyle> & { visible?: boolean }> | undefined,
  baseFontSize: number
): string {
  // 按 fieldOrder 顺序取字段并渲染
  const spans: string[] = []
  for (const fid of eh.fieldOrder) {
    const item = fields.find((f) => f.id === fid)
    if (!item) continue
    const style = resolveFieldStyle(eh.textStyle, fieldsOverride?.[fid])
    spans.push(renderField(item.content, style, baseFontSize))
  }
  const headerHtml = renderFieldGroup(spans, eh.separator, baseFontSize)

  // 日期渲染
  const dateItem = fields.find((f) => f.id === 'date')
  const dateStyle = resolveFieldStyle(eh.dateStyle, fieldsOverride?.date)
  const dateHtml = dateItem ? renderField(dateItem.content, dateStyle, baseFontSize) : ''

  if (!headerHtml && !dateHtml) return ''
  if (eh.datePlacement === 'hide' || !dateHtml) return `<div>${headerHtml}</div>`

  const dateCss = textStyleToCss(dateStyle, baseFontSize)

  if (eh.datePlacement === 'inline') {
    // 日期跟随条目头之后
    return `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">${headerHtml}<span style="${dateCss}">${dateInner(dateHtml)}</span></div>`
  }
  // 默认：两端对齐，日期右端
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
    <div style="min-width:0">${headerHtml}</div>
    <div style="white-space:nowrap;flex-shrink:0">${dateInner(dateHtml)}</div>
  </div>`
}

/**
 * 提取日期 span 的内部文本（renderField 已生成带样式 span，此处复用其文本避免双层 span）
 * @param dateHtml 已渲染的日期字段 HTML
 * @returns 日期文本（HTML 转义后）
 */
function dateInner(dateHtml: string): string {
  const m = dateHtml.match(/>([^<]*)</)
  return m ? m[1] : ''
}
