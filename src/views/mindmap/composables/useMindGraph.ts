/**
 * 思维导图 —— 画布同步（树 ⇄ vue-flow）。
 *
 * 职责（**唯一持有 vue-flow 实例的地方是 MindCanvas，本文件只做数据变换**）：
 * 1. 把「树」编译成 vue-flow 的 nodes / edges（折叠节点的后代直接从数组里剔除，
 *    而不是用 `hidden: true` —— 这样 `fitView` 的包围盒天然不含隐藏节点）；
 * 2. **两段式布局**：先用「实测尺寸（有则用）或估算尺寸」排一遍 → 等画布量出真实尺寸
 *    → 再用实测尺寸排一遍。这是 vue-flow 这类「先渲染后测量」画布的必经之路，
 *    否则首帧所有节点尺寸都是 0，会全部叠在原点。
 * 3. 拖动节点时**带上整棵子树**（vue-flow 默认只移动被拖的那一个）。
 * 4. 把「分支色」按树向下继承后落到节点与连线上（节点上只存 key，颜色由 CSS 变量决定）。
 *
 * 关于拖动：被拖节点的坐标会在**松手时**写进 `node.pos`（见 types.ts），
 * 因此它是**持久化数据**、且可撤销（走 `useMindDoc.setNodePos` → `commit()`）。
 * 没有 pos 的节点仍然完全由 `utils/layout.ts` 自动决定 —— 所以加节点 / 折叠 / 换布局
 * 不会把手工摆过的位置冲掉，也不会让自动排版被一堆旧坐标绑住。
 * 想全部回到自动排版用「整理布局」（`useMindDoc.resetPositions`）。
 */

