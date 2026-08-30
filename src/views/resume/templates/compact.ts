/**
 * 紧凑高效模板（compact）- 引擎适配层
 * ------------------------------------------------------------------
 * 原实现为硬编码 HTML（已迁移至 engine/ 配置驱动渲染），
 * 本文件保留模板注册接口：渲染时将配置合并默认值后交给引擎，
 * 默认配置即原 compact 视觉（零回归）。
 */

import type { ResumeData, ResumeLayoutConfig, ResumeTemplate } from '../types'
import { renderResume } from '../engine/sections'
import { mergeConfig } from '../engine/defaultConfig'

/**
 * 渲染紧凑模板（配置驱动）
 * @param data 简历数据
 * @param config 排版配置（可空，空则用默认）
 * @returns 完整 HTML 字符串
 */
function renderCompact(data: ResumeData, config?: ResumeLayoutConfig): string {
  return renderResume(data, mergeConfig(config))
}

/** 紧凑高效模板定义 */
export const compactTemplate: ResumeTemplate = {
  id: 'compact',
  name: '紧凑高效',
  desc: '灰黑白 · 小字号高密度 · 单行压缩头部，适合经历丰富的一页纸简历',
  render: renderCompact,
}
