/**
 * 思维导图 —— 画布几何纯函数（**画布坐标系**，不依赖 Vue / DOM）。
 *
 * 抽出来的理由与 `utils/popup.ts` 一致：都是「一堆算术 + 若干边界」，
 * 放在组件里既难读也没法断言。这里只做三件事：
 *   1. 两个矩形是否相交（`Shift + 拖拽` 框选的命中判定）；
 *   2. 与一个矩形相交的所有节点 id（框选结果）；
 *   3. 离某个点最近的节点 id（双击空白处「就近新建子节点」）。
 *
 * ⚠️ 全部按**节点矩形**判定，不用节点中心点：
 *    大节点的中心可能离光标很远，但它的边其实就在光标旁边 ——
 *    用中心点会让「明明贴着节点双击却挂到了别的节点上」。
 *    （P7 的拖放换父同样用矩形包含测试，见 `useMindGraph`。）
 */

import type { MindPoint } from '../types'

/** 轴对齐矩形（画布坐标，左上角 + 宽高） */
export interface MindRect {
  x: number
  y: number
  width: number
  height: number
}

/** 带 id 的矩形（节点 id → 它在画布上的矩形） */
export interface MindIdRect {
  id: string
  rect: MindRect
}

/**
 * 两个矩形是否相交。
 *
 * ⚠️ 判据是「**相交面积 > 0**」，仅贴边（`overlap === 0`）**不算**相交。
 *    实测手感上，贴边选中会让人误以为「框到了一点却选了一大片」；
 *    宁可要求框真的压进去一点，也不要制造这种模糊地带。
 */
export function rectsIntersect(a: MindRect, b: MindRect): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return overlapX > 0 && overlapY > 0
}

/**
 * 与 `rect` 相交的全部节点 id。
 * 返回值顺序与入参一致（= 树的渲染顺序），调用方不需要再排一次。
 */
export function rectsIntersecting(rect: MindRect, rects: MindIdRect[]): string[] {
  const hits: string[] = []
  for (const item of rects) {
    if (rectsIntersect(rect, item.rect)) hits.push(item.id)
  }
  return hits
}

/** 点是否落在矩形内（含边界，闭区间） */
export function pointInRect(point: MindPoint, rect: MindRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

/**
 * 离 `point` 最近的节点 id（欧氏距离，按矩形**最近边缘**而非中心算）。
 *
 * 用「点到矩形的最近距离」而不是「点到中心的距离」：
 *   用户双击的位置通常紧贴某个节点，此时中心距会被节点的宽高严重干扰 ——
 *   一个很宽的一级节点，即使光标就在它旁边，中心距也可能大过一个远处的窄节点。
 *   点到矩形的距离在「光标贴住某个节点时」恒为 0，语义上就是「它就在这个节点边上」。
 *
 * 空集合返回 `undefined`（调用方据此回落到「挂到根节点」）。
 * `exclude` 用于排除不该当选的节点（例如拖放时排除自身子树）。
 */
export function nearestRectId(
  point: MindPoint,
  rects: MindIdRect[],
  exclude?: ReadonlySet<string>,
): string | undefined {
  let bestId: string | undefined
  let bestDistance = Infinity
  for (const item of rects) {
    if (exclude?.has(item.id)) continue
    const dx = Math.max(item.rect.x - point.x, 0, point.x - (item.rect.x + item.rect.width))
    const dy = Math.max(item.rect.y - point.y, 0, point.y - (item.rect.y + item.rect.height))
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      bestId = item.id
    }
  }
  return bestId
}
