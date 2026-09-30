/**
 * 思维导图 —— 纯树操作（immutable）。
 *
 * 约定：
 * 1. **所有变更函数返回新树**，未受影响的子树按引用复用（结构共享），
 *    因此 `next === prev` 可用来判断「这次操作有没有真的改动」。
 * 2. 不依赖 Vue，可在 Node 里直接跑断言（见模块文档的验证小节）。
 * 3. 根节点不可被删除：`removeNode` 遇到根节点时原样返回，调用方需自行守卫。
 */

import {
  DEFAULT_CHILD_TEXT,
  DEFAULT_ROOT_TEXT,
  LAYOUT_DIR_VALUES,
  MAX_NOTE_LEN,
  MIND_COLOR_VALUES,
  MIND_DOC_VERSION,
} from '../constants'
import type {
  MindBranchColor,
  MindColorKey,
  MindDocData,
  MindFlatNode,
  MindLayoutDir,
  MindNode,
  MindPoint,
} from '../types'

/* ------------------------------------------------------------------ 工厂 */

let idSeed = 0

/** 生成节点 id：时间戳（36 进制）+ 自增序号，保证同一会话内不重复 */
export function createNodeId(): string {
  idSeed += 1
  return `n_${Date.now().toString(36)}_${idSeed.toString(36)}`
}

/** 新建节点 */
export function createNode(text: string = DEFAULT_CHILD_TEXT, children: MindNode[] = []): MindNode {
  return { id: createNodeId(), text, children }
}

/** 新建一份图数据 */
export function createDocData(rootText: string, layout: MindLayoutDir = 'both'): MindDocData {
  return {
    version: MIND_DOC_VERSION,
    layout,
    root: createNode(rootText, []),
  }
}

/**
 * 深拷贝一棵子树，并给**每个节点**生成全新 id（「复制节点」用）。
 *
 * 保留：文本 / 折叠态 / 备注 / 分支色 / 背景色 / 文字色；
 * 丢弃：`pos` —— 坐标是派生数据，复制出来的子树应该交回布局算法重新摆。
 *       若把坐标一起抄过来，副本会**严丝合缝地盖在原件上**（坐标逐个相同），
 *       看起来就像「右键没反应」。
 */
export function cloneSubtree(node: MindNode): MindNode {
  return {
    id: createNodeId(),
    text: node.text,
    children: node.children.map(cloneSubtree),
    collapsed: node.collapsed,
    note: node.note,
    color: node.color,
    bgColor: node.bgColor,
    textColor: node.textColor,
  }
}

/* ------------------------------------------------------------- 查询 / 遍历 */

