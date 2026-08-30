/**
 * 排版引擎 - 自定义模块（行结构）渲染
 * ------------------------------------------------------------------
 * 行级自由组合模型：
 *   - 一行可含多个 heading/text 块，按 span（left/center/right）分组并排，
 *     多组时 space-between 三区布局，单组按对齐
 *   - list（列表）/ textbox（多行段落）独占整行
 * 样式来自 ModuleStyle.customRows（heading/text/textbox TextStyle + list ListStyle）。
 */

import type { PageStyle, SectionRow, SectionRowBlock } from '../../types'
import type { CustomRowsStyle, ModuleStyle } from '../types'
import { esc, textStyleToCss } from '../components/text'
import { renderSectionTitle } from '../components/sectionTitle'
import { renderBulletList } from '../components/bulletList'

/** 判断块是否独占整行（列表/文本块，或显式 span=full） */
function isFullBlock(b: SectionRowBlock): boolean {
  return b.type === 'list' || b.type === 'textbox' || b.span === 'full'
}

/**
 * 渲染行内 inline 块（heading/text）
 * @param b 内容块
 * @param st 行结构样式
 * @param page 页面全局配置
 * @returns HTML 片段（空内容返回空串）
 */
function renderInlineBlock(b: SectionRowBlock, st: CustomRowsStyle, page: PageStyle): string {
  const text = String(b.text ?? '').trim()
  if (!text) return ''
  const style = b.type === 'heading' ? st.heading : st.text
  return `<span style="${textStyleToCss(style, page.fontSize)};white-space:pre-wrap">${esc(text)}</span>`
}

/**
 * 渲染独占整行块（list/textbox）
 * @param b 内容块
 * @param st 行结构样式
 * @param page 页面全局配置
 * @returns HTML 片段（空内容返回空串）
 */
function renderFullBlock(b: SectionRowBlock, st: CustomRowsStyle, page: PageStyle): string {
  if (b.type === 'list') {
    return renderBulletList(b.text ?? '', st.list, undefined, page.fontSize)
  }
  if (b.type === 'textbox') {
    const text = String(b.text ?? '').trim()
    if (!text) return ''
    return `<div style="${textStyleToCss(st.textbox, page.fontSize)};white-space:pre-wrap;line-height:inherit">${esc(text)}</div>`
  }
  // full 的 heading/text 也按整行文本渲染
  return renderInlineBlock(b, st, page)
}

/**
 * 渲染一行：inline 块按 left/center/right 分组并排，full 块依次独占整行
 * @param row 行数据
 * @param st 行结构样式
 * @param page 页面全局配置
 * @returns HTML 片段（空行返回空串）
 */
function renderRow(row: SectionRow, st: CustomRowsStyle, page: PageStyle): string {
  const blocks = row.blocks || []

  // 分组：整行块 与 三区 inline 块
  const fullBlocks = blocks.filter(isFullBlock)
  const inlineBlocks = blocks.filter((b) => !isFullBlock(b))
  const groups: Record<'left' | 'center' | 'right', string[]> = { left: [], center: [], right: [] }
  for (const b of inlineBlocks) {
    const span = b.span === 'center' || b.span === 'right' ? b.span : 'left'
    const html = renderInlineBlock(b, st, page)
    if (html) groups[span].push(html)
  }

  const parts: string[] = []
  const filled = (['left', 'center', 'right'] as const).filter((k) => groups[k].length > 0)
  for (const key of filled) {
    // 组内块用间距连接，组作为整体参与外层布局
    parts.push(
      `<span style="display:inline-flex;align-items:baseline;gap:10px;justify-content:${
        key === 'center' ? 'center' : key === 'right' ? 'flex-end' : 'flex-start'
      }">${groups[key].join('')}</span>`
    )
  }

  let html = ''
  if (parts.length > 0) {
    // 多区并存时两端/三等分分布；单居中区居中；否则靠左
    const justify =
      filled.length > 1 ? 'space-between' : filled[0] === 'center' ? 'center' : 'flex-start'
    html += `<div style="display:flex;align-items:baseline;justify-content:${justify};gap:10px">${parts.join('')}</div>`
  }
  for (const b of fullBlocks) {
    const blockHtml = renderFullBlock(b, st, page)
    if (blockHtml) html += blockHtml
  }
  return html
}

/**
 * 渲染自定义模块（行结构）
 * @param sec 自定义模块数据
 * @param ms 排版配置（customRows 提供样式）
 * @param page 页面全局配置
 * @returns HTML 片段（无内容返回空串）
 */
export function renderCustomRowsSection(sec: { title: string; rows: SectionRow[] }, ms: ModuleStyle, page: PageStyle): string {
  const st = ms.customRows
  if (!st) return ''
  const rows = sec.rows || []
  if (rows.length === 0) return ''

  const titleHtml = ms.title ? `<div>${renderSectionTitle(ms.title, sec.title || '自定义模块', page.fontSize)}</div>` : ''

  const rowsHtml = rows
    .map((row) => renderRow(row, st, page))
    .filter(Boolean)
    .join('')

  if (!rowsHtml) return ''
  return `<div>${titleHtml}<div style="display:flex;flex-direction:column;gap:${st.rowGap}px">${rowsHtml}</div></div>`
}
