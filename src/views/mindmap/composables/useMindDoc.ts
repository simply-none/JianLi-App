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

import { DEFAULT_DOC_NAME, DEFAULT_ROOT_TEXT, MAX_NODE_TEXT_LEN, clampFontSize } from '../constants'
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
  normalizeFontFamily,
  normalizeFontSize,
  removeMany as removeManyInTree,
  removeNode,
  reparent as reparentInTree,
  setAllCollapsed,
  setCollapsedMany as setCollapsedManyInTree,
  setNodeBg as setBgInTree,
  setNodeBgMany as setBgManyInTree,
  setNodeColor as setColorInTree,
  setNodeColorMany as setColorManyInTree,
  setNodeIcon as setIconInTree,
  setNodeLink as setLinkInTree,
  setNodeNote as setNoteInTree,
  setNodePos as setPosInTree,
  setNodeTextColor as setTextColorInTree,
  setNodeTextColorMany as setTextColorManyInTree,
  toggleCollapsed,
  updateNodeText,
  type NavDirection,
} from '../utils/tree'
import { useMindHistory } from './useMindHistory'

/* ------------------------------------------------------------ 单例状态 */

const doc = ref<MindDocState>({ name: DEFAULT_DOC_NAME, data: createDocData(DEFAULT_ROOT_TEXT) })
/** 当前选中节点 id（空串 = 无选中）；多选时是**最后进入集合的那个**（主选中） */
const selectedId = ref('')
/**
 * 多选集合（框选 / Shift+拖拽产生）。
 *
 * ⚠️ 不变式：**`selectedIds` 非空时必定包含 `selectedId`**，且 `selectedId` 是
 *    「最后加入集合的那个」—— 单选走 `select()`、多选走 `setSelection()`，
 *    两者都经 `syncPrimary()` 维护这条不变式。
 *    这条不变式让「节点选中环」「删除回落到父」「Tab 建子节点」这些既有逻辑
 *    （它们读 `selectedId`）在多选态下依然有确定的语义，不需要处处判空。
 *
 * ⚠️ Vue 的 `ref<Set>` 内部 `add/delete` **不会触发更新**：
 *    任何改动都必须**换一个新 Set** 再赋值（见 `setSelection`）。
 */
const selectedIds = ref<Set<string>>(new Set())
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
/** 文档级字体族（`undefined` = 跟随应用全局字体，节点不覆盖 `font-family`） */
const fontFamily = computed(() => doc.value.data.fontFamily)
/**
 * 文档级**基准字号**（已夹进 `[MIN_FONT_SIZE, MAX_FONT_SIZE]`；未设时即 `DEFAULT_FONT_SIZE`）。
 * 消费方（画布测量 / 节点渲染 / SVG 导出）一律读它，别再各自 `?? 13`。
 */
const fontSize = computed(() => clampFontSize(doc.value.data.fontSize))
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

/**
 * 提交一份新的**整份图数据** —— 给「树之外的文档级字段」用（布局方向 / 字体 / 字号）。
 *
 * 与 `commit(root)` 的分工：那个只换根节点（树操作走它），这个换整个 `data`。
 * 两者共用同一套「记一次历史快照 + `revision +1`」的约定，所以撤销粒度依旧只有
 * 这两个入口 —— 不会出现「某个文档级改动忘了入栈」。
 *
 * ⚠️ 调用方负责判「有没有真的变」，本函数只保证「换掉就是一次可撤销的改动」。
 */
function commitData(next: MindDocData): boolean {
  if (next === doc.value.data) return false
  history.record(doc.value.data)
  doc.value = { ...doc.value, data: next }
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
    syncPrimary(data.root.id)
  } else {
    // 选中的节点还在，但多选集合里可能有已被这一步删掉的 id ⇒ 收敛成单选
    syncPrimary(selectedId.value)
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
  syncPrimary(payload.data.root.id)
  editingId.value = ''
  history.clear()
  revision.value += 1
}

/** 新建空白文档 */
function newDoc(name = DEFAULT_DOC_NAME) {
  doc.value = { id: undefined, name, data: createDocData(DEFAULT_ROOT_TEXT, layout.value) }
  savedSnapshot.value = JSON.stringify(doc.value.data)
  syncPrimary(doc.value.data.root.id)
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
  commitData({ ...doc.value.data, layout: dir })
}

