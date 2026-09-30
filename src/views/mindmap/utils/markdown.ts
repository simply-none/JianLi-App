/**
 * 思维导图 —— Markdown 大纲互转（纯函数，不依赖 Vue / IPC，可在 Node 里直接跑断言）。
 *
 * ## 导出格式：缩进无序列表
 *
 * ```
 * - 中心主题
 *   - 分支 A
 *     - 细节 a1
 *   - 分支 B
 * ```
 *
 * 每层 2 个空格，深度无上限 —— 比 `#` 标题（最多 6 层）更通用，
 * 幕布 / Workflowy / Obsidian 大纲 / Markmap 都能直接读，也方便手写。
 *
 * ## 导入：两条通道，按文档里有没有 `#` 标题行二选一
 *
 * - **有**标题行 → 标题模式：只认 `#` ~ `######`
 * - **没有**标题行 → 列表模式：只认 `-` / `*` / `+` 缩进列表，缩进宽度决定层级
 *
 * 刻意不做「标题 + 列表混排」的解析：混排时某个列表项到底属于上一级还是同级，
 * 全靠猜 —— 猜错了比不解析更让人困惑。宁可只取一种，行为可预期。
 *
 * ## 三条约定
 *
 * 1. **折叠态不参与交换**：Markdown 表达不了折叠，导出忽略、导入全展开。
 * 2. **备注与分支色不参与交换**：同上；要完整往返请用 JSON 导入导出。
 * 3. 行首的 `-` / `*` / `+` 导出时转义成 `\-` 等、导入时反转义，
 *    否则「以减号开头的文本」会被自己的解析器当成一个新的子节点。
 */

import { DEFAULT_CHILD_TEXT, DEFAULT_ROOT_TEXT } from '../constants'
import type { MindNode } from '../types'
import { createNode } from './tree'

/** 每层缩进宽度（导出用；导入时按文档里实际的最小缩进自适应） */
const INDENT = '  '

const HEADING = /^(#{1,6})\s+(.*)$/
const LIST_MARKER = /^(\s*)([-*+])\s+(.*)$/

/* ------------------------------------------------------------------ 转义 */

/** 导出：压平换行 + 给行首的列表符号加反斜杠 */
function escapeText(text: string): string {
  const flat = text.replace(/\r?\n/g, ' ').trim()
  return flat.replace(/^([-*+]\s)/, '\\$1')
}

/** 导入：还原 `\- ` 这类转义 */
function unescapeText(text: string): string {
  return text.replace(/^\\([-*+]\s)/, '$1').trim()
}

/* ------------------------------------------------------------------ 导出 */

/**
 * 树 → Markdown 大纲文本。
 * 折叠态的节点也会被导出（含其整棵子树）—— 导出的是**内容**，不是当前视图。
 */
export function treeToMarkdown(root: MindNode): string {
  const lines: string[] = []
  const walk = (node: MindNode, depth: number) => {
    lines.push(`${INDENT.repeat(depth)}- ${escapeText(node.text)}`)
    node.children.forEach(child => walk(child, depth + 1))
  }
  walk(root, 0)
  return lines.join('\n')
}

/* ------------------------------------------------------------------ 导入 */

/** 解析出的中间结构：层级 + 文本 */
interface OutlineItem {
  level: number
  text: string
}

/** 逐行解析成「层级 + 文本」序列；解析不出任何内容时返回空数组 */
function parseOutline(md: string): OutlineItem[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')

  // ---- 标题模式 ----
  const headings: OutlineItem[] = []
  for (const line of lines) {
    const matched = HEADING.exec(line)
    if (!matched) continue
    headings.push({ level: matched[1].length - 1, text: unescapeText(matched[2]) })
  }
  if (headings.length) return headings.filter(item => item.text)

  // ---- 列表模式（tab 先按 2 空格折算，这样 4 空格 / tab 混用的文件也能算对） ----
  const raw: { indent: number; text: string }[] = []
  for (const line of lines) {
    const matched = LIST_MARKER.exec(line.replace(/\t/g, INDENT))
    if (!matched) continue
    const text = unescapeText(matched[3])
    if (!text) continue
    raw.push({ indent: matched[1].length, text })
  }
  if (!raw.length) return []

  // 以「最小的非零缩进」为一个层级单位：有人用 2 空格、有人用 4 空格，都能正确分层
  const unit = raw.reduce(
    (min, item) => (item.indent > 0 && item.indent < min ? item.indent : min),
    Number.POSITIVE_INFINITY,
  )
  const step = Number.isFinite(unit) && unit > 0 ? unit : INDENT.length
  return raw.map(item => ({ level: Math.round(item.indent / step), text: item.text }))
}

/**
 * Markdown 大纲文本 → 树。
 *
 * - 层级整体下移，保证最小层级落到 0（`##` 开头的大纲也能正常读）；
 * - 层级跳跃（0 → 3）会被压到「父级 + 1」，保证结果永远是一棵合法的树；
 * - 解析出多个顶级节点时，自动套一个合成根 —— 因为一份导图只能有一个根。
 *
 * @param fallbackRootText 需要合成根时的根文本
 * @returns 解析失败（没有任何可用行）返回 undefined
 */
export function markdownToTree(
  md: string,
  fallbackRootText: string = DEFAULT_ROOT_TEXT,
): MindNode | undefined {
  const items = parseOutline(md)
  if (!items.length) return undefined

  const minLevel = items.reduce((min, item) => Math.min(min, item.level), items[0].level)
  const roots: MindNode[] = []
  const stack: { level: number; node: MindNode }[] = []

  for (const item of items) {
    const level = Math.max(0, item.level - minLevel)
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()

    const parent = stack[stack.length - 1]
    const node = createNode(item.text || DEFAULT_CHILD_TEXT, [])
    if (parent) parent.node.children.push(node)
    else roots.push(node)

    // 层级跳跃时按「父级 + 1」落位，后续行才挂得上
    stack.push({ level: parent ? Math.min(level, parent.level + 1) : 0, node })
  }

  if (roots.length === 1) return roots[0]
  return createNode(fallbackRootText.trim() || DEFAULT_ROOT_TEXT, roots)
}
