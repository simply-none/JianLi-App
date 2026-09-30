/**
 * 思维导图 —— OPML 互转（纯函数，除解析外零依赖）。
 *
 * OPML 是「大纲」的通用交换格式（OmniOutliner / 幕布 / 语雀 等都能导入导出），
 * 结构简单到只剩一层 `<outline text="…">` 的嵌套：
 *
 *   <opml version="2.0">
 *     <head><title>文档名</title></head>
 *     <body>
 *       <outline text="根">
 *         <outline text="子" _note="备注"/>
 *       </outline>
 *     </body>
 *   </opml>
 *
 * 映射约定：
 *   text  → 节点文本
 *   _note → 节点备注（OPML 事实标准里的备注属性，可往返）
 *   嵌套  → 父子关系
 *
 * 容错：`<body>` 下有多个并列 `<outline>` 时，用 `<head><title>`（缺省则「导入大纲」）
 * 造一个合成根把它们兜起来 —— 导图必须有唯一根，而 OPML 允许多根。
 */

import { MAX_NOTE_LEN, MIND_DOC_VERSION } from '../constants'
import type { MindDocData, MindLayoutDir, MindNode } from '../types'
import { createNode } from './tree'
import { attrOf, childElements, escapeXml, findElements, parseXml } from './xml'

/** 导入结果：树数据 + 可选文档名 */
export interface OutlineImport {
  name?: string
  data: MindDocData
}

/** 合成根 / 兜底节点的默认文本 */
const FALLBACK_ROOT = '导入大纲'

/* ------------------------------------------------------------------ 导出 */

/** 树 → OPML 文本（缩进 2 空格，方便用户直接看） */
export function treeToOpml(root: MindNode, docName: string): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<opml version="2.0">')
  lines.push(`  <head><title>${escapeXml(docName)}</title></head>`)
  lines.push('  <body>')
  pushOutline(root, 2, lines)
  lines.push('  </body>')
  lines.push('</opml>')
  return lines.join('\n')
}

function pushOutline(node: MindNode, depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth)
  const text = escapeXml(node.text)
  const note = node.note?.trim()
    ? ` _note="${escapeXml(node.note.slice(0, MAX_NOTE_LEN))}"`
    : ''
  if (!node.children.length) {
    lines.push(`${pad}<outline text="${text}"${note}/>`)
    return
  }
  lines.push(`${pad}<outline text="${text}"${note}>`)
  for (const child of node.children) pushOutline(child, depth + 1, lines)
  lines.push(`${pad}</outline>`)
}

/* ------------------------------------------------------------------ 导入 */

/**
 * OPML 文本 → 树。
 * @returns 解析失败或没有任何 outline 时返回 undefined
 *          （**不能**回落成空白图，否则导入一个无关 XML 会静默清空当前导图）
 */
export function opmlToTree(text: string, fallbackLayout: MindLayoutDir = 'both'): OutlineImport | undefined {
  const doc = parseXml(text)
  if (!doc) return undefined

  const body = findElements(doc, 'body')[0]
  if (!body) return undefined

  const outlines = childElements(body, 'outline')
  if (!outlines.length) return undefined

  const name = readTitle(doc)
  const nodes = outlines.map(outlineToNode)
  const root =
    nodes.length === 1 ? nodes[0] : createNode(name || FALLBACK_ROOT, nodes)

  return {
    name: name || undefined,
    data: { version: MIND_DOC_VERSION, layout: fallbackLayout, root },
  }
}

/** `<head><title>` 文本；缺失返回空串 */
function readTitle(doc: Document): string {
  const title = findElements(doc, 'title')[0]
  return title?.textContent?.trim() ?? ''
}

/** 递归读一个 `<outline>` */
function outlineToNode(element: Element): MindNode {
  const label = attrOf(element, 'text') || attrOf(element, 'title')
  const children = childElements(element, 'outline').map(outlineToNode)
  const node = createNode(label || '未命名', children)
  const note = attrOf(element, '_note')
  if (note) node.note = note.slice(0, MAX_NOTE_LEN)
  return node
}
