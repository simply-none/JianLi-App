/**
 * 排版引擎 - 章节标题组件
 * ------------------------------------------------------------------
 * 渲染模块标题：标题文本 + 装饰线（右侧延伸 / 下方独立行）。
 */

import { renderLine, renderLineBelow } from './line'
import { renderContent, textStyleToCss } from './text'
import type { SectionTitleStyle } from '../types'

/**
 * 渲染章节标题
 * @param title 标题配置
 * @param titleText 标题文字
 * @param baseFontSize 全局正文字号 pt
 * @returns HTML 片段
 */
export function renderSectionTitle(title: SectionTitleStyle, titleText: string, baseFontSize: number): string {
  const css = textStyleToCss(title.text, baseFontSize)
  const gap = title.line.gap

  if (title.line.enabled && title.line.position === 'after') {
    // 右侧延伸：flex 行内放文字 + 线（间距用 padding-bottom 计量，进入切页高度测量）
    return `<div style="display:flex;align-items:center;gap:${gap}px;padding-bottom:6px">
      <span style="${css}">${renderContent(titleText)}</span>
      ${renderLine(title.line, true)}
    </div>`
  }
  // 下方：文字行 + 独立线行
  return `<div style="padding-bottom:6px">
    <span style="${css}">${renderContent(titleText)}</span>
    ${renderLineBelow(title.line)}
  </div>`
}