/**
 * 设置文档字体族（画布右上角「设置」）。
 *
 * @param family CSS `font-family` 值；传空串 / `'inherit'` / `undefined` = **跟随应用字体**
 *
 * 归一化统一交给 `utils/tree.ts` 的 `normalizeFontFamily`（与反序列化同一条规则，
 * 避免「UI 允许写入的值」与「库里读出来的值」两套判定漂移）。
 * 值没变时**直接返回 false**：否则每次点一下同名字体都会往撤销栈塞一条空历史。
 */
function setFontFamily(family?: string): boolean {
  const next = normalizeFontFamily(family)
  if ((doc.value.data.fontFamily ?? '') === (next ?? '')) return false
  const data: MindDocData = { ...doc.value.data }
  // 清除时**删键**而不是写 undefined：落库 JSON 保持干净，与老数据同形
  if (next) data.fontFamily = next
  else delete data.fontFamily
  return commitData(data)
}

/**
 * 设置文档**基准字号**（全图统一；根 / 一级按固定增量跟随，见 `constants.fontSizeOf`）。
 *
 * @param size 基准字号（px）；传 `undefined` = 回到默认值（清除字段）
 *
 * 越界会被 `normalizeFontSize` → `clampFontSize` 夹回 `[MIN, MAX]`；
 * 与当前**有效**值相同则不写（`undefined` 按 `DEFAULT_FONT_SIZE` 比较）——
 * 于是「拖到 13 又拖回来」不会产生两笔无意义的历史。
 */
