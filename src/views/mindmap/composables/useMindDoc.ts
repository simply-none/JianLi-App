/**
 * 思维导图 —— 文档状态（模块级单例 composable）。
 *
 * 为什么用模块级单例：一份导图的状态要被「工具条 / 画布 / 节点 / 快捷键」多处共享，
 * 而页面自身是单实例的。用单例可以避免层层 provide/inject，
 * 且路由切走再回来时状态仍在（体验上更接近「回到工作现场」）。
 *
 * ⚠️ 返回的 refs 全部**绑定到单例本体**（直接返回 `doc` / `computed(...)`），
 * 绝不能写成 `ref(doc.value.xxx)` —— 那是取值拷贝，会静默失效（本项目已踩过）。
 *
 * 变更模型：所有树操作都是 **immutable** 的（见 `utils/tree.ts`），
 * 每次真实改动都会整体替换 `doc.value` 并把 `revision` +1；
 * 画布只监听 `revision`（便宜的浅值）来决定何时重排，**不对整棵树做 deep watch**。
 *
 * 撤销重做：`commit()` 是唯一的写入口，因此快照埋点只在 commit 里写一次
 * （外加 setLayout —— 它不走 commit 但同样该可撤销）。
 * 打开 / 新建 / 导入文档一律清空历史，避免 Ctrl+Z 撤进上一份文档。
 */

import { computed, ref } from 'vue'

import { DEFAULT_DOC_NAME, DEFAULT_ROOT_TEXT, MAX_NODE_TEXT_LEN } from '../constants'
import type {
  MindBranchColor,
  MindColorKey,
  MindDocData,
  MindDocState,
  MindLayoutDir,
  MindNode,
  MindPoint,
} from '../types'
import {
  clearPositions,
  cloneSubtree,
  collectSubtreeIds,
  countFixedPositions,
  createDocData,
  createNode,
  expandTo,
  findNode,
  findParent,
  insertChild,
  insertSibling,
  navTarget,
  removeNode,
  setAllCollapsed,
  setNodeBg as setBgInTree,
  setNodeColor as setColorInTree,
  setNodeNote as setNoteInTree,
  setNodePos as setPosInTree,
  setNodeTextColor as setTextColorInTree,
  toggleCollapsed,
  updateNodeText,
  type NavDirection,
} from '../utils/tree'
import { useMindHistory } from './useMindHistory'

/* ------------------------------------------------------------ 单例状态 */

const doc = ref<MindDocState>({ name: DEFAULT_DOC_NAME, data: createDocData(DEFAULT_ROOT_TEXT) })
/** 当前选中节点 id（空串 = 无选中） */
const selectedId = ref('')
/** 正在内联编辑的节点 id（画布据此临时关闭 deleteKeyCode） */
const editingId = ref('')
/** 结构版本号：任何真实改动 +1，画布据此触发重排 */
const revision = ref(0)
/** 是否已从数据库载入过（模块级单例 -> 整个会话只自动载入一次） */
const loadedFromDb = ref(false)
/** 最近一次「保存 / 载入」时的树快照，用于判断脏标记 */
const savedSnapshot = ref(JSON.stringify(doc.value.data))

/** 撤销栈（模块级单例即可，不需要每次 useMindDoc 都新建一遍 computed） */
const history = useMindHistory()

/* ------------------------------------------------------------ 派生状态 */

const tree = computed(() => doc.value.data.root)
const layout = computed(() => doc.value.data.layout)
const nodeCount = computed(() => countVisible(doc.value.data.root))
const selectedNode = computed(() => findNode(doc.value.data.root, selectedId.value))
const dirty = computed(() => JSON.stringify(doc.value.data) !== savedSnapshot.value)
/** 手动固定过坐标的节点数（> 0 才允许「整理布局」） */
const fixedPositionCount = computed(() => countFixedPositions(doc.value.data.root))
const canUndo = history.canUndo
const canRedo = history.canRedo
const historyDepth = history.depth

