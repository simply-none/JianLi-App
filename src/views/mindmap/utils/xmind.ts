/**
 * 思维导图 —— XMind 互转（`.xmind`）。
 *
 * `.xmind` 本质是一个 ZIP，里面装的是 JSON：
 *
 *   content.json   ← 真正的内容（顶层是「页(sheet)」数组，每页一个 rootTopic）
 *   metadata.json  ← 创建者信息
 *   manifest.json  ← 文件清单
 *
 * 所以**不需要引入任何 XMind 专用库**：项目里已经有 `jszip`，
 * 打包 / 解包各一行，格式映射全在下面这段纯数据变换里。
 *
 * 结构映射（XMind 2020+ / Zen 的 content.json）：
 *
 *   sheet.title             → 文档名
 *   rootTopic               → 根节点
 *   topic.title             → 节点文本
 *   topic.children.attached → 子节点数组
 *   topic.notes.plain.content → 备注
 *   topic.branch === 'folded' → 折叠态
 *
 * ⚠️ 范围：**只支持新版 `content.json`**（已与用户确认）。
 *    旧版 XMind 8 用的是 `content.xml`，这里刻意不做兼容 ——
 *    那种文件会被识别为「不是新版格式」并给出明确提示，而不是悄悄导出一张空图。
 */

import JSZip from 'jszip'

import { MAX_NOTE_LEN, MIND_DOC_VERSION } from '../constants'
import type { MindDocData, MindLayoutDir, MindNode } from '../types'
import { createNode } from './tree'
import { parseXml } from './xml'

/** 导入结果：树数据 + 可选文档名 */
export interface XmindImport {
  name?: string
  data: MindDocData
}

const CONTENT_FILE = 'content.json'
const MANIFEST_FILE = 'manifest.json'
const METADATA_FILE = 'metadata.json'
const FALLBACK_ROOT = '导入导图'

/* ---------------------------------------------------------------- XMind 类型 */

interface XmindNotes {
  plain?: { content?: string }
  html?: { content?: string }
}

interface XmindTopic {
  id?: string
  class?: string
  title?: string
  branch?: string
  notes?: XmindNotes
  children?: { attached?: XmindTopic[] }
}

interface XmindSheet {
  id?: string
  class?: string
  title?: string
  rootTopic?: XmindTopic
}

/* ------------------------------------------------------------------ 导出 */

let idSeed = 0

/** XMind 的 id 只是「同一文件内唯一」的字符串，用时间戳 + 序号 + 随机段即可 */
function xmindId(): string {
  idSeed += 1
  return `${Date.now().toString(36)}${idSeed.toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** 树 → `.xmind`（base64，交给 exportBufferToCache 落盘） */
export async function treeToXmind(root: MindNode, docName: string): Promise<string> {
  const sheet: XmindSheet = {
    id: xmindId(),
    class: 'sheet',
    title: docName,
    rootTopic: nodeToTopic(root),
  }

  const zip = new JSZip()
  zip.file(CONTENT_FILE, JSON.stringify([sheet]))
  zip.file(METADATA_FILE, JSON.stringify({ creator: { name: 'jianli-mindmap', version: String(MIND_DOC_VERSION) } }))
  zip.file(
    MANIFEST_FILE,
    JSON.stringify({ 'file-entries': { [CONTENT_FILE]: {}, [METADATA_FILE]: {} } }),
  )

  return zip.generateAsync({ type: 'base64' })
}

function nodeToTopic(node: MindNode): XmindTopic {
  const topic: XmindTopic = { id: xmindId(), class: 'topic', title: node.text }
  if (node.collapsed && node.children.length) topic.branch = 'folded'

  const note = node.note?.trim()
  if (note) topic.notes = { plain: { content: note.slice(0, MAX_NOTE_LEN) } }

  if (node.children.length) topic.children = { attached: node.children.map(nodeToTopic) }
  return topic
}

/* ------------------------------------------------------------------ 导入 */

/**
 * `.xmind` 二进制 → 树。
 * @param buffer 文件内容（ArrayBuffer；FileReader.readAsArrayBuffer 的产物）
 * @returns 不是合法 zip / 没有 content.json / 结构不符时返回 undefined
 */
export async function xmindToTree(
  buffer: ArrayBuffer,
  fallbackLayout: MindLayoutDir = 'both',
): Promise<XmindImport | undefined> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    return undefined
  }

  const file = zip.file(CONTENT_FILE)
  // 走到这里说明是旧版（content.xml）或根本不是 XMind —— 明确失败，不静默清空
  if (!file) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.async('string'))
  } catch {
    return undefined
  }

  const sheet = pickSheet(parsed)
  if (!sheet?.rootTopic) return undefined

  const root = topicToNode(sheet.rootTopic)
  if (!root) return undefined

  const title = typeof sheet.title === 'string' ? sheet.title.trim() : ''
  return {
    name: title && title !== FALLBACK_ROOT ? title : undefined,
    data: { version: MIND_DOC_VERSION, layout: fallbackLayout, root },
  }
}

/** 从 content.json 里挑出第一个带 rootTopic 的 sheet（兼容「对象 / 数组」两种外壳） */
function pickSheet(parsed: unknown): XmindSheet | undefined {
  if (Array.isArray(parsed)) {
    const hit = parsed.find(
      item => item && typeof item === 'object' && (item as XmindSheet).rootTopic,
    )
    return (hit as XmindSheet | undefined) ?? undefined
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as XmindSheet & { sheets?: XmindSheet[] }
    if (obj.rootTopic) return obj
    if (Array.isArray(obj.sheets)) return obj.sheets.find(item => item?.rootTopic)
  }
  return undefined
}

function topicToNode(topic: XmindTopic): MindNode | undefined {
  if (!topic || typeof topic !== 'object') return undefined

  const title = typeof topic.title === 'string' ? topic.title.trim() : ''
  const attached = topic.children?.attached
  const children = Array.isArray(attached)
    ? attached.map(topicToNode).filter((item): item is MindNode => Boolean(item))
    : []

  const node = createNode(title || '未命名', children)
  if (topic.branch === 'folded' && children.length) node.collapsed = true

  const note = readNote(topic)
  if (note) node.note = note.slice(0, MAX_NOTE_LEN)
  return node
}

/** 备注可能落在 `plain` 或 `html` 里，且内容常常是 HTML 片段 */
function readNote(topic: XmindTopic): string {
  const plain = topic.notes?.plain?.content
  if (typeof plain === 'string' && plain.trim()) return plainFromHtml(plain)
  const html = topic.notes?.html?.content
  if (typeof html === 'string' && html.trim()) return plainFromHtml(html)
  return ''
}

/**
 * 从（可能是 HTML 的）备注里取纯文本。
 * 先把块级结束标签换成换行，再交给 DOMParser 取 textContent；
 * 片段不是良构 XML 时退化成正则去标签。
 */
function plainFromHtml(value: string): string {
  const normalized = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
  const doc = parseXml(`<root>${normalized}</root>`)
  const text = doc ? doc.documentElement.textContent ?? '' : normalized.replace(/<[^>]*>/g, ' ')
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}
