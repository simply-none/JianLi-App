/**
 * 排版引擎 - 基本信息模块
 * ------------------------------------------------------------------
 * 结构（保持既有 compact 版式，仅样式可调）：
 *   第一行：姓名 + 求职意向（同行，间距可调）
 *   头部装饰线（可配）
 *   第二行：联系方式字段组（顺序/分隔符可调）
 */

import type { ModuleStyle, PageStyle, TextStyle } from '../types'
import type { ResumeData } from '../../types'
import { renderField, renderFieldGroup, textStyleToCss } from '../components/text'
import { renderLineBelow } from '../components/line'
import { resolveFieldStyle } from '../components/entryHeader'

/** 渲染器兜底基础样式（fields 未覆盖时） */
const BASE_TEXT: TextStyle = {
  visible: true,
  size: 'base',
  weight: 400,
  ink: 900,
  letterSpacing: 0,
  italic: false,
}

/**
 * 渲染基本信息模块
 * @param data 简历数据
 * @param ms 模块配置
 * @param page 页面全局配置
 * @returns HTML 片段（全部字段为空返回空串）
 */
export function renderBasics(data: ResumeData, ms: ModuleStyle, page: PageStyle): string {
  const header = ms.header
  if (!header) return ''
  const b = data.basics || ({} as ResumeData['basics'])
  const f = ms.fields || {}

  // 第一行：姓名 + 求职意向
  const nameHtml = renderField(b.name, resolveFieldStyle(BASE_TEXT, f.name), page.fontSize)
  const intentHtml = renderField(b.jobIntent, resolveFieldStyle(BASE_TEXT, f.jobIntent), page.fontSize)
  if (!nameHtml && !intentHtml) {
    // 头部仅有联系方式的场景极少，保持与现状一致：无姓名则整模块隐藏
    return ''
  }
  const headLine = `<div style="display:flex;align-items:baseline;gap:${header.intentGap}px">${nameHtml}${intentHtml}</div>`

  // 头部装饰线（下方）
  const lineHtml = renderLineBelow(header.line)

  // 第二行：联系方式字段组
  const contactBase = BASE_TEXT
  const contactSpans = header.contactOrder.map((fid) => {
    const content = (b as any)[fid] as string
    return renderField(content, resolveFieldStyle(contactBase, f[fid]), page.fontSize)
  })
  const contactHtml = renderFieldGroup(contactSpans, header.contactSeparator, page.fontSize)
  const contactLine = contactHtml
    ? `<div style="margin-top:${header.contactGap}px">${contactHtml}</div>`
    : ''
  void textStyleToCss // 保留导入以便后续扩展（避免 tree-shaking 移除语义）

  return `<div>${headLine}${lineHtml}${contactLine}</div>`
}
