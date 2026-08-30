/**
 * 简历模板注册表
 * ------------------------------------------------------------------
 * 统一收集所有简历模板，供画廊选择与渲染使用。
 * 后续新增模板：在本目录新增 ts 文件并在下方数组注册即可。
 */

import type { ResumeTemplate } from '../types'
import { compactTemplate } from './compact'

/** 全部已注册模板 */
export const resumeTemplates: ResumeTemplate[] = [compactTemplate]

/** 默认模板 id */
export const DEFAULT_TEMPLATE_ID = compactTemplate.id

/**
 * 按 id 查找模板
 * @param id 模板 id
 * @returns 命中的模板；未命中返回默认模板
 */
export function getTemplate(id: string): ResumeTemplate {
  return resumeTemplates.find((t) => t.id === id) || compactTemplate
}
