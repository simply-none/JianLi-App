/**
 * 排版引擎 - 自我评价模块
 * ------------------------------------------------------------------
 * 标题 + 多行纯文本（保留换行），样式可配置。
 */

import type { ModuleStyle, PageStyle, TextStyle } from '../types'
import type { ResumeData } from '../../types'
import { renderSectionTitle } from '../components/sectionTitle'
import { esc, textStyleToCss } from '../components/text'
import { resolveFieldStyle } from '../components/entryHeader'

/** 兜底基础样式 */
const BASE_TEXT: TextStyle = {
  visible: true,
  size: 'base',
  weight: 400,
  ink: 900,
  letterSpacing: 0,
  italic: false,
}

/**
 * 渲染自我评价模块
 * @param data 简历数据
 * @param ms 模块配置
 * @param page 页面全局配置
 * @returns HTML 片段（空内容返回空串）
 */
export function renderEvaluation(data: ResumeData, ms: ModuleStyle, page: PageStyle): string {
  const base = ms.textStyle || BASE_TEXT
  const style = resolveFieldStyle(base, ms.fields?.text)
  const raw = String(data.evaluation || '').trim()
  if (!style.visible || !raw) return ''

  const titleHtml = renderSectionTitle(ms.title!, '自我评价', page.fontSize)
  const bodyHtml = esc(raw).replace(/\r?\n/g, '<br>')
  return `<div>${titleHtml}<div style="${textStyleToCss(style, page.fontSize)};line-height:inherit">${bodyHtml}</div></div>`
}
