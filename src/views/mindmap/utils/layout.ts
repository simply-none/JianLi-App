/**
 * 思维导图 —— 树形布局算法（纯函数，自研，O(n)）。
 *
 * 为什么不用现成的：项目里的 `@dagrejs/dagre` 是**有向图分层**布局，
 * `rankdir` 只能单向推进，做不出思维导图的「根居中 + 子树左右分叉 +
 * 各节点尺寸不一」这三点。所以这里自己写。
 *
 * 两套算法，按方向分流：
 *
 * ① 水平类（`both` / `right` / `left`）—— 层级沿 x 推进、兄弟沿 y 堆叠
 *    第 1 趟：子树高度 `subtreeH(n) = max(自身高, Σ 子树高 + 兄弟间距 ×(n-1))`
 *    第 2 趟：父先落位，子节点按各自子树高度**垂直居中堆叠**；
 *            右侧子 `x = 父右边缘 + 间距`，左侧镜像 `x = 父左边缘 - 子宽 - 间距`
 *
 * ② 垂直类（`down`）—— 层级沿 y 推进、兄弟沿 x 堆叠（组织结构图）
 *    第 1 趟：子树宽度 `subtreeW(n) = max(自身宽, Σ 子树宽 + 兄弟间距 ×(n-1))`
 *    第 2 趟：父先落位，子节点按各自子树宽度**水平居中堆叠**；
 *            子 `y = 父下边缘 + 层级间距`
 *
 * 坐标默认是函数的返回值，**不落库**（树的语义结构才是唯一真源）。
 * 唯一的例外：节点若带 `pos`（用户手动拖过，见 types.ts），该坐标**优先于算法结果**，
 * 且它的子节点改为**相对它**摆放 —— 于是拖动父节点时整棵子树跟着走，
 * 而「整理布局」（清掉所有 pos）可一键回到纯自动排版。
 */

import { H_GAP, VERT_LEVEL_GAP, VERT_SIBLING_GAP, V_GAP } from '../constants'
import type {
  MindLayoutDir,
  MindNode,
  MindPoint,
  MindPositions,
  MindSide,
  MindSize,
} from '../types'

/** 布局入参：尺寸获取函数由调用方注入（画布给实测值，首帧给估算值） */
export interface LayoutOptions {
  direction: MindLayoutDir
  /** 取节点尺寸：level 为可见树的深度（根 = 0） */
  measure: (node: MindNode, level: number) => MindSize
}

/** 布局结果 */
export interface LayoutResult {
  positions: MindPositions
  /** 节点 id → 侧向（画布据此决定 Handle 落点与连线方向；`down` 布局恒为 'right'，不使用） */
  sides: Record<string, MindSide>
  /** 节点 id → 可见树深度（建节点时复用，避免二次遍历） */
  levels: Record<string, number>
}

/** 折叠节点的子节点不参与布局 */
function visibleChildren(node: MindNode): MindNode[] {
  return node.collapsed ? [] : node.children
}

/**
 * 计算整棵可见树的布局。
 *
 * 坐标原点：
 * - 水平类布局取**根节点垂直中心**（`both` / `left` 时根左侧会得到负坐标，属正常）；
 * - `down` 布局取**根节点上边缘中心**（同样会出现负坐标）。
 */
