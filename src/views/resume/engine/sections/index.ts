/**
 * 排版引擎 - 模块渲染注册表与入口
 * ------------------------------------------------------------------
 * renderResume(data, config)：
 *   按配置中模块顺序依次调用各模块渲染器，拼装完整 A4 HTML 文档。
 *   空内容/隐藏模块自动跳过；输出内联样式，预览与 PDF 导出共用。
 */

import type { ModuleId, ModuleStyle, PageStyle } from '../types'
import type { ResumeData, ResumeEducationItem, ResumeWorkItem, ResumeProjectItem, ResumeLayoutConfig, CustomSectionData } from '../../types'
import { createEntrySection } from './entrySection'
import { renderCustomRowsSection, normalizeCustomSection } from './customRows'
import { renderBasics } from './basics'
import { renderSkills } from './skills'
import { renderEvaluation } from './evaluation'

/** 自定义模块排版 id 前缀（`custom:<数据 id>`） */
const CUSTOM_PREFIX = 'custom:'

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
 * 解析页面字体栈：自定义字体名优先（含空格/中文自动加引号），回退到默认字体栈
 * @param page 页面全局配置
 * @returns CSS font-family 值
 */
function resolveFontStack(page: PageStyle): string {
  const base = FONT_STACKS[page.fontFamily] || FONT_STACKS.sans
  const custom = String(page.fontFamilyName || '').trim()
  if (!custom) return base
  const quoted = custom.includes('"') ? custom : `"${custom.replace(/"/g, '')}"`
  return `${quoted}, ${base}`
}

/**
 * 渲染自定义模块（行结构，样式取 ms.customRows，缺省时引擎兜底默认样式）
 * @param sec 自定义模块数据（兼容 v1 结构，渲染前规范化）
 * @param ms 排版配置
 * @param page 页面全局配置
 * @returns HTML 片段（数据缺失/无内容返回空串）
 */
function renderCustomSection(sec: CustomSectionData, ms: ModuleStyle, page: PageStyle): string {
  // 规范化：内存中的 v1 结构（热重载残留等场景）统一转为行结构
  return renderCustomRowsSection(normalizeCustomSection(sec), ms, page)
}

/**
 * 渲染完整简历 HTML
 * 布局规范（配合预览切页与打印分页）：
 *   - body 无内边距，页面边距由 .rfs-page（预览）/printToPDF margins（导出）提供
 *   - 所有纵向间距用 padding-bottom 计量（进入 offsetHeight，切页测量准确）
 *   - .rfs-items 标记条目/行容器，供切页脚本按条目粒度拆分
 * @param data 简历数据
 * @param config 排版配置
 * @returns 完整 HTML 文档字符串
 */
export function renderResume(data: ResumeData, config: ResumeLayoutConfig): string {
  const page = config.page
  const bodyCss = [
    'margin:0;padding:0;box-sizing:border-box',
    'background:#ffffff',
    `font-family:${resolveFontStack(page)}`,
    `color:#333333`,
    `font-size:${page.fontSize}pt`,
    `line-height:${page.lineHeight}`,
    `letter-spacing:${page.letterSpacing}px`,
    // 显式禁用浏览器自动中英文间距（text-autospace）：新版 Chromium 曾默认开启，
    // 会导致中英文/中文与数字之间出现不受控的额外间隔，破坏字间距为 0 的排版语义
    'text-autospace:no-autospace',
    `width:210mm`,
    `-webkit-print-color-adjust:exact`,
    'print-color-adjust:exact',
  ].join(';')

  // 按配置顺序渲染模块（隐藏/空内容跳过）；模块间距用 padding-bottom（进入高度测量）
  const sectionsHtml = config.modules
    .map((ms) => {
      if (!ms.visible) return ''
      // 自定义模块：按数据层 customSections 分发渲染
      if (ms.id.startsWith(CUSTOM_PREFIX)) {
        const secId = ms.id.slice(CUSTOM_PREFIX.length)
        const sec = (data.customSections || []).find((s) => s.id === secId)
        const html = sec ? renderCustomSection(sec, ms, page) : ''
        return html ? `<div class="rfs-module" style="padding-bottom:${page.sectionGap}px">${html}</div>` : ''
      }
      const renderer = RENDERERS[ms.id as ModuleId]
      const html = renderer ? renderer(data, ms, page) : ''
      return html ? `<div class="rfs-module" style="padding-bottom:${page.sectionGap}px">${html}</div>` : ''
    })
    .filter(Boolean)
    .join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="resume-page" data-pad-y="${page.paddingY}" data-pad-x="${page.paddingX}">
<title>${escapeTitle(data?.basics?.name || '简历')}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #ffffff; }
  body { ${bodyCss}; }
  /* 预览分页纸张：每页固定 A4 尺寸与统一内边距 */
  .rfs-page {
    width: 210mm;
    height: 297mm;
    padding: ${page.paddingY}mm ${page.paddingX}mm;
    box-sizing: border-box;
    background: #ffffff;
    overflow: hidden;
    position: relative;
    break-after: page;
    page-break-after: always;
  }
  /* 末页不再强制分页，避免导出产生空白页 */
  .rfs-page:last-child { break-after: auto; page-break-after: auto; }
  /* 预览模式：灰底衬托纸张边界 + 轻阴影（导出时 body 无 preview-mode 类） */
  body.preview-mode { background: #e5e7eb; }
  body.preview-mode .rfs-page { box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18); }
  .rfs-page + .rfs-page { margin-top: 16px; }
  @media print {
    .rfs-page + .rfs-page { margin-top: 0; }
    body.preview-mode { background: #ffffff; }
    body.preview-mode .rfs-page { box-shadow: none; }
  }
  /* 打印/导出时避免条目被从中间切开 */
  .rfs-module, .rfs-items > div { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body data-pad-y="${page.paddingY}" data-pad-x="${page.paddingX}">
  <!-- flow 预留与纸张一致的内边距：保证切页装箱时的高度测量与最终纸张内容宽度一致 -->
  <div class="rfs-flow" style="padding:${page.paddingY}mm ${page.paddingX}mm">${sectionsHtml}</div>
</body>
</html>`
}

/** 标题转义 */
function escapeTitle(v: string): string {
  return String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
