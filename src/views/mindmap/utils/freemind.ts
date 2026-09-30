/**
 * 思维导图 —— FreeMind 互转（`.mm`，纯 XML 单文件）。
 *
 * FreeMind 的格式比 OPML 多两样表达能力，正好对上我们的数据结构：
 *
 *   <map version="1.0.1">
 *     <node TEXT="根" FOLDED="true">
 *       <node TEXT="子"/>
 *       <richcontent TYPE="NOTE"><html><body><p>备注</p></body></html></richcontent>
 *     </node>
 *   </map>
 *
 *   TEXT    → 节点文本
 *   FOLDED  → 折叠态（可往返）
 *   richcontent(TYPE=NOTE) → 备注；读的时候只取 textContent，不解析里面的 HTML
 *
 * 刻意**不写 POSITION / COLOR / STYLE**：
 *   POSITION 是 FreeMind 自己的布局指令，我们本来就由布局算法现场算，
 *   写进去反而会和「导图以树为唯一真源」的原则打架（下次打开位置对不上）。
 */

import { MAX_NOTE_LEN, MIND_DOC_VERSION } from '../constants'
import type { MindDocData, MindLayoutDir, MindNode } from '../types'
import { createNode } from './tree'
import { attrOf, childElements, escapeXml, findElements, parseXml } from './xml'

/** 导入结果：树数据 + 可选文档名 */
export interface FreeMindImport {
  name?: string
  data: MindDocData
}

const FALLBACK_ROOT = '导入导图'

/* ------------------------------------------------------------------ 导出 */

/** 树 → FreeMind `.mm` 文本 */
export function treeToFreeMind(root: MindNode): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<map version="1.0.1">')
  pushNode(root, 1, lines)
  lines.push('</map>')
  return lines.join('\n')
}

function pushNode(node: MindNode, depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth)
  const text = escapeXml(node.text)
  const folded = node.collapsed && node.children.length ? ' FOLDED="true"' : ''
  const bodies: string[] = []
  for (const child of node.children) pushNode(child, depth + 1, bodies)
  const note = node.note?.trim()
  if (note) bodies.push(noteBlock(pad + '  ', note.slice(0, MAX_NOTE_LEN)))

  if (!bodies.length) {
    lines.push(`${pad}<node TEXT="${text}"${folded}/>`)
    return
  }
  lines.push(`${pad}<node TEXT="${text}"${folded}>`)
  lines.push(...bodies)
  lines.push(`${pad}</node>`)
}

/** FreeMind 的备注容器是 HTML 片段，按行拆成多个 `<p>` */
function noteBlock(pad: string, note: string): string {
  const paragraphs = note.split(/\r?\n/).map(line => `${pad}    <p>${escapeXml(line)}</p>`)
  return [
    `${pad}<richcontent TYPE="NOTE">`,
    `${pad}  <html>`,
    `${pad}    <body>`,
    ...paragraphs,
    `${pad}    </body>`,
    `${pad}  </html>`,
    `${pad}</richcontent>`,
  ].join('\n')
}

/* ------------------------------------------------------------------ 导入 */

/**
 * FreeMind `.mm` 文本 → 树。
 * @returns 解析失败或没有节点时返回 undefined
 */
export function freeMindToTree(text: string, fallbackLayout: MindLayoutDir = 'both'): FreeMindImport | undefined {
  const doc = parseXml(text)
  if (!doc) return undefined

  const map = findElements(doc, 'map')[0]
  if (!map) return undefined

  let roots = childElements(map, 'node')
  // 有些导出工具会把节点包一层（例如 <map><node>…</node></map> 之外还有包装），
  // 这里退一步在整篇里找节点，避免直接判死
  if (!roots.length) roots = findElements(map, 'node')
  if (!roots.length) return undefined

  const nodes = roots.map(nodeToMind)
  const root = nodes.length === 1 ? nodes[0] : createNode(FALLBACK_ROOT, nodes)

  // FreeMind 文件里没有「文档名」这一栏（文档名 = 文件名），所以不带 name 返回
  return { data: { version: MIND_DOC_VERSION, layout: fallbackLayout, root } }
}

/** 递归读一个 `<node>` */
function nodeToMind(element: Element): MindNode {
  const label = attrOf(element, 'TEXT')
  const children = childElements(element, 'node').map(nodeToMind)
  const node = createNode(label || '未命名', children)

  if (attrOf(element, 'FOLDED').toLowerCase() === 'true' && children.length) {
    node.collapsed = true
  }

  const note = readNote(element)
  if (note) node.note = note.slice(0, MAX_NOTE_LEN)
  return node
}

/** 从 `<richcontent TYPE="NOTE">` 取纯文本备注 */
function readNote(element: Element): string {
  for (const rich of childElements(element, 'richcontent')) {
    if (attrOf(rich, 'TYPE').toUpperCase() !== 'NOTE') continue
    const paragraphs = findElements(rich, 'p')
    const text = paragraphs.length
      ? paragraphs.map(item => item.textContent ?? '').join('\n')
      : rich.textContent ?? ''
    return text.replace(/\u00a0/g, ' ').trim()
  }
  return ''
}