/** 可见节点数（折叠的子树不计），用于状态栏展示 */
function countVisible(node: MindNode): number {
  if (node.collapsed) return 1
  return 1 + node.children.reduce((sum, child) => sum + countVisible(child), 0)
}

/* ------------------------------------------------------------ 内部工具 */

/**
 * 提交新根节点：真实改动才替换状态、记一次撤销快照、并把 revision +1。
 *
 * 这是**唯一的树写入口** —— 所有树操作都从这里过，
 * 所以「撤销粒度」只需要在这里定义一次，不会出现某个操作忘了入栈的情况。
 */
function commit(nextRoot: MindNode): boolean {
  if (nextRoot === doc.value.data.root) return false
  history.record(doc.value.data)
  doc.value = { ...doc.value, data: { ...doc.value.data, root: nextRoot } }
  revision.value += 1
  return true
}

/** 归一化待写入的文本：裁剪长度，空串回退为原文本（避免出现不可见节点） */
function sanitizeText(text: string, fallback: string): string {
  const trimmed = text.replace(/\r?\n/g, ' ').slice(0, MAX_NODE_TEXT_LEN)
  return trimmed.trim() ? trimmed : fallback
}

/**
 * 用一份整体快照替换当前图数据（撤销 / 重做专用）。
 * 选中节点可能已被那一步删掉，此时回落到根节点 —— 而不是留一个悬空 id，
 * 否则之后按 Tab 会「什么都没发生」，很难解释。
 */
function applyData(data: MindDocData) {
  doc.value = { ...doc.value, data }
  if (!selectedId.value || !findNode(data.root, selectedId.value)) {
    selectedId.value = data.root.id
  }
  editingId.value = ''
  revision.value += 1
}

/* -------------------------------------------------------------- 文档级 */

/** 载入数据库记录（由 useMindPersist / useMindTransfer 调用） */
function replaceDoc(payload: { id?: number; name: string; data: MindDocData }) {
  doc.value = { id: payload.id, name: payload.name, data: payload.data }
  savedSnapshot.value = JSON.stringify(payload.data)
  loadedFromDb.value = true
  selectedId.value = payload.data.root.id
  editingId.value = ''
  history.clear()
  revision.value += 1
}

/** 新建空白文档 */
function newDoc(name = DEFAULT_DOC_NAME) {
  doc.value = { id: undefined, name, data: createDocData(DEFAULT_ROOT_TEXT, layout.value) }
  savedSnapshot.value = JSON.stringify(doc.value.data)
  selectedId.value = doc.value.data.root.id
  editingId.value = ''
  history.clear()
  revision.value += 1
}

/** 保存成功后打快照（清脏标记） */
function markSaved(id?: number) {
  savedSnapshot.value = JSON.stringify(doc.value.data)
  if (typeof id === 'number') doc.value = { ...doc.value, id }
}

function setName(name: string) {
  const next = name.trim() || DEFAULT_DOC_NAME
  if (next === doc.value.name) return
  doc.value = { ...doc.value, name: next }
}

/**
 * 切换布局方向（只改渲染参数，**不动树结构**）。
 * 同样记一次撤销快照 —— 换错方向后按 Ctrl+Z 回得来，符合直觉。
 */
function setLayout(dir: MindLayoutDir) {
  if (doc.value.data.layout === dir) return
  history.record(doc.value.data)
  doc.value = { ...doc.value, data: { ...doc.value.data, layout: dir } }
  revision.value += 1
}

/* ---------------------------------------------------------- 撤销与重做 */

/** 撤销一步；无历史时返回 false（供 UI 短路，不弹提示） */
function undo(): boolean {
  const snapshot = history.undo(doc.value.data)
  if (!snapshot) return false
  applyData(snapshot)
  return true
}

/** 重做一步；无历史时返回 false */
function redo(): boolean {
  const snapshot = history.redo(doc.value.data)
  if (!snapshot) return false
  applyData(snapshot)
  return true
}

