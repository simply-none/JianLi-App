/**
 * 排版引擎 - 模块渲染注册表与入口
 * ------------------------------------------------------------------
 * renderResume(data, config)：
 *   按配置中模块顺序依次调用各模块渲染器，拼装完整 A4 HTML 文档。
 *   空内容/隐藏模块自动跳过；输出内联样式，预览与 PDF 导出共用。
 */

import type { ModuleId, ModuleStyle, PageStyle } from '../types'
import type { ResumeData, ResumeEducationItem, ResumeWorkItem, ResumeProjectItem, ResumeLayoutConfig } from '../../types'
import { createEntrySection } from './entrySection'
import { renderBasics } from './basics'
import { renderSkills } from './skills'
import { renderEvaluation } from './evaluation'

/** 日期字段原始值格式：start|end（由提取函数统一） */
function dateRaw(start: string, end: string): string {
  return `${start || ''}|${end || ''}`
}

/** 各模块渲染器 */
const RENDERERS: Record<ModuleId, (data: ResumeData, ms: ModuleStyle, page: PageStyle) => string> = {
  basics: renderBasics,
  education: createEntrySection('教育背景', (d: ResumeData) =>
    (d.education || []).map((e: ResumeEducationItem) => ({
      fields: [
        { id: 'school', content: e.school },
        { id: 'major', content: e.major },
        { id: 'degree', content: e.degree },
        { id: 'date', content: dateRaw(e.startTime, e.endTime) },
      ],
      description: e.description || '',
    }))
  ),
  work: createEntrySection('工作经历', (d: ResumeData) =>
    (d.work || []).map((w: ResumeWorkItem) => ({
      fields: [
        { id: 'company', content: w.company },
        { id: 'position', content: w.position },
        { id: 'date', content: dateRaw(w.startTime, w.endTime) },
      ],
      description: w.description || '',
    }))
  ),
  project: createEntrySection('项目经验', (d: ResumeData) =>
    (d.project || []).map((p: ResumeProjectItem) => ({
      fields: [
        { id: 'name', content: p.name },
        { id: 'role', content: p.role },
        { id: 'date', content: dateRaw(p.startTime, p.endTime) },
      ],
      description: p.description || '',
    }))
  ),
  skills: renderSkills,
  evaluation: renderEvaluation,
}

/** 字体族映射 */
const FONT_STACKS: Record<PageStyle['fontFamily'], string> = {
  sans: '"PingFang SC", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", "STSong", "SimSun", serif',
}

/**
 * 渲染完整简历 HTML
 * @param data 简历数据
 * @param config 排版配置
 * @returns 完整 HTML 文档字符串
 */
export function renderResume(data: ResumeData, config: ResumeLayoutConfig): string {
  const page = config.page
  const bodyCss = [
    'margin:0;padding:0;box-sizing:border-box',
    'background:#ffffff',
    `font-family:${FONT_STACKS[page.fontFamily] || FONT_STACKS.sans}`,
    `color:#333333`,
    `font-size:${page.fontSize}pt`,
    `line-height:${page.lineHeight}`,
    `width:210mm`,
    `min-height:297mm`,
    `padding:${page.paddingY}mm ${page.paddingX}mm`,
    '-webkit-print-color-adjust:exact',
    'print-color-adjust:exact',
  ].join(';')

  // 按配置顺序渲染模块（隐藏/空内容跳过），模块间距用 flex column gap
  const sectionsHtml = config.modules
    .map((ms) => {
      if (!ms.visible) return ''
      const renderer = RENDERERS[ms.id]
      return renderer ? renderer(data, ms, page) : ''
    })
    .filter(Boolean)
    .join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeTitle(data?.basics?.name || '简历')}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #ffffff; }
  .rfs-body { ${bodyCss}; display: flex; flex-direction: column; gap: ${page.sectionGap}px; }
</style>
</head>
<body>
  <div class="rfs-body">${sectionsHtml}</div>
</body>
</html>`
}

/** 标题转义 */
function escapeTitle(v: string): string {
  return String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