function setFontSize(size?: number): boolean {
  const current = clampFontSize(doc.value.data.fontSize)
  const next = normalizeFontSize(size)
  if ((next === undefined ? clampFontSize(undefined) : next) === current) return false
  const data: MindDocData = { ...doc.value.data }
  if (next === undefined) delete data.fontSize
  else data.fontSize = next
  return commitData(data)
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

/**
 * 把「主选中 = 最后进入集合的那个」这条不变式落在一处。
 * 所有直接改 `selectedId` 的地方都必须走它，否则多选集合会残留旧 id。
 */
function syncPrimary(id: string) {
  selectedId.value = id
  selectedIds.value = id ? new Set([id]) : new Set()
}

function select(id: string) {
  if (!id) return
  if (selectedId.value === id && selectedIds.value.size === 1) return
  syncPrimary(id)
}

function clearSelection() {
  if (!selectedId.value && !selectedIds.value.size) return
  selectedId.value = ''
  selectedIds.value = new Set()
}

/**
 * 设置多选集合（框选落点 / 批量操作前的准备）。
 *
 * 传空数组 = 清空选中。集合里的重复项会被去掉；不存在于树上的 id 也会被剔除 ——
 * 否则「删除回落到父」这类逻辑会拿着一个悬空 id 找不到落点。
 */
function setSelection(ids: string[]) {
  const root = doc.value.data.root
  const unique: string[] = []
  for (const id of ids) {
    if (!id || unique.includes(id)) continue
    if (!findNode(root, id)) continue
    unique.push(id)
  }
  selectedIds.value = new Set(unique)
  selectedId.value = unique.length ? unique[unique.length - 1] : ''
}

/** 当前选中的 id 列表（数组形态，批量操作用） */
function selectionList(): string[] {
  return [...selectedIds.value]
}

function beginEdit(id: string) {
  if (!findNode(doc.value.data.root, id)) return
  syncPrimary(id)
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
  syncPrimary(child.id)
  editingId.value = child.id
  return child.id
}

/** 添加同级节点（根节点则退化为添加子节点），成功后选中新节点并进入编辑 */
function addSibling(siblingId?: string): string | undefined {
  const target = siblingId || selectedId.value || doc.value.data.root.id
  if (!findNode(doc.value.data.root, target)) return undefined
  const sibling = createNode()
  if (!commit(insertSibling(doc.value.data.root, target, sibling))) return undefined
  syncPrimary(sibling.id)
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
 * 设置节点图标（emoji）。空串 / 超长（> 4 码点）会被 `utils/tree.ts` 归一化丢弃，
 * 所以这里不做二次校验 —— 校验只有一份，免得两处规则漂移。
 */
function setNodeIcon(id: string, icon?: string): boolean {
  if (!findNode(doc.value.data.root, id)) return false
  return commit(setIconInTree(doc.value.data.root, id, icon))
}

/** 设置节点链接（只放行 http/https）；非法值视为清除 */
function setNodeLink(id: string, link?: string): boolean {
  if (!findNode(doc.value.data.root, id)) return false
  return commit(setLinkInTree(doc.value.data.root, id, link))
}

/* ------------------------------------------------------------ 批量变更 */

/**
 * 批量设置分支色 / 背景色 / 文字色（框选多选后由右键菜单调用）。
 *
 * 三者各自独立，互不干扰；每批都只走**一次 commit** ⇒ 一次 Ctrl+Z 全恢复。
 * ids 为空、或所有节点都已经是该色时，`utils/tree.ts` 会返回同引用 ⇒ 不产生空撤销步。
 */
function setColorMany(ids: string[], color?: MindBranchColor): boolean {
  return commit(setColorManyInTree(doc.value.data.root, ids, color))
}

function setBgMany(ids: string[], color?: MindColorKey): boolean {
  return commit(setBgManyInTree(doc.value.data.root, ids, color))
}

function setTextColorMany(ids: string[], color?: MindColorKey): boolean {
  return commit(setTextColorManyInTree(doc.value.data.root, ids, color))
}

/** 批量折叠 / 展开（框选后一次收起一整片） */
function setCollapsedMany(ids: string[], collapsed: boolean): boolean {
  return commit(setCollapsedManyInTree(doc.value.data.root, ids, collapsed))
}

/**
 * **换父**：把 `id` 整棵子树挂到 `newParentId` 下（拖放到别的节点上时触发）。
 *
 * 语义与边界全部在 `utils/tree.ts` 的 `reparent()` 里（防环、清 pos、展开新父），
 * 这里只负责「走 commit ⇒ 一步撤销」与「选中跟随被拖节点」。
 * 非法情形（根被拖 / 拖到自己后代）在树函数里返回同引用 ⇒ commit 短路 ⇒ 不产生空撤销步。
 */
function reparentById(id: string, newParentId: string): boolean {
  const changed = commit(reparentInTree(doc.value.data.root, id, newParentId))
  if (changed) syncPrimary(id)
  return changed
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
  syncPrimary(copy.id)
  return copy.id
}

/**
 * **复制为剪贴板快照**（不写树、不 commit，纯读）。
 *
 * 与 `duplicateById` 的区别：那个是「就地复制一个兄弟」，这个是「拿一份快照走」。
 * 快照本身也是 `cloneSubtree` 的产物（已换过 id），但**粘贴时会再克隆一次** ——
 * 于是同一份快照可以连贴多次，每次得到的副本 id 互不相交。
 */
function snapshotById(id: string): MindNode | undefined {
  const target = findNode(doc.value.data.root, id)
  return target ? cloneSubtree(target) : undefined
}

/**
 * 把一份子树快照粘贴为 `parentId` 的子节点（追加到末位）。
 *
 * - 每次都 `cloneSubtree` ⇒ 副本全是新 id，连贴多次互不干扰；
 * - 目标折叠时由 `insertChild` 顺手展开（与「新增同级」容纳父级的语义一致）；
 * - 走 `commit()` ⇒ 一次粘贴 = **一步撤销**；
 * - 粘贴后选中新节点，方便接着 Tab / 改名。
 *
 * @returns 新节点 id；父节点不存在 / 快照为空时返回 undefined（不产生空撤销步）
 */
function pasteChild(parentId: string, subtree: MindNode): string | undefined {
  const root = doc.value.data.root
  if (!subtree || !findNode(root, parentId)) return undefined
  const copy = cloneSubtree(subtree)
  if (!commit(insertChild(root, parentId, copy))) return undefined
  syncPrimary(copy.id)
  return copy.id
}

/** 剪贴板粘贴的落点：选中节点；没有选中则挂到根 */
function pasteTargetId(): string {
  const root = doc.value.data.root
  if (selectedId.value && findNode(root, selectedId.value)) return selectedId.value
  return root.id
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
  if (selectedId.value === id) syncPrimary(parent ? parent.id : doc.value.data.root.id)
  if (editingId.value === id) editingId.value = ''
  return true
}

/**
 * **批量删除**（框选多选后）。
 *
 * @returns 真实消失的节点数（含各自的子树）；一个都没删（例如只选了根）返回 0，
 *          调用方据此决定要不要提示「根节点不可删除」。
 *
 * 选中回落规则与单选一致（回落到父），多选全删则回落根 —— 关键是不能留悬空 id。
 * 只用**一次 commit** ⇒ 一次 Ctrl+Z 全部回来。
 */
function removeSelectionByIds(ids: string[]): number {
  const root = doc.value.data.root
  const removable = ids.filter(id => id && id !== root.id && Boolean(findNode(root, id)))
  if (!removable.length) return 0

  const before = new Set(collectAllIds(root))
  const fallback = findParent(root, removable[0])
  if (!commit(removeManyInTree(root, removable))) return 0

  const after = new Set(collectAllIds(doc.value.data.root))
  let removed = 0
  before.forEach(id => {
    if (!after.has(id)) removed += 1
  })
  if (removed) syncPrimary(fallback ? fallback.id : doc.value.data.root.id)
  return removed
}

/** 全树所有节点 id（不受折叠影响；顺序 = 深度优先） */
function collectAllIds(node: MindNode, out: string[] = []): string[] {
  out.push(node.id)
  node.children.forEach(child => collectAllIds(child, out))
  return out
}

/** 折叠 / 展开某节点 */
function toggleFold(id: string): boolean {
  return commit(toggleCollapsed(doc.value.data.root, id))
}

/**
 * 全树是否存在「可收起且当前展开」的节点。
 *
 * ⚠️ 必须把**根节点排除在外**：根永远 `collapsed=false`（折叠根会让整图只剩一个点）
 * 且通常必然有子节点 —— 一旦把根算进来，本判据会**恒为 true**，
 * 于是「全部」永远只走折叠分支、根本展不开（历史 bug，2026-10-01 修复）。
 */
function hasExpandedBranch(node: MindNode, isRoot = true): boolean {
  if (!isRoot && !node.collapsed && node.children.length) return true
  return node.children.some(child => hasExpandedBranch(child, false))
}

/** 是否存在处于折叠态的节点（供「展开全部」出现） */
function hasFoldedBranch(node: MindNode): boolean {
  if (node.collapsed) return true
  return node.children.some(hasFoldedBranch)
}

/**
 * 响应式：还有展开着的分支 ⇒ 工具条显示「折叠全部」。
 * 与 hasFolded 互斥（两者不会同时为真），共同驱动「二选一出现」。
 */
const hasExpanded = computed(() => hasExpandedBranch(doc.value.data.root))

/** 响应式：有被折叠的分支 ⇒ 工具条显示「展开全部」 */
const hasFolded = computed(() => hasFoldedBranch(doc.value.data.root))

/** 折叠全部（根节点永不折叠，否则整图只剩一个点） */
function collapseAll(): boolean {
  return commit(setAllCollapsed(doc.value.data.root, true))
}

/** 展开全部 */
function expandAll(): boolean {
  return commit(setAllCollapsed(doc.value.data.root, false))
}

/**
 * 折叠 / 展开全部的单键切换语义（快捷键 Ctrl+A 复用）。
 * 有展开分支 → 全部折叠；否则若有折叠分支 → 全部展开；
 * 两者都没有（扁平树，例如刚新建）→ 空操作，不写入无意义的历史。
 */
function toggleFoldAll(): boolean {
  if (hasExpanded.value) return collapseAll()
  if (hasFolded.value) return expandAll()
  return false
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
    syncPrimary(root.id)
    return true
  }
  const target = navTarget(root, selectedId.value, dir)
  if (!target) return false
  syncPrimary(target)
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
    // 文档级版式（字体 / 基准字号）
    fontFamily,
    fontSize,
    selectedId,
    selectedIds,
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
    // 折叠态（工具条「折叠全部 / 展开全部」互斥显示依据）
    hasExpanded,
    hasFolded,
    // 文档级
    replaceDoc,
    newDoc,
    markSaved,
    setName,
    setLayout,
    setFontFamily,
    setFontSize,
    // 撤销 / 重做
    undo,
    redo,
    // 选中 / 编辑
    select,
    clearSelection,
    setSelection,
    selectionList,
    beginEdit,
    endEdit,
    // 树操作
    addChild,
    addSibling,
    duplicateById,
    snapshotById,
    pasteChild,
    pasteTargetId,
    renameNode,
    setNodeNote,
    setNodeColor,
    setNodeBg,
    setNodeTextColor,
    setNodeIcon,
    setNodeLink,
    setColorMany,
    setBgMany,
    setTextColorMany,
    setCollapsedMany,
    setNodePos,
    resetPositions,
    reparentById,
    removeNodeById,
    removeSelectionByIds,
    toggleFold,
    toggleFoldAll,
    collapseAll,
    expandAll,
    revealNode,
    moveSelection,
    subtreeIds,
  }
}