/** 深度优先查找节点；未命中返回 undefined */
export function findNode(root: MindNode, id: string): MindNode | undefined {
  if (root.id === id) return root
  for (const child of root.children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return undefined
}

/** 从根到目标节点的路径（含两端）；未命中返回空数组 */
export function findPath(root: MindNode, id: string): MindNode[] {
  if (root.id === id) return [root]
  for (const child of root.children) {
    const sub = findPath(child, id)
    if (sub.length) return [root, ...sub]
  }
  return []
}

/** 父节点；根节点或无命中返回 undefined */
export function findParent(root: MindNode, id: string): MindNode | undefined {
  const path = findPath(root, id)
  return path.length >= 2 ? path[path.length - 2] : undefined
}

/** 节点深度：根 = 0；未命中返回 -1 */
export function levelOf(root: MindNode, id: string): number {
  return findPath(root, id).length - 1
}

/**
 * 平铺「可见树」：折叠节点的整棵子树被剪掉。
 * 返回顺序 = 渲染顺序（父在前、子随后），可直接用于建节点与边。
 */
export function flattenVisible(root: MindNode): MindFlatNode[] {
  const out: MindFlatNode[] = []
  const walk = (node: MindNode, parentId: string | undefined, level: number) => {
    out.push({ node, parentId, level })
    if (node.collapsed) return
    for (const child of node.children) walk(child, node.id, level + 1)
  }
  walk(root, undefined, 0)
  return out
}

/** 收集自身 + 全部后代的 id（**不受折叠影响**，用于删除、拖动整棵子树） */
export function collectSubtreeIds(root: MindNode, id: string): string[] {
  const target = findNode(root, id)
  if (!target) return []
  const ids: string[] = []
  const walk = (node: MindNode) => {
    ids.push(node.id)
    node.children.forEach(walk)
  }
  walk(target)
  return ids
}

/** 节点总数（不受折叠影响） */
export function countNodes(root: MindNode): number {
  return 1 + root.children.reduce((sum, child) => sum + countNodes(child), 0)
}

/** 是否存在可折叠的节点（= 根节点有子节点；有子节点的节点必然挂在根下面） */
export function hasCollapsible(root: MindNode): boolean {
  return root.children.length > 0
}

/**
 * 从根到目标节点的 id 路径（含两端）；未命中返回空数组。
 * 供搜索定位复用（要展开的正是 `path.slice(0, -1)` 这批祖先）。
 */
export function pathIds(root: MindNode, id: string): string[] {
  return findPath(root, id).map(node => node.id)
}

/* ------------------------------------------------------------------ 变更 */

/**
 * 用 `fn` 替换树中 id 匹配的节点。
 * `fn` 返回原引用时判定为「无改动」，会原样返回旧树（供上层短路）。
 */
export function replaceNode(
  root: MindNode,
  id: string,
  fn: (node: MindNode) => MindNode,
): MindNode {
  if (root.id === id) return fn(root)
  let changed = false
  const children = root.children.map(child => {
    const next = replaceNode(child, id, fn)
    if (next !== child) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

/** 改写节点文本 */
export function updateNodeText(root: MindNode, id: string, text: string): MindNode {
  return replaceNode(root, id, node => (node.text === text ? node : { ...node, text }))
}

/**
 * 改写节点备注。
 * 空白备注一律写成 `undefined`（而不是空串）—— 保证序列化后 JSON 里不残留无用字段，
 * 也让 `dirty` 判断不会因为「空串 vs 缺失」产生假阳性。
 */
export function setNodeNote(root: MindNode, id: string, note: string): MindNode {
  const sliced = note.slice(0, MAX_NOTE_LEN)
  const next = sliced.trim() ? sliced : undefined
  return replaceNode(root, id, node => (node.note === next ? node : { ...node, note: next }))
}

/** 设置分支色；传 undefined 表示清除，恢复为「继承父级」 */
export function setNodeColor(root: MindNode, id: string, color?: MindBranchColor): MindNode {
  return replaceNode(root, id, node => (node.color === color ? node : { ...node, color }))
}

/** 设置节点背景色；传 undefined 表示清除，恢复为「该层级的默认底色」 */
export function setNodeBg(root: MindNode, id: string, color?: MindColorKey): MindNode {
  return replaceNode(root, id, node => (node.bgColor === color ? node : { ...node, bgColor: color }))
}

/** 设置节点文字色；传 undefined 表示清除，恢复为「主题默认文字色」 */
export function setNodeTextColor(root: MindNode, id: string, color?: MindColorKey): MindNode {
  return replaceNode(root, id, node =>
    node.textColor === color ? node : { ...node, textColor: color },
  )
}

/**
 * 固定某个节点的手动坐标；传 undefined 表示恢复自动排版。
 *
 * 拖动结束时由 `useMindGraph` 调用。坐标只落在**被拖的那一个节点**上：
 * 它的后代由布局算法相对它摆放（所以拖父节点时子树会跟着走），
 * 数量上也只有真正被手动摆过的节点才占字段。
 */
export function setNodePos(root: MindNode, id: string, pos?: MindPoint): MindNode {
  return replaceNode(root, id, node => {
    // 未提供坐标 = 恢复自动：本来就没有 pos 时原样返回（引用不变，上层据此短路）
    if (!pos) {
      if (!node.pos) return node
      const { pos: _removed, ...rest } = node
      return rest
    }
    if (node.pos && node.pos.x === pos.x && node.pos.y === pos.y) return node
    return { ...node, pos: { x: pos.x, y: pos.y } }
  })
}

/** 递归清掉所有手动坐标（「整理布局」）。一个都没有时原样返回，避免产生无意义的撤销步 */
export function clearPositions(root: MindNode): MindNode {
  let changed = false
  const children = root.children.map(child => {
    const next = clearPositions(child)
    if (next !== child) changed = true
    return next
  })
  if (!root.pos) return changed ? { ...root, children } : root
  const { pos: _removed, ...rest } = root
  return { ...rest, children }
}

/** 手动固定过坐标的节点数（工具条据此决定「整理布局」是否可用） */
export function countFixedPositions(root: MindNode): number {
  return (
    (root.pos ? 1 : 0) + root.children.reduce((sum, child) => sum + countFixedPositions(child), 0)
  )
}

/** 切换折叠态（无子节点时不改） */
export function toggleCollapsed(root: MindNode, id: string): MindNode {
  return replaceNode(root, id, node =>
    node.children.length ? { ...node, collapsed: !node.collapsed } : node,
  )
}

/** 批量设置折叠态；根节点不折叠（否则整图只剩一个点） */
export function setAllCollapsed(root: MindNode, collapsed: boolean): MindNode {
  const walk = (node: MindNode, isRoot: boolean): MindNode => {
    const children = node.children.map(child => walk(child, false))
    const next = isRoot ? false : collapsed && node.children.length > 0
    return { ...node, children, collapsed: next || undefined }
  }
  return walk(root, true)
}

/**
 * 展开到目标节点：清掉 `id` 所有祖先的折叠标记。
 * 用于搜索定位 —— 命中的节点若被折叠藏起来，必须先把它这一路展开才看得见。
 * 没有祖先处于折叠态时原样返回（引用不变），调用方据此判定「没有真实改动」。
 */
export function expandTo(root: MindNode, id: string): MindNode {
  const path = findPath(root, id)
  if (path.length < 2) return root
  const ancestors = new Set(path.slice(0, -1).map(node => node.id))

  const walk = (node: MindNode): MindNode => {
    if (!ancestors.has(node.id)) return node
    let changed = false
    const children = node.children.map(child => {
      const rebuilt = walk(child)
      if (rebuilt !== child) changed = true
      return rebuilt
    })
    if (node.collapsed) return { ...node, collapsed: undefined, children }
    return changed ? { ...node, children } : node
  }

  return walk(root)
}

/** 在 parentId 下追加子节点 */
export function insertChild(root: MindNode, parentId: string, child: MindNode): MindNode {
  return replaceNode(root, parentId, node => ({ ...node, collapsed: undefined, children: [...node.children, child] }))
}

/** 在 siblingId 之后插入同级节点；siblingId 为根时退化为「追加子节点」 */
export function insertSibling(root: MindNode, siblingId: string, sibling: MindNode): MindNode {
  if (root.id === siblingId) {
    return { ...root, collapsed: undefined, children: [...root.children, sibling] }
  }
  const replaceIn = (node: MindNode): MindNode => {
    const index = node.children.findIndex(child => child.id === siblingId)
    if (index >= 0) {
      const children = [...node.children]
      children.splice(index + 1, 0, sibling)
      return { ...node, collapsed: undefined, children }
    }
    let changed = false
    const children = node.children.map(child => {
      const next = replaceIn(child)
      if (next !== child) changed = true
      return next
    })
    return changed ? { ...node, children } : node
  }
  return replaceIn(root)
}

/** 删除节点及其整棵子树；根节点不可删（原样返回） */
export function removeNode(root: MindNode, id: string): MindNode {
  if (root.id === id) return root
  const removeIn = (node: MindNode): MindNode => {
    const index = node.children.findIndex(child => child.id === id)
    if (index >= 0) {
      return { ...node, children: node.children.filter((_, i) => i !== index) }
    }
    let changed = false
    const children = node.children.map(child => {
      const next = removeIn(child)
      if (next !== child) changed = true
      return next
    })
    return changed ? { ...node, children } : node
  }
  return removeIn(root)
}

/* ------------------------------------------------------------ 方向键导航 */

export type NavDirection = 'prev' | 'next' | 'parent' | 'firstChild' | 'lastChild'

/**
 * 命中方向键的落点：返回目标节点 id，无可去之处返回 undefined。
 * - `prev/next`：兄弟间移动（**跳过被折叠隐藏的兄弟**，只看可见兄弟）
 * - `parent`：跳到父节点
 * - `firstChild/lastChild`：仅在展开且有子节点时有效
 */
export function navTarget(root: MindNode, id: string, dir: NavDirection): string | undefined {
  if (dir === 'parent') return findParent(root, id)?.id

  const self = findNode(root, id)
  if (!self) return undefined

  if (dir === 'firstChild' || dir === 'lastChild') {
    if (self.collapsed || !self.children.length) return undefined
    return dir === 'firstChild' ? self.children[0].id : self.children[self.children.length - 1].id
  }

  const parent = findParent(root, id)
  const siblings = parent ? parent.children : [root]
  const index = siblings.findIndex(item => item.id === id)
  if (index < 0) return undefined
  const targetIndex = dir === 'prev' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= siblings.length) return undefined
  return siblings[targetIndex].id
}

/* -------------------------------------------------------- 反序列化与校验 */

/** 是不是合法的布局方向（挡住手改 JSON 塞进来的脏值） */
function isLayoutDir(value: unknown): value is MindLayoutDir {
  return typeof value === 'string' && (LAYOUT_DIR_VALUES as string[]).includes(value)
}

/**
 * 归一化手动坐标：必须是 `{x, y}` 且两个都是**有限数值**。
 * 任何异常（缺字段 / 字符串 / NaN / Infinity / 数组）一律丢弃 ⇒ 该节点回到自动排版，
 * 而不是带着一个会把画布撑到无穷远的坐标。
 */
function normalizePos(raw: unknown): MindPoint | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const source = raw as Partial<MindPoint>
  if (!Number.isFinite(source.x) || !Number.isFinite(source.y)) return undefined
  return { x: source.x as number, y: source.y as number }
}

/** 是不是合法的主题色 key（分支色 / 背景色 / 文字色共用同一套校验） */
function isColorKey(value: unknown): value is MindColorKey {
  return typeof value === 'string' && (MIND_COLOR_VALUES as string[]).includes(value)
}

/**
 * 把数据库中读出的 JSON 归一化成合法图数据。
 * 脏数据（缺字段 / 类型不对 / 非对象）一律回落为「单根节点」的新图，不抛错。
 */
export function normalizeDocData(raw: unknown, fallbackLayout: MindLayoutDir = 'both'): MindDocData {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return createDocData(DEFAULT_ROOT_TEXT, fallbackLayout)
    }
  }
  if (!parsed || typeof parsed !== 'object') return createDocData(DEFAULT_ROOT_TEXT, fallbackLayout)

  const source = parsed as Partial<MindDocData>
  const layout: MindLayoutDir = isLayoutDir(source.layout) ? source.layout : fallbackLayout
  const root = normalizeNode(source.root)
  if (!root) return createDocData(DEFAULT_ROOT_TEXT, layout)
  return { version: MIND_DOC_VERSION, layout, root }
}

