/**
 * 排版引擎 - 自定义模块（行结构）渲染
 * ------------------------------------------------------------------
 * 行级自由组合模型：
 *   - 一行可含多个 heading/text 块，按 span（left/center/right）分组并排，
 *     多组时 space-between 三区布局，单组按对齐
 *   - list（列表）/ textbox（多行段落）独占整行
 * 样式来自 ModuleStyle.customRows（heading/text/textbox TextStyle + list ListStyle）。
 */

import type { PageStyle, SectionRow, SectionRowBlock, CustomSectionData } from '../../types'
import type { CustomRowsStyle, ModuleStyle } from '../types'
import { renderContent, textStyleToCss } from '../components/text'
import { renderSectionTitle } from '../components/sectionTitle'
import { renderBulletList } from '../components/bulletList'

/** 行结构样式兜底（存量排版项缺 customRows 时使用，与 createCustomModuleStyle 默认一致） */
const FALLBACK_CUSTOM_ROWS: CustomRowsStyle = {
  rowGap: 6,
  heading: { visible: true, size: 'base', weight: 600, ink: 1000, letterSpacing: 0, italic: false },
  text: { visible: true, size: 'base', weight: 400, ink: 850, letterSpacing: 0, italic: false },
  textbox: { visible: true, size: 'base', weight: 400, ink: 750, letterSpacing: 0, italic: false },
  list: { marker: 'dot', markerInk: 500, indent: 11, itemGap: 0, text: { visible: true, size: 'base', weight: 400, ink: 850, letterSpacing: 0, italic: false } },
}

/**
 * 自定义模块结构规范化：v1（kind=entry/text 固定字段）无损转换为 v2 行结构；
 * 已是 v2（含 rows 数组）的原样返回。
 * @param sec 任意版本的自定义模块数据
 * @returns v2 行结构数据
 */
export function normalizeCustomSection(sec: any): CustomSectionData {
  // 已是 v2 行结构
  if (sec && Array.isArray(sec.rows)) return sec as CustomSectionData
  // v1 文本型 → 单个整行段落块
  if (sec?.kind === 'text') {
    return {
      id: sec.id,
      title: sec.title || '自定义模块',
      rows: [
        {
          id: `${sec.id}-r1`,
          blocks: [{ id: `${sec.id}-b1`, type: 'textbox', span: 'full', text: sec.content || '' }],
        },
      ],
    }
  }
  // v1 条目型 → 每条目两行：条目头行（主字段/副字段/日期）+ 描述列表行
  const rows: SectionRow[] = (sec?.entries || []).flatMap((e: any, i: number) => {
    const headBlocks: any[] = []
    if (e?.field1) headBlocks.push({ id: `${sec.id}-r${i}-b1`, type: 'heading', span: 'left', text: e.field1 })
    if (e?.field2) headBlocks.push({ id: `${sec.id}-r${i}-b2`, type: 'text', span: 'left', text: e.field2 })
    const date = [e?.startTime, e?.endTime].filter((s: string) => s && String(s).trim()).join(' ~ ')
    if (date) headBlocks.push({ id: `${sec.id}-r${i}-b3`, type: 'text', span: 'right', text: date })
    const out: any[] = []
    if (headBlocks.length > 0) out.push({ id: `${sec.id}-r${i}-head`, blocks: headBlocks })
    if (e?.description) {
      out.push({
        id: `${sec.id}-r${i}-desc`,
        blocks: [{ id: `${sec.id}-r${i}-b4`, type: 'list', span: 'full', text: e.description }],
      })
    }
    return out
  })
  return { id: sec?.id || '', title: sec?.title || '自定义模块', rows }
}

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
  return `<span style="${textStyleToCss(style, page.fontSize)};white-space:pre-wrap">${renderContent(text)}</span>`
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
    return `<div style="${textStyleToCss(st.textbox, page.fontSize)};white-space:pre-wrap;line-height:inherit">${renderContent(text)}</div>`
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
  // 存量排版项可能缺 customRows（旧版本创建），兜底默认样式保证内容可见
  const st = ms.customRows || FALLBACK_CUSTOM_ROWS
  const rows = sec.rows || []
  if (rows.length === 0) return ''

  const titleHtml = ms.title ? `<div>${renderSectionTitle(ms.title, sec.title || '自定义模块', page.fontSize)}</div>` : ''

  const rowsHtml = rows
    .map((row) => {
      const html = renderRow(row, st, page)
      // 行间距用 padding-bottom 计量（进入高度测量，支持按行切页）
      return html ? `<div style="padding-bottom:${st.rowGap}px">${html}</div>` : ''
    })
    .filter(Boolean)
    .join('')

  if (!rowsHtml) return ''
  // .rfs-items 标记行容器（切页脚本按行粒度拆分）
  return `<div>${titleHtml}<div class="rfs-items">${rowsHtml}</div></div>`
}
