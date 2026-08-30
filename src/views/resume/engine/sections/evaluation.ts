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
 * 渲染文本型章节主体（公共函数，自我评价与自定义文本模块共用）
 * @param titleText 模块标题文案
 * @param raw 多行文本
 * @param ms 模块排版配置
 * @param page 页面全局配置
 * @returns HTML 片段（空内容返回空串）
 */
export function renderTextSection(titleText: string, raw: string, ms: ModuleStyle, page: PageStyle): string {
  const base = ms.textStyle || BASE_TEXT
  const style = resolveFieldStyle(base, ms.fields?.text)
  const text = String(raw ?? '').trim()
  if (!style.visible || !text) return ''

  const titleHtml = ms.title ? renderSectionTitle(ms.title, titleText, page.fontSize) : ''
  const bodyHtml = esc(text).replace(/\r?\n/g, '<br>')
  return `<div>${titleHtml}<div style="${textStyleToCss(style, page.fontSize)};line-height:inherit">${bodyHtml}</div></div>`
}

/**
 * 渲染自我评价模块
 * @param data 简历数据
 * @param ms 模块配置
 * @param page 页面全局配置
 * @returns HTML 片段（空内容返回空串）
 */
export function renderEvaluation(data: ResumeData, ms: ModuleStyle, page: PageStyle): string {
  return renderTextSection('自我评价', data.evaluation || '', ms, page)
}
