/**
 * 排版引擎 - 条目型模块工厂
 * ------------------------------------------------------------------
 * 教育背景 / 工作经历 / 项目经验 三个模块结构一致：
 * 标题 + 若干条目（条目头 + 描述列表），差异仅在字段提取。
 * 本工厂接收「标题文案」与「条目字段提取函数」，生成模块渲染器。
 */

import type { ModuleStyle, PageStyle } from '../types'
import type { ResumeData } from '../../types'
import { renderSectionTitle } from '../components/sectionTitle'
import { renderEntryHeader, type EntryFieldItem } from '../components/entryHeader'
import { renderBulletList } from '../components/bulletList'

/** 单条经历的字段提取结果 */
export interface ExtractedEntry {
  /** 条目头字段（id 对应 entryHeader.fieldOrder，date 为日期字段） */
  fields: EntryFieldItem[]
  /** 描述多行文本 */
  description: string
}

/**
 * 生成条目型模块渲染器
 * @param titleText 模块标题文案
 * @param extract 从简历数据提取条目列表（返回空数组则整模块隐藏）
 * @returns 渲染器 (data, moduleStyle, page) => HTML
 */
export function createEntrySection(
  titleText: string,
  extract: (data: ResumeData) => ExtractedEntry[]
): (data: ResumeData, ms: ModuleStyle, page: PageStyle) => string {
  return (data, ms, page) => {
    const eh = ms.entryHeader
    const list = ms.list
    if (!eh || !list) return ''

    const entries = extract(data)
    if (entries.length === 0) return ''

    const titleHtml = renderSectionTitle(ms.title!, titleText, page.fontSize)

    const itemsHtml = entries
      .map((entry) => {
        // 日期字段：按连接符拼接起止
        const raw = entry.fields.find((f) => f.id === 'date')
        const fields = entry.fields.filter((f) => f.id !== 'date')
        if (raw) {
          const [start, end] = String(raw.content || '').split('|')
          const dateText = [start, end].filter((s) => s && s.trim()).join(` ${eh.dateConnector} `)
          fields.push({ id: 'date', content: dateText })
        }
        const headerHtml = renderEntryHeader(fields, eh, ms.fields, page.fontSize)
        const listHtml = renderBulletList(entry.description, list, ms.fields, page.fontSize)
        if (!headerHtml && !listHtml) return ''
        return `<div>${headerHtml}${listHtml}</div>`
      })
      .filter(Boolean)
      .join('')

    if (!itemsHtml) return ''
    return `<div>${titleHtml}<div style="display:flex;flex-direction:column;gap:${page.entryGap}px">${itemsHtml}</div></div>`
  }
}
