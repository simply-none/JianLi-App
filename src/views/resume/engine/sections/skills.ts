/**
 * 排版引擎 - 技能特长模块
 * ------------------------------------------------------------------
 * 标题 + 技能标签流式排布：技能名 + 熟练度圆点（1-5），
 * 圆点尺寸/间距/实心空心灰阶均可配置。
 */

import type { ModuleStyle, PageStyle, TextStyle } from '../types'
import type { ResumeData } from '../../types'
import { renderSectionTitle } from '../components/sectionTitle'
import { renderContent, textStyleToCss } from '../components/text'
import { resolveInkColor } from '../tokens'
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
 * 渲染技能特长模块
 * @param data 简历数据
 * @param ms 模块配置
 * @param page 页面全局配置
 * @returns HTML 片段（无有效技能返回空串）
 */
export function renderSkills(data: ResumeData, ms: ModuleStyle, page: PageStyle): string {
  const base = ms.textStyle || BASE_TEXT
  const dots = ms.dots
  if (!dots) return ''

  const skills = (data.skills || []).filter((s) => s && String(s.name || '').trim())
  if (skills.length === 0) return ''

  const titleHtml = renderSectionTitle(ms.title!, '技能特长', page.fontSize)

  const itemsHtml = skills
    .map((s) => {
      const style = resolveFieldStyle(base, ms.fields?.skillName)
      if (!style.visible) return ''
      const lv = Math.max(1, Math.min(5, Number(s.level) || 3))
      const dotSpans = [1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<i style="display:inline-block;width:${dots.size}px;height:${dots.size}px;border-radius:50%;background:${resolveInkColor(i <= lv ? dots.onInk : dots.offInk)};margin-right:${dots.gap}px"></i>`
        )
        .join('')
      return `<span style="display:inline-flex;align-items:center;gap:5px">
        <span style="${textStyleToCss(style, page.fontSize)}">${renderContent(s.name)}</span>
        <span style="display:inline-flex;align-items:center">${dotSpans}</span>
      </span>`
    })
    .filter(Boolean)
    .join('')

  if (!itemsHtml) return ''
  return `<div>${titleHtml}<div style="display:flex;flex-wrap:wrap;gap:5px 14px;align-items:center">${itemsHtml}</div></div>`
}