import { nextTick, ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import type { Edge, Node, NodeDragEvent } from '@vue-flow/core'

import { MINDMAP_FLOW_ID, branchVar, edgeHandles } from '../constants'
import { layoutTree } from '../utils/layout'
import { estimateSize } from '../utils/measure'
import { flattenVisible } from '../utils/tree'
import type { MindBranchColor, MindNode, MindSide, MindSize } from '../types'
import { useMindDoc } from './useMindDoc'

/** 等实测尺寸的最长时间（ms）：超时就用估算值先排着，下次同步会自然修正 */
const MEASURE_TIMEOUT = 320

/** 定位到某节点时的缩放区间（缩太小看不清、放太大容易晕） */
const FOCUS_MIN_ZOOM = 0.8
const FOCUS_MAX_ZOOM = 1.4

export function useMindGraph() {
  const doc = useMindDoc()
  const {
    setNodes,
    setEdges,
    findNode: findFlowNode,
    updateNodeInternals,
    fitView,
    setCenter,
    zoomIn,
    zoomOut,
    viewport,
  } = useVueFlow(MINDMAP_FLOW_ID)

  /** 由本模块产出的节点 / 边（**不作为 props 绑给 VueFlow**，避免与内部状态双写） */
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])

  /* ------------------------------------------------------------ 尺寸读取 */

  /** 画布实测尺寸；首帧尚未量出时返回 undefined */
  function measuredSize(id: string): MindSize | undefined {
    const dimensions = findFlowNode(id)?.dimensions
    if (!dimensions || !dimensions.width || !dimensions.height) return undefined
    return { width: dimensions.width, height: dimensions.height }
  }

  /* ---------------------------------------------------------- 分支色继承 */

  /**
   * 计算每个可见节点最终呈现的分支色：自身没设就继承父级，父级也没有就是 undefined。
   * 只在可见树上走一遍 —— 被折叠藏起来的子树不参与渲染，算了也没用。
   */
  function collectBranches(root: MindNode): Record<string, MindBranchColor | undefined> {
    const result: Record<string, MindBranchColor | undefined> = {}
    const walk = (node: MindNode, inherited?: MindBranchColor) => {
      const color = node.color ?? inherited
      result[node.id] = color
      if (node.collapsed) return
      node.children.forEach(child => walk(child, color))
    }
    walk(root)
    return result
  }

  /* ---------------------------------------------------------- 元素编译 */

  function buildElements() {
    const root = doc.tree.value
    const dir = doc.layout.value
    const flat = flattenVisible(root)
    const branches = collectBranches(root)
    const { positions, sides } = layoutTree(root, {
      direction: dir,
      measure: (node, level) => measuredSize(node.id) ?? estimateSize(node.text, level),
    })

    const nextNodes: Node[] = []
    const nextEdges: Edge[] = []

    for (const item of flat) {
      const node = item.node
      const side: MindSide = sides[node.id] ?? 'right'
      const branch = branches[node.id]
      nextNodes.push({
        id: node.id,
        type: 'mm',
        position: positions[node.id] ?? { x: 0, y: 0 },
        data: {
          text: node.text,
          level: item.level,
          side,
          dir,
          isRoot: !item.parentId,
          hasChildren: node.children.length > 0,
          collapsed: node.collapsed === true,
          branch,
          hasNote: Boolean(node.note),
        },
      })

      if (!item.parentId) continue
      const handles = edgeHandles(dir, side)
      nextEdges.push({
        id: `e_${item.parentId}__${node.id}`,
        source: item.parentId,
        target: node.id,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: 'default',
        // 边不参与选择 / 删除，避免误操作
        selectable: false,
        focusable: false,
        deletable: false,
        // 用 CSS 变量取色：SVG 的内联 stroke 同样能解析 var()，从而跟随主题；
        // 子节点带分支色时，连线跟着分支走，一眼能看出这条线属于哪一枝
        style: { stroke: branch ? branchVar(branch) : 'var(--mm-line)', strokeWidth: 1.5 },
      })
    }

    nodes.value = nextNodes
    edges.value = nextEdges
  }

  /* ------------------------------------------------------------ 尺寸等待 */

  /** 轮询直到所有节点都有了实测尺寸（或超时） */
  function waitForMeasured(ids: string[]): Promise<boolean> {
    return new Promise(resolve => {
      const startedAt = Date.now()
      const tick = () => {
        if (ids.every(id => Boolean(measuredSize(id)))) return resolve(true)
        if (Date.now() - startedAt > MEASURE_TIMEOUT) return resolve(false)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }

  /* -------------------------------------------------------------- 定位 */

  /**
   * 把画布平稳地移到某个节点上（搜索跳转用）。
   * 缩放取「当前缩放」并夹在 [0.8, 1.4] —— 而不是硬回到 100%：
   * 用户已经调好的视野手感不该被一次跳转重置。
   */
  async function centerOn(id: string) {
    const target = findFlowNode(id)
    if (!target) return
    const width = target.dimensions?.width ?? 0
    const height = target.dimensions?.height ?? 0
    const zoom = Math.min(Math.max(viewport.value?.zoom ?? 1, FOCUS_MIN_ZOOM), FOCUS_MAX_ZOOM)
    await setCenter(target.position.x + width / 2, target.position.y + height / 2, {
      zoom,
      duration: 260,
    })
  }

  /* ---------------------------------------------------------- 同步入口 */

  let syncToken = 0

  /**
   * 重排并刷新画布。
   * @param options.fit   结束后把画布适应到内容（切布局 / 首次载入时用）
   * @param options.focus 结束后把画布移到该节点；给了它就**不再** fitView
   *                      （搜索跳转时整体缩一遍会把刚定位到的节点又推走）
   */
  async function sync(options: { fit?: boolean; focus?: string } = {}) {
    const token = ++syncToken

    buildElements()
    setNodes(nodes.value)
    setEdges(edges.value)

    const ids = nodes.value.map(item => item.id)
    await nextTick()
    const measured = await waitForMeasured(ids)
    if (token !== syncToken) return // 期间又发起了新的同步，本次作废

    if (measured) {
      updateNodeInternals()
      buildElements()
      setNodes(nodes.value)
      setEdges(edges.value)
      await nextTick()
    }

    if (options.focus) await centerOn(options.focus)
    else if (options.fit) await fitView({ padding: 0.2, duration: 220 })
  }

  /* ------------------------------------------------------------ 拖动子树 */

  let dragSnapshot: { id: string; x: number; y: number; descendants: string[] } | null = null

  /**
   * 收集**已经被手动固定过坐标**的节点 id。
   * 拖动时的即时位移要跳过它们：布局算法会保持这些节点的绝对坐标不动，
   * 若这里也把它们推开，松手后就会被重排拉回来 —— 表现成一次可见的抖动。
   */
  function positionedIds(): Set<string> {
    const out = new Set<string>()
    const walk = (node: MindNode) => {
      if (node.pos) out.add(node.id)
      node.children.forEach(walk)
    }
    walk(doc.tree.value)
    return out
  }

  function onNodeDragStart({ node }: NodeDragEvent) {
    dragSnapshot = {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      descendants: doc.subtreeIds(node.id).filter(id => id !== node.id),
    }
  }

  /**
   * 拖动结束：先把「画布上的实际位置」同步进本模块的节点数组（即时反馈，避免
   * 下一帧被 setNodes 拽回原位），再把坐标**落进树**。
   *
   * 两者结果一致：布局算法把子节点**相对父节点**摆放，所以「父节点位移 (dx, dy)」
   * 等价于「整棵子树同比位移」（自身已固定的后代除外）——
   * 即下面这段手动位移与随后的自动重排是同一个答案。手动位移只是为了不留一帧空档。
   */
  function onNodeDragStop({ node }: NodeDragEvent) {
    const snapshot = dragSnapshot
    dragSnapshot = null
    if (!snapshot || snapshot.id !== node.id) return

    const dx = node.position.x - snapshot.x
    const dy = node.position.y - snapshot.y
    if (!dx && !dy) return

    const fixed = positionedIds()
    const followers = new Set(snapshot.descendants.filter(id => !fixed.has(id)))
    nodes.value = nodes.value.map(item => {
      if (item.id === node.id) {
        return { ...item, position: { x: node.position.x, y: node.position.y } }
      }
      if (followers.has(item.id)) {
        return {
          ...item,
          position: { x: item.position.x + dx, y: item.position.y + dy },
        }
      }
      return item
    })
    setNodes(nodes.value)

    // 落入树：只有被拖的这一个节点记坐标，后代由布局相对它摆放。
    // commit 会把 revision +1 ⇒ MindCanvas 触发一次重排，结果与上面的即时位移一致。
    doc.setNodePos(node.id, { x: node.position.x, y: node.position.y })
  }

  return {
    nodes,
    edges,
    sync,
    onNodeDragStart,
    onNodeDragStop,
    fitView,
    zoomIn,
    zoomOut,
  }
}