/* ---------------------------------------------------------- 选中与编辑 */

function select(id: string) {
  if (selectedId.value === id) return
  selectedId.value = id
}

function clearSelection() {
  selectedId.value = ''
}

function beginEdit(id: string) {
  if (!findNode(doc.value.data.root, id)) return
  selectedId.value = id
  editingId.value = id
}

function endEdit() {
  editingId.value = ''
}

/* -------------------------------------------------------------- 树操作 */

/** 为某节点添加子节点（默认作用于当前选中节点），成功后选中新节点并进入编辑 */
function addChild(parentId?: string): string | undefined {
  const target = parentId || selectedId.value || doc.value.data.root.id
  if (!findNode(doc.value.data.root, target)) return undefined
  const child = createNode()
  if (!commit(insertChild(doc.value.data.root, target, child))) return undefined
  selectedId.value = child.id
  editingId.value = child.id
  return child.id
}

/** 添加同级节点（根节点则退化为添加子节点），成功后选中新节点并进入编辑 */
function addSibling(siblingId?: string): string | undefined {
  const target = siblingId || selectedId.value || doc.value.data.root.id
  if (!findNode(doc.value.data.root, target)) return undefined
  const sibling = createNode()
  if (!commit(insertSibling(doc.value.data.root, target, sibling))) return undefined
  selectedId.value = sibling.id
  editingId.value = sibling.id
  return sibling.id
}

/** 改写节点文本 */
function renameNode(id: string, text: string): boolean {
  const node = findNode(doc.value.data.root, id)
  if (!node) return false
  return commit(updateNodeText(doc.value.data.root, id, sanitizeText(text, node.text)))
}

/**
 * 改写节点备注（不进内联编辑，由「节点属性」弹窗调用）。
 * 空串 = 删除备注，见 utils/tree.ts 的 setNodeNote。
 */
function setNodeNote(id: string, note: string): boolean {
  if (!findNode(doc.value.data.root, id)) return false
  return commit(setNoteInTree(doc.value.data.root, id, note))
}

/** 设置 / 清除节点分支色（传 undefined = 清除，恢复继承父级） */
function setNodeColor(id: string, color?: MindBranchColor): boolean {
  if (!findNode(doc.value.data.root, id)) return false
  return commit(setColorInTree(doc.value.data.root, id, color))
}

/** 设置 / 清除节点背景色（传 undefined = 清除，回到该层级的默认底色） */
function setNodeBg(id: string, color?: MindColorKey): boolean {
  if (!findNode(doc.value.data.root, id)) return false
  return commit(setBgInTree(doc.value.data.root, id, color))
}

/** 设置 / 清除节点文字色（传 undefined = 清除，回到主题默认文字色） */
function setNodeTextColor(id: string, color?: MindColorKey): boolean {
  if (!findNode(doc.value.data.root, id)) return false
  return commit(setTextColorInTree(doc.value.data.root, id, color))
}

/**
 * 复制某个节点（连同整棵子树），副本插在原节点之后并成为新的选中节点。
 *
 * 根节点的语义退化为「把整棵树复制一份挂到根下」—— 与 `insertSibling`
 * 对根节点的处理保持一致（根没有同级）。
 *
 * 副本不带 `pos`（见 `cloneSubtree`），所以它会由布局算法重新摆到旁边，
 * 不会盖住原件。走 `commit()` ⇒ 可 Ctrl+Z 撤销。
 *
 * @returns 新节点的 id；节点不存在或没有真实改动时返回 undefined
 */
function duplicateById(id: string): string | undefined {
  const root = doc.value.data.root
  const target = findNode(root, id)
  if (!target) return undefined
  const copy = cloneSubtree(target)
  if (!commit(insertSibling(root, id, copy))) return undefined
  selectedId.value = copy.id
  return copy.id
}

