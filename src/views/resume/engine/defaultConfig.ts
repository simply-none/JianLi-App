/**
 * 排版引擎 - 默认配置
 * ------------------------------------------------------------------
 * 默认排版配置 = 紧凑高效（compact）模板的原始视觉，保证零回归：
 * 任何字段未单独覆盖时继承此处组件默认值；
 * 深合并工具 mergeConfig 用于库中存量配置与默认值的补全合并。
 */

import type { ModuleId, ModuleStyle, ResumeLayoutConfig, TextStyle } from './types'

/** 通用文本样式快捷构造 */
function text(partial: Partial<TextStyle>): TextStyle {
  return {
    visible: true,
    size: 'base',
    weight: 400,
    ink: 900,
    letterSpacing: 0,
    italic: false,
    ...partial,
  }
}

/** 章节标题默认（10.5pt 加粗 + 右侧通栏细线） */
function defaultTitle(): ModuleStyle['title'] {
  return {
    text: text({ size: 'lg', weight: 700, ink: 1000, letterSpacing: 3 }),
    line: {
      enabled: true,
      position: 'after',
      kind: 'solid',
      taper: false,
      thickness: 1,
      lengthMode: 'full',
      gap: 8,
      ink: 250,
    },
  }
}

/** 条目头默认（正文加粗 + 日期右端弱化） */
function defaultEntryHeader(fieldOrder: string[]): ModuleStyle['entryHeader'] {
  return {
    fieldOrder: [...fieldOrder],
    textStyle: text({ weight: 600, ink: 1000 }),
    separator: { type: 'space', gap: 4, ink: 750 },
    datePlacement: 'right',
    dateConnector: '–',
    dateStyle: text({ size: 'sm', weight: 400, ink: 450 }),
  }
}

/** 列表默认（圆点 #888 + 缩进 11px + #444 文本） */
function defaultList(): ModuleStyle['list'] {
  return {
    marker: 'dot',
    markerInk: 500,
    indent: 11,
    itemGap: 0,
    text: text({ ink: 850 }),
  }
}

/** 六个模块的默认配置（顺序即渲染顺序） */
function defaultModules(): ModuleStyle[] {
  const modules: ModuleStyle[] = [
    {
      id: 'basics',
      visible: true,
      header: {
        line: {
          enabled: true,
          position: 'below',
          kind: 'solid',
          taper: false,
          thickness: 2,
          lengthMode: 'full',
          gap: 10,
          ink: 1000,
        },
        intentGap: 10,
        contactGap: 5,
        contactOrder: ['phone', 'email', 'gender', 'age', 'city'],
        contactSeparator: { type: 'dot', gap: 4, ink: 650 },
      },
      fields: {
        name: { size: 'giant', weight: 700, ink: 1000, letterSpacing: 2 },
        jobIntent: { size: 'md', weight: 500, ink: 650 },
        phone: { size: 'sm', ink: 650, letterSpacing: 0.2 },
        email: { size: 'sm', ink: 650, letterSpacing: 0.2 },
        gender: { size: 'sm', ink: 650, letterSpacing: 0.2 },
        age: { size: 'sm', ink: 650, letterSpacing: 0.2 },
        city: { size: 'sm', ink: 650, letterSpacing: 0.2 },
      },
    },
    {
      id: 'education',
      visible: true,
      title: defaultTitle(),
      entryHeader: defaultEntryHeader(['school', 'major', 'degree']),
      list: defaultList(),
    },
    {
      id: 'work',
      visible: true,
      title: defaultTitle(),
      entryHeader: defaultEntryHeader(['company', 'position']),
      list: defaultList(),
      fields: { position: { weight: 400, ink: 750 } },
    },
    {
      id: 'project',
      visible: true,
      title: defaultTitle(),
      entryHeader: defaultEntryHeader(['name', 'role']),
      list: defaultList(),
      fields: { role: { weight: 400, ink: 750 } },
    },
    {
      id: 'skills',
      visible: true,
      title: defaultTitle(),
      textStyle: text({ weight: 500, ink: 900 }),
      dots: { size: 6, gap: 2.5, onInk: 750, offInk: 250 },
    },
    {
      id: 'evaluation',
      visible: true,
      title: defaultTitle(),
      textStyle: text({ ink: 850 }),
    },
  ]
  return modules
}