export function layoutTree(root: MindNode, options: LayoutOptions): LayoutResult {
  const { direction, measure } = options
  const sizes = new Map<string, MindSize>()
  const levels: Record<string, number> = {}
  const positions: MindPositions = {}
  const sides: Record<string, MindSide> = {}

  /* ---------- 第 0 趟：预计算深度（尺寸估算要按层级取字号） ---------- */
  const collectLevels = (node: MindNode, level: number) => {
    levels[node.id] = level
    visibleChildren(node).forEach(child => collectLevels(child, level + 1))
  }
  collectLevels(root, 0)

  /* ---------- 尺寸：每个节点只测一次 ---------- */
  const sizeOf = (node: MindNode): MindSize => {
    const cached = sizes.get(node.id)
    if (cached) return cached
    const size = measure(node, levels[node.id] ?? 0)
    sizes.set(node.id, size)
    return size
  }

  /* ================================================================ 水平类 */

  if (direction !== 'down') {
    const subtreeHeights = new Map<string, number>()

    /* -------- 第 1 趟：子树高度 -------- */
    const subtreeHeight = (node: MindNode): number => {
      const cached = subtreeHeights.get(node.id)
      if (cached !== undefined) return cached
      const children = visibleChildren(node)
      let height = sizeOf(node).height
      if (children.length) {
        let stacked = 0
        children.forEach((child, index) => {
          stacked += subtreeHeight(child) + (index ? V_GAP : 0)
        })
        height = Math.max(height, stacked)
      }
      subtreeHeights.set(node.id, height)
      return height
    }

    /* -------- 第 2 趟：摆放（沿 side 方向推进层级） -------- */
    const place = (node: MindNode, x: number, centerY: number, side: MindSide) => {
      const size = sizeOf(node)
      // 手动固定过坐标的节点直接采用它；否则水平居中于分配到的槽位
      const own: MindPoint = node.pos ?? { x, y: centerY - size.height / 2 }
      positions[node.id] = own
      sides[node.id] = side

      const children = visibleChildren(node)
      if (!children.length) return

      const total = children.reduce(
        (sum, child, index) => sum + subtreeHeight(child) + (index ? V_GAP : 0),
        0,
      )
      // 子节点以**本节点最终位置**的垂直中心为基准堆叠 —— 拖动父节点时子树随之移动
      let cursor = own.y + size.height / 2 - total / 2

      for (const child of children) {
        const childHeight = subtreeHeight(child)
        const childSize = sizeOf(child)
        const childX =
          side === 'right' ? own.x + size.width + H_GAP : own.x - childSize.width - H_GAP
        place(child, childX, cursor + childHeight / 2, side)
        cursor += childHeight + V_GAP
      }
    }

    if (direction === 'both') {
      // 根居中：前半子节点向右、后半向左，两侧各自垂直居中于根节点中心
      const rootSize = sizeOf(root)
      const rootPos: MindPoint = root.pos ?? { x: 0, y: -rootSize.height / 2 }
      sides[root.id] = 'right' // 根节点两侧都要 Handle，由组件按 isRoot 特判
      positions[root.id] = rootPos

      const children = visibleChildren(root)
      const splitIndex = Math.ceil(children.length / 2)
      const rootCenterY = rootPos.y + rootSize.height / 2

      const placeGroup = (group: MindNode[], side: MindSide) => {
        if (!group.length) return
        const total = group.reduce(
          (sum, child, index) => sum + subtreeHeight(child) + (index ? V_GAP : 0),
          0,
        )
        let cursor = rootCenterY - total / 2
        for (const child of group) {
          const childHeight = subtreeHeight(child)
          const childSize = sizeOf(child)
          const childX =
            side === 'right' ? rootPos.x + rootSize.width + H_GAP : rootPos.x - childSize.width - H_GAP
          place(child, childX, cursor + childHeight / 2, side)
          cursor += childHeight + V_GAP
        }
      }

      placeGroup(children.slice(0, splitIndex), 'right')
      placeGroup(children.slice(splitIndex), 'left')
    } else {
      // right / left：整棵树单向生长（left 与 right 完全镜像）
      place(root, 0, 0, direction)
    }

    return { positions, sides, levels }
  }

  /* ================================================================ 垂直类 */

  const subtreeWidths = new Map<string, number>()

  /* -------- 第 1 趟：子树宽度 -------- */
  const subtreeWidth = (node: MindNode): number => {
    const cached = subtreeWidths.get(node.id)
    if (cached !== undefined) return cached
    const children = visibleChildren(node)
    let width = sizeOf(node).width
    if (children.length) {
      let stacked = 0
      children.forEach((child, index) => {
        stacked += subtreeWidth(child) + (index ? VERT_SIBLING_GAP : 0)
      })
      width = Math.max(width, stacked)
    }
    subtreeWidths.set(node.id, width)
    return width
  }

  /* -------- 第 2 趟：摆放（层级向下推进） -------- */
  const placeDown = (node: MindNode, centerX: number, y: number) => {
    const size = sizeOf(node)
    // 与水平类同理：手动固定过坐标的节点直接采用它
    const own: MindPoint = node.pos ?? { x: centerX - size.width / 2, y }
    positions[node.id] = own
    sides[node.id] = 'right' // 垂直布局不使用侧向，统一给 'right' 避免下游出现 undefined

    const children = visibleChildren(node)
    if (!children.length) return

    const total = children.reduce(
      (sum, child, index) => sum + subtreeWidth(child) + (index ? VERT_SIBLING_GAP : 0),
      0,
    )
    // 子节点以本节点最终位置的水平中心为基准排开
    let cursor = own.x + size.width / 2 - total / 2

    for (const child of children) {
      const childWidth = subtreeWidth(child)
      placeDown(child, cursor + childWidth / 2, own.y + size.height + VERT_LEVEL_GAP)
      cursor += childWidth + VERT_SIBLING_GAP
    }
  }

  placeDown(root, 0, 0)

  return { positions, sides, levels }
}
