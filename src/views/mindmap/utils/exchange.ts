/**
 * 思维导图 —— JSON 交换文件（纯函数，不依赖 Vue / IPC）。
 *
 * 为什么要包一层外壳：直接把 `MindDocData` 吐出去也能读回来，但文件里
 * 没有任何「这是什么」的线索 —— 用户双击打不开，别人看一眼也不知道格式。
 * 外壳标注 `app / version / name / exportedAt`，导入时还能顺手把文档名带回来。
 *
 * 导入是**宽容**的：外壳缺失、外壳里字段不全、甚至直接给裸的 `MindDocData`，
 * 都能吃下；最终一律过 `normalizeDocData` 归一化（见 utils/tree.ts 的容错约定）。
 *
 * ⚠️ 但「宽容」不等于「来者不拒」：`normalizeDocData` 对垃圾输入会静默回落成
 *    一张只有根节点的空白图。若不做前置校验，导入一个毫不相关的 JSON 就会
 *    悄无声息地把当前导图清空 —— 所以这里先用 `looksLikeDocData` 挡一道。
 */

import moment from 'moment'

import { MIND_DOC_VERSION } from '../constants'
import type { MindDocData, MindLayoutDir } from '../types'
import { normalizeDocData } from './tree'

/** 交换文件的标识（导入时只用于识别，不做强制校验） */
export const EXCHANGE_APP = 'jianli-mindmap'

/** 交换文件结构 */
export interface MindExchangeFile {
  app: string
  version: number
  name: string
  exportedAt: string
  data: MindDocData
}

/** 解析结果：树数据 + 可选文档名 */
export interface ImportedMind {
  name?: string
  data: MindDocData
}

/* ------------------------------------------------------------------ 导出 */

/** 打包成交换文件文本（缩进 2 空格，方便用户自己看一眼、手改也无妨） */
export function buildExchangeJson(name: string, data: MindDocData): string {
  const payload: MindExchangeFile = {
    app: EXCHANGE_APP,
    version: MIND_DOC_VERSION,
    name,
    exportedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
    data,
  }
  return JSON.stringify(payload, null, 2)
}

/* ------------------------------------------------------------------ 导入 */

/** 这份东西像不像一份导图数据（不校验内部细节，细节交给 normalizeDocData） */
function looksLikeDocData(value: unknown): boolean {
  // 兼容「直接把 data 列原文 / 更早的字符串版本」粘进文件的情况
  if (typeof value === 'string') return value.trim().startsWith('{')
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const root = (value as Partial<MindDocData>).root
  return Boolean(root && typeof root === 'object')
}

/**
 * 解析交换文件。
 * @returns 无法识别为导图数据时返回 undefined（调用方据此报错，而不是静默清空当前图）
 */
export function parseExchangeJson(
  raw: string,
  fallbackLayout: MindLayoutDir = 'both',
): ImportedMind | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined

  const source = parsed as Partial<MindExchangeFile> & Partial<MindDocData>
  // 带外壳时取外壳里的 data，否则把整个对象当图数据（兼容裸导出）
  const payload = looksLikeDocData(source.data) ? source.data : parsed
  if (!looksLikeDocData(payload)) return undefined

  const name = typeof source.name === 'string' ? source.name.trim() : ''
  return { name: name || undefined, data: normalizeDocData(payload, fallbackLayout) }
}

/* -------------------------------------------------------------- 文件名 */

/** 把文档名洗成可用的文件名（替换非法字符、去掉结尾的点与空格、限长） */
export function sanitizeFileName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 60)
  return cleaned || fallback
}

/** 去掉导入文件的扩展名，用作新文档名（覆盖全部支持的导入格式） */
export function stripExt(fileName: string): string {
  return fileName.replace(/\.(mindmap\.)?(json|md|markdown|txt|opml|mm|xmind)$/i, '').trim()
}

/** `文档名.mindmap.json` */
export function jsonFileName(name: string): string {
  return `${sanitizeFileName(name, 'mindmap')}.mindmap.json`
}

/** `文档名.md` */
export function markdownFileName(name: string): string {
  return `${sanitizeFileName(name, 'mindmap')}.md`
}

/** `文档名.svg` */
export function svgFileName(name: string): string {
  return `${sanitizeFileName(name, 'mindmap')}.svg`
}

/** `文档名.png` */
export function pngFileName(name: string): string {
  return `${sanitizeFileName(name, 'mindmap')}.png`
}

/** `文档名.opml` */
export function opmlFileName(name: string): string {
  return `${sanitizeFileName(name, 'mindmap')}.opml`
}

/** `文档名.mm`（FreeMind 的固定后缀） */
export function freemindFileName(name: string): string {
  return `${sanitizeFileName(name, 'mindmap')}.mm`
}

/** `文档名.xmind` */
export function xmindFileName(name: string): string {
  return `${sanitizeFileName(name, 'mindmap')}.xmind`
}