/** 默认排版配置（= compact 原始视觉） */
export const defaultLayoutConfig: ResumeLayoutConfig = {
  version: 1,
  page: {
    fontSize: 9.5,
    lineHeight: 1.35,
    fontFamily: 'sans',
    paddingX: 14,
    paddingY: 13,
    sectionGap: 10,
    entryGap: 6,
  },
  modules: defaultModules(),
}

/** 模块显示名（UI 用） */
export const MODULE_LABELS: Record<ModuleId, string> = {
  basics: '基本信息',
  education: '教育背景',
  work: '工作经历',
  project: '项目经验',
  skills: '技能特长',
  evaluation: '自我评价',
}

/**
 * 深合并配置：以默认值为底，库中配置覆盖（数组按 id 匹配补全，顺序以库中为准）
 * @param saved 库中读取的配置（可能缺字段/旧版本）
 * @returns 补全后的完整配置
 */
export function mergeConfig(saved: Partial<ResumeLayoutConfig> | null | undefined): ResumeLayoutConfig {
  if (!saved || !Array.isArray(saved.modules)) {
    return JSON.parse(JSON.stringify(defaultLayoutConfig))
  }
  const merged: ResumeLayoutConfig = JSON.parse(JSON.stringify(defaultLayoutConfig))
  // 页面全局：浅层字段逐个覆盖
  if (saved.page) {
    merged.page = { ...merged.page, ...saved.page }
  }
  // 模块：按 saved 顺序重排，缺失的组件/字段用默认补全
  const byId = new Map(merged.modules.map((m) => [m.id, m]))
  const result: ModuleStyle[] = []
  for (const sm of saved.modules) {
    if (!sm || !sm.id) continue
    const base = byId.get(sm.id as ModuleId)
    if (!base) continue
    const combined: ModuleStyle = {
      ...base,
      ...sm,
      title: sm.title ? { ...base.title, ...sm.title, line: { ...base.title?.line, ...sm.title?.line } } : base.title,
      header: sm.header
        ? {
            ...base.header,
            ...sm.header,
            line: { ...base.header?.line, ...sm.header?.line },
            contactSeparator: { ...base.header?.contactSeparator, ...sm.header?.contactSeparator },
          }
        : base.header,
      entryHeader: sm.entryHeader
        ? {
            ...base.entryHeader,
            ...sm.entryHeader,
            textStyle: { ...base.entryHeader?.textStyle, ...sm.entryHeader?.textStyle },
            separator: { ...base.entryHeader?.separator, ...sm.entryHeader?.separator },
            dateStyle: { ...base.entryHeader?.dateStyle, ...sm.entryHeader?.dateStyle },
          }
        : base.entryHeader,
      list: sm.list ? { ...base.list, ...sm.list, text: { ...base.list?.text, ...sm.list?.text } } : base.list,
      textStyle: sm.textStyle ? { ...(base.textStyle || merged.modules[0] && undefined), ...sm.textStyle } as TextStyle : base.textStyle,
      dots: sm.dots ? { ...base.dots, ...sm.dots } : base.dots,
      fields: { ...base.fields, ...sm.fields },
    }
    // textStyle 兜底：base.textStyle 存在时以其为底
    if (sm.textStyle && base.textStyle) {
      combined.textStyle = { ...base.textStyle, ...sm.textStyle }
    }
    result.push(combined)
  }
  // 库中没有但默认存在的模块（新增模块向后兼容）追加到末尾（不可见）
  for (const base of merged.modules) {
    if (!result.find((r) => r.id === base.id)) {
      result.push({ ...base, visible: false })
    }
  }
  merged.modules = result
  return merged
}
