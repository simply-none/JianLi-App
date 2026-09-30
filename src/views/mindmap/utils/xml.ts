/**
 * 思维导图 —— XML 小工具（OPML / FreeMind / 旧版 XMind 共用）。
 *
 * 之所以单独抽一层：这三种格式的解析逻辑几乎一样（DOMParser + 递归读子元素），
 * 各自实现一遍容易在「大小写、parsererror、命名空间前缀」这些细节上出现分歧。
 *
 * ⚠️ 解析一律走 `DOMParser`（浏览器内置），**不需要引入任何 XML 库**，
 *    也不需要主进程参与；`application/xml` 模式下解析失败**不会抛异常**，
 *    而是返回一份带 `<parsererror>` 的文档，所以必须显式检查。
 */

/** XML 文本与属性值转义（属性值由双引号包裹，因此引号也必须转） */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 解析 XML 字符串；失败（含 `<parsererror>`）返回 undefined */
export function parseXml(text: string): Document | undefined {
  if (typeof DOMParser === 'undefined') return undefined
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    if (!doc || doc.getElementsByTagName('parsererror').length) return undefined
    return doc
  } catch {
    return undefined
  }
}

/**
 * 按标签名取**后代**元素（大小写不敏感）。
 * 不用 `getElementsByTagName` 直接取：XML 文档里它是大小写敏感的，
 * 而这些格式（尤其 XMind）在不同版本里的大小写并不统一。
 */
export function findElements(root: Document | Element, tagName: string): Element[] {
  const all = root.getElementsByTagName('*')
  const wanted = tagName.toLowerCase()
  const out: Element[] = []
  for (let index = 0; index < all.length; index += 1) {
    const el = all[index]
    if (el.tagName.toLowerCase() === wanted) out.push(el)
  }
  return out
}

/**
 * 只看**直接子元素**（跳过文本节点 / 注释），可按标签名过滤。
 * ⚠️ 刻意不用 `parent.children`：它是 DOM4 的属性，浏览器有、但部分 XML 实现没有；
 *    走 `childNodes` + `nodeType === 1` 在哪儿都成立，也让这段逻辑能在 Node 里跑断言。
 */
export function childElements(parent: Element, tagName?: string): Element[] {
  const wanted = tagName?.toLowerCase()
  const out: Element[] = []
  const nodes = parent.childNodes
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.nodeType !== 1) continue
    const element = node as Element
    if (!wanted || element.tagName.toLowerCase() === wanted) out.push(element)
  }
  return out
}

/** 取属性值并裁掉首尾空白；缺失时返回空串 */
export function attrOf(element: Element, name: string): string {
  return (element.getAttribute(name) ?? '').trim()
}