/** 递归归一化单个节点（见 normalizeDocData 的容错约定） */
function normalizeNode(raw: unknown): MindNode | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<MindNode>
  const id = typeof source.id === 'string' && source.id ? source.id : createNodeId()
  const text = typeof source.text === 'string' ? source.text : ''
  const children = Array.isArray(source.children)
    ? source.children.map(normalizeNode).filter((item): item is MindNode => Boolean(item))
    : []
  // 备注与三类颜色都是可选的：非法值一律丢弃（而不是回落成空串 / 默认色），
  // 否则「导入别人手改的 JSON」会把莫名其妙的默认值写进库里
  const note =
    typeof source.note === 'string' && source.note.trim()
      ? source.note.slice(0, MAX_NOTE_LEN)
      : undefined
  const color = isColorKey(source.color) ? source.color : undefined
  const bgColor = isColorKey(source.bgColor) ? source.bgColor : undefined
  const textColor = isColorKey(source.textColor) ? source.textColor : undefined
  // 手动坐标同为可选：非法值丢弃（回到自动排版），而不是回落成 (0,0) —— 那会把节点钉在原点
  const pos = normalizePos(source.pos)
  return {
    id,
    text,
    children,
    collapsed: source.collapsed === true ? true : undefined,
    note,
    color,
    bgColor,
    textColor,
    pos,
  }
}