/**
 * 固定某节点的手动坐标；传 undefined 表示恢复自动排版。
 *
 * 由画布在**拖动结束**时调用（不是在拖动过程中 —— 中间态不进历史，也不反复触发重排）。
 * 走 `commit()` 意味着它**可撤销**：拖歪了按 Ctrl+Z 就能回原位。
 * 这也推翻了 P1 时「拖动不进撤销栈」的旧约定 —— 那时坐标只是派生数据，
 * 取消拖动本来就不留痕迹；现在坐标会落库，把它排除在撤销之外反而不符合直觉。
 */
function setNodePos(id: string, pos?: MindPoint): boolean {
  if (!findNode(doc.value.data.root, id)) return false
  return commit(setPosInTree(doc.value.data.root, id, pos))
}

/** 清掉全部手动坐标，回到纯自动排版（「整理布局」）；本来就没有时返回 false */
function resetPositions(): boolean {
  return commit(clearPositions(doc.value.data.root))
}

/** 删除节点及其整棵子树；根节点不可删（返回 false 供 UI 提示） */
function removeNodeById(id: string): boolean {
  if (id === doc.value.data.root.id) return false
  const parent = findParent(doc.value.data.root, id)
  if (!commit(removeNode(doc.value.data.root, id))) return false
  if (selectedId.value === id) selectedId.value = parent ? parent.id : doc.value.data.root.id
  if (editingId.value === id) editingId.value = ''
  return true
}

/** 折叠 / 展开某节点 */
function toggleFold(id: string): boolean {
  return commit(toggleCollapsed(doc.value.data.root, id))
}

/**
 * 折叠 / 展开全部。
 * 语义是「切换」：当前只要有任一节点展开着，就全部折叠；否则全部展开。
 */
function toggleFoldAll() {
  const root = doc.value.data.root
  commit(setAllCollapsed(root, hasExpandedBranch(root)))
}

function hasExpandedBranch(node: MindNode): boolean {
  if (!node.collapsed && node.children.length) return true
  return node.children.some(hasExpandedBranch)
}

/**
 * 展开到某节点的所有祖先（搜索定位用）。
 * 命中一个被折叠藏起来的节点时，必须先把它这一路展开，画布上才看得到。
 * @returns 是否有真实改动（没有祖先处于折叠态时返回 false）
 */
function revealNode(id: string): boolean {
  return commit(expandTo(doc.value.data.root, id))
}

/** 方向键在树上移动选中；无选中时落到根节点 */
function moveSelection(dir: NavDirection): boolean {
  const root = doc.value.data.root
  if (!selectedId.value || !findNode(root, selectedId.value)) {
    selectedId.value = root.id
    return true
  }
  const target = navTarget(root, selectedId.value, dir)
  if (!target) return false
  selectedId.value = target
  return true
}

/** 某节点的整棵子树 id（含自身），供画布拖动整棵子树使用 */
function subtreeIds(id: string): string[] {
  return collectSubtreeIds(doc.value.data.root, id)
}

/* ------------------------------------------------------------------ 导出 */

export function useMindDoc() {
  return {
    // 状态（全部绑定单例）
    doc,
    tree,
    layout,
    selectedId,
    selectedNode,
    editingId,
    revision,
    nodeCount,
    fixedPositionCount,
    dirty,
    loadedFromDb,
    canUndo,
    canRedo,
    historyDepth,
    // 文档级
    replaceDoc,
    newDoc,
    markSaved,
    setName,
    setLayout,
    // 撤销 / 重做
    undo,
    redo,
    // 选中 / 编辑
    select,
    clearSelection,
    beginEdit,
    endEdit,
    // 树操作
    addChild,
    addSibling,
    duplicateById,
    renameNode,
    setNodeNote,
    setNodeColor,
    setNodeBg,
    setNodeTextColor,
    setNodePos,
    resetPositions,
    removeNodeById,
    toggleFold,
    toggleFoldAll,
    revealNode,
    moveSelection,
    subtreeIds,
  }
}
