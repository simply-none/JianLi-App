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
import type { Edge, GraphNode, Node, NodeDragEvent } from '@vue-flow/core'

import { MINDMAP_FLOW_ID, branchVar, edgeHandles, isStraightEdge } from '../constants'
import { layoutTree } from '../utils/layout'
import { estimateSize } from '../utils/measure'
import { nearestRectId, pointInRect, type MindIdRect } from '../utils/geometry'
import { collectSubtreeIds, findNode, flattenVisible } from '../utils/tree'
import type {
  MindBranchColor,
  MindFlowNodeData,
  MindNode,
  MindPoint,
  MindSide,
  MindSize,
} from '../types'
import { useMindDoc } from './useMindDoc'
import { useMindView } from './useMindView'

/** 等实测尺寸的最长时间（ms）：超时就用估算值先排着，下次同步会自然修正 */
const MEASURE_TIMEOUT = 320

/** 定位到某节点时的缩放区间（缩太小看不清、放太大容易晕） */
const FOCUS_MIN_ZOOM = 0.8
const FOCUS_MAX_ZOOM = 1.4

export function useMindGraph() {
  const doc = useMindDoc()
  const view = useMindView()
  const {
    setNodes,
    setEdges,
    findNode: findFlowNode,
    getNodes,
    updateNodeInternals,
    screenToFlowCoordinate,
    fitView,
    setCenter,
    zoomIn,
    zoomOut,
    viewport,
  } = useVueFlow(MINDMAP_FLOW_ID)

  /** 由本模块产出的节点 / 边（**不作为 props 绑给 VueFlow**，避免与内部状态双写） */
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])

  /**
   * 拖动中当前命中的「换父候选」节点 id（空串 = 没有候选）。
   * ⚠️ 纯瞬时渲染状态：不进树、不落库、不进撤销栈，重排时由 `buildElements` 复活到 data 上。
   */
  let dropTargetId = ''
  /** 命中测试的节流闸（拖动事件非常密，每帧最多做一次） */
  let hitTestQueued = false

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
    // 分支聚焦：把聚焦子树当作整张图渲染（聚焦 id 失效时自动回落全图 —— 例如
    // 那个节点被删除、或撤销跨过了「进入聚焦之前」的那一步）
    const tree = doc.tree.value
    const focusId = view.focusRootId.value
    const root = (focusId && findNode(tree, focusId)) || tree
    const dir = doc.layout.value
    const flat = flattenVisible(root)
    const branches = collectBranches(root)
    const { positions, sides } = layoutTree(root, {
      direction: dir,
      // 基准字号必须与 `MindNode.vue` 内联的 font-size 同源（`doc.fontSize`）：
      // 否则改过字号之后，首帧估算与实测对不上，画布会先跳一下才稳。
      measure: (node, level) =>
        measuredSize(node.id) ?? estimateSize(node.text, level, node.icon, doc.fontSize.value),
    })

    const nextNodes: Node[] = []
    const nextEdges: Edge[] = []
    // 拖动换父的候选高亮是**瞬时状态**：重排不该把它带过去，这里统一以「本帧是否仍高亮」决定
    const highlighted = dropTargetId

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
          bg: node.bgColor,
          fg: node.textColor,
          icon: node.icon,
          link: node.link,
          hasLink: Boolean(node.link),
          hasNote: Boolean(node.note),
          dropTarget: highlighted === node.id,
        } satisfies MindFlowNodeData,
      })

      if (!item.parentId) continue
      const handles = edgeHandles(dir, side)
      nextEdges.push({
        id: `e_${item.parentId}__${node.id}`,
        source: item.parentId,
        target: node.id,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        // 鱼骨图的支骨是斜直线：用贝塞尔会把「骨」画弯，一眼就不像鱼骨了
        type: isStraightEdge(dir) ? 'straight' : 'default',
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

  /* ---------------------------------------------------- 画布几何（选择/命中） */

  /**
   * 画布上**当前所有可见节点**的矩形（画布坐标）。
   *
   * ⚠️ 必须走 `getNodes`（vue-flow store）而不是本模块的 `nodes`：
   *    只有 store 里的 `GraphNode` 带 `dimensions`，而 `nodes` 里的裸 `Node` 没有尺寸；
   *    另外 `position` 在拖动过程中只有 store 是实时的。
   *    （与 `useMindExport.buildSceneNodes` 同一条纪律，见坑 24。）
   */
  function visibleRects(): MindIdRect[] {
    const out: MindIdRect[] = []
    for (const item of getNodes.value as GraphNode[]) {
      const width = item.dimensions?.width ?? 0
      const height = item.dimensions?.height ?? 0
      if (!width || !height) continue
      out.push({
        id: item.id,
        rect: { x: item.position.x, y: item.position.y, width, height },
      })
    }
    return out
  }

  /**
   * 屏幕坐标 → 画布坐标。
   * 暴露给画布：双击空白处要先把鼠标位置换算成画布坐标才能找「最近的节点」。
   */
  function toFlowPoint(clientX: number, clientY: number): MindPoint {
    return screenToFlowCoordinate({ x: clientX, y: clientY })
  }

  /**
   * 离某个**画布坐标点**最近的可见节点 id（双击空白处「就近新建」用）。
   * 空画布（一个节点都没量出尺寸）返回 undefined，调用方据此回落到根节点。
   */
  function nearestNodeId(point: MindPoint, exclude?: ReadonlySet<string>): string | undefined {
    return nearestRectId(point, visibleRects(), exclude)
  }

  /* ---------------------------------------------------------- 同步入口 */

  let syncToken = 0
  /**
   * 重排并刷新画布。
   * @param options.fit   结束后把画布适应到内容（切布局 / 首次载入时用）
   * @param options.focus 结束后把画布移到该节点；给了它就**不再** fitView
   *                      （搜索跳转时整体缩一遍会把刚定位到的节点又推走）
   *
   * 两段式的理由：先按**当前已知尺寸**（估算或上一轮实测）排一遍把节点挂上画布，
   * 量出真实尺寸后再排第二遍。第二段里的 `updateNodeInternals()` 是不是「承重件」——
   * 见下（坑 54）。
   *
   * `waitForMeasured()` 的判据只是「**有没有**尺寸」，**不保证尺寸是新的**：
   *   · 全新节点：首帧 store 里没尺寸 ⇒ 它确实会等到量出来（这才是它真正在管的事）；
   *   · 尺寸变了的旧节点（如改字号）：store 里**旧尺寸**还在 ⇒ 第一个 rAF tick 就满足
   *     「有尺寸」，它立刻返回 —— 返回的是一个**陈旧值**。
   *
   * ⚠️ 但上面那个「陈旧值」**并不会把第二段排歪**。用真库实测过
   *   （`C:\src\tmp\mm_fontsync_test.cjs`：真 Vue + 真 vue-flow + 真 ResizeObserver）：
   *   改字号后，无论**松序**（先 await 再同步）还是**紧序**（改 ref 与同步落在同一次
   *   flush，贴近生产），探测点读到的 store 尺寸**已经是新值**。根因是「改字号」必然
   *   触发节点组件重渲染 ⇒ DOM 尺寸随之变化 ⇒ vue-flow 自带的 ResizeObserver 在同一
   *   帧内就把 store 刷成了新值 —— 这一步既不是 `waitForMeasured()` 做的，也不是下面
   *   那行 `updateNodeInternals()` 做的。
   *
   * 所以 `updateNodeInternals()` 在这里是**便宜的显式保险**，而非字号路径的承重件：
   * 它让 vue-flow 用 `offsetWidth/offsetHeight`（`forceUpdate: true`）**同步**重读一遍
   * DOM，专门兜住「节点 DOM 尺寸变了、却没走 Vue 重渲染」的将来场景（例如日后加个
   * 「改内边距 / 改最大宽度」的功能，直接改类名或行内样式，RO 未必已经回调）。
   * 删掉它当前任何功能都不会出错；留着它，是对那类改动的一层保护。
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
      // 同步重读 DOM 实测尺寸：守住「DOM 尺寸变了但没走重渲染」的场景（见上方注释）。
      // 注意字号 / 字体路径其实已由 vue-flow 自带的 ResizeObserver 在同一帧刷好了，
      // 这行只是便宜的显式保险，别当成「字号重排全靠它」。
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

  /**
   * 高亮「换父候选」节点（只改本次渲染的 data，不碰树）。
   *
   * 为什么要把变更**摊平到所有节点**而不是只改命中的那个：
   *   `setNodes` 收到的是新数组，只有被替换的节点对象才触发更新 ——
   *   上一帧的高亮必须显式清掉，否则会同时亮着两个。
   */
  function setDropTarget(id: string) {
    if (dropTargetId === id) return
    dropTargetId = id
    nodes.value = nodes.value.map(item => {
      const data = item.data as MindFlowNodeData
      const next = item.id === id
      if (Boolean(data.dropTarget) === next) return item
      return { ...item, data: { ...data, dropTarget: next } }
    })
    setNodes(nodes.value)
  }

  /**
   * 拖动中的命中测试：拿**被拖节点的矩形**去和别的可见节点矩形比对，
   * 命中谁谁就是「换父候选」。
   *
   * 排除三类节点（缺一条都会出问题）：
   *   · 自身；
   *   · **自身的全部后代** —— 唯一可靠的防环手段（光比 id 挡不住「挂到自己的孙子下」）；
   *   · 根节点 —— 根不能被换父（拖到根上等价于「挂到根下」，但那是根的子节点重排，
   *     语义上由「拖到空白的 pos 路径」承担；这里排除掉可以避免「拖到根上却看起来没反应」）。
   *
   * ⚠️ 节流：`onNodeDrag` 的触发频率远高于帧率，每帧最多算一次（rAF 合并）。
   */
  function hitTestOnDrag(node: Node) {
    if (hitTestQueued) return
    hitTestQueued = true
    requestAnimationFrame(() => {
      hitTestQueued = false
      const snapshot = dragSnapshot
      if (!snapshot) return
      const width = findFlowNode(node.id)?.dimensions?.width ?? 0
      const height = findFlowNode(node.id)?.dimensions?.height ?? 0
      const rect = {
        x: node.position.x,
        y: node.position.y,
        width: width || 1,
        height: height || 1,
      }
      const blocked = new Set([node.id, ...snapshot.descendants, doc.tree.value.id])
      // 用被拖节点的**中心点**做包含测试（不是左上角）：半挂在别的节点上时，
      // 中心点最能代表「我把它放到哪儿了」；左上角会让大节点的命中判定偏得离谱
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      // 取命中的候选里**层级最浅**的那个：拖到一片叠着的区域时，
      // 更靠上的父节点是更合理的落点（也让大图上的手感可预测）。
      // `visibleRects()` 的顺序就是树的先序（浅的先出现），所以取第一个即可。
      const hits = visibleRects().filter(
        item => !blocked.has(item.id) && pointInRect(center, item.rect),
      )
      setDropTarget(hits.length ? hits[0].id : '')
    })
  }

  function onNodeDragStart({ node }: NodeDragEvent) {
    dragSnapshot = {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      descendants: collectSubtreeIds(doc.tree.value, node.id).filter(id => id !== node.id),
    }
  }

  /** 拖动过程中：只做命中高亮，**不**在中间态改树 */
  function onNodeDrag({ node }: NodeDragEvent) {
    if (!dragSnapshot) return
    hitTestOnDrag(node)
  }

  /**
   * 拖动结束 —— **一个手势两种语义，靠落点区分**（不加修饰键）：
   *
   *   A. 落点命中了别的节点矩形 ⇒ **换父**（`reparentById`，一次 commit = 一步撤销）；
   *   B. 落在空白 ⇒ 维持结构、把坐标记进 `node.pos`（旧行为）。
   *
   * 两条路径**互斥**：换父时不再写 `pos`（`reparent` 还会顺手把旧 pos 清掉，
   * 让新位置交给布局算法），否则会同时留下「结构变了」和「位置也钉死了」两笔账，
   * 撤销时对不上。
   */
  function onNodeDragStop({ node }: NodeDragEvent) {
    const snapshot = dragSnapshot
    dragSnapshot = null
    const target = dropTargetId
    setDropTarget('')
    if (!snapshot || snapshot.id !== node.id) return

    /* ---- 路径 A：换父 ---- */
    if (target) {
      dragSnapshot = null
      doc.reparentById(node.id, target)
      return
    }

    /* ---- 路径 B：维持现状，记坐标 ---- */
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
    onNodeDrag,
    onNodeDragStop,
    toFlowPoint,
    visibleRects,
    nearestNodeId,
    fitView,
    zoomIn,
    zoomOut,
  }
}
