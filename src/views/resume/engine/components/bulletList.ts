/**
 * 排版引擎 - 列表组件
 * ------------------------------------------------------------------
 * 渲染多行描述文本：圆点/短横/数字/纯段落 四种符号形态，
 * 输入为原始多行字符串（\n 分隔），空行自动过滤。
 */

import { resolveInkColor } from '../tokens'
import { renderContent, textStyleToCss } from './text'
import type { ListStyle, TextStyle } from '../types'

/**
 * 渲染描述列表
 * @param raw 多行文本（\n 分隔）
 * @param ls 列表配置
 * @param fieldsOverride 描述字段样式覆盖（id=description）
 * @param baseFontSize 全局正文字号 pt
 * @returns HTML 片段（无内容返回空串）
 */
export function renderBulletList(
  raw: string,
  ls: ListStyle,
  fieldsOverride: Record<string, Partial<TextStyle> & { visible?: boolean }> | undefined,
  baseFontSize: number
): string {
  // 描述字段显隐：覆盖里 visible=false 时不渲染
  const mergedText: ListStyle['text'] = { ...ls.text, ...(fieldsOverride?.description || {}) }
  if (!mergedText.visible) return ''

  const lines = String(raw ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''

  const css = textStyleToCss(mergedText, baseFontSize)
  const markerColor = resolveInkColor(ls.markerInk)
  const liGap = ls.itemGap > 0 ? `margin-bottom:${ls.itemGap}px;` : ''

  const items = lines
    .map((line, i) => {
      const markerHtml =
        ls.marker === 'dot'
          ? `<span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:${markerColor};margin-right:${Math.max(4, ls.indent - 4)}px;vertical-align:0.28em"></span>`
          : ls.marker === 'dash'
            ? `<span style="display:inline-block;width:8px;height:1px;background:${markerColor};margin-right:${Math.max(4, ls.indent - 8)}px;vertical-align:0.35em"></span>`
            : ls.marker === 'number'
              ? `<span style="color:${markerColor};margin-right:${Math.max(4, ls.indent - 8)}px;font-size:${baseFontSize}pt">${i + 1}.</span>`
              : ''
      const pad = ls.marker === 'none' ? 0 : 0 // 缩进已由 marker 的 margin-right 提供
      void pad
      return `<li style="list-style:none;${liGap}line-height:inherit">${markerHtml}<span style="${css}">${renderContent(line)}</span></li>`
    })
    .join('')

  return `<ul style="margin:2px 0 0;padding:0;padding-left:${ls.marker === 'none' ? ls.indent : 0}px">${items}</ul>`
}
