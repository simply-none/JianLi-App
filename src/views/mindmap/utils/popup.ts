/**
 * 浮层定位（纯几何，无 DOM 依赖）。
 *
 * 为什么单独成文件：`MindNodeMenu` 里那段「光标落点 + 越界翻转 + 夹视口」全是算术，
 * 塞在组件里既没法断言，也讲不清楚（几个边界条件靠读代码非常容易想反）。
 * 抽出来之后组件只负责「渲染 → 量真实尺寸 → 调它 → 写 style」。
 *
 * 规则（「节点在底部 ⇒ 以该节点为底部定位点向上展开」的通用写法）：
 *   · 右 / 下放得下  ⇒ 左上角贴光标（与系统右键菜单一致）
 *   · 右放不下       ⇒ 浮层**右缘** = 锚点左缘 - 间隙（向左展开，不盖住锚点）
 *   · 下放不下       ⇒ 浮层**下缘** = 锚点上缘 - 间隙（向上展开，不盖住锚点）
 *   · 翻转后仍越界   ⇒ 退化成夹边界（浮层比视口还大 / 锚点贴着屏幕边），
 *                      此时会盖住锚点，但整个浮层都可见。
 *
 * ⚠️ 翻转的基准是**锚点矩形**而不是光标：光标只是落在锚点里的某个随机角落，
 *    用它当基准，同一个节点在左上角右键与在右下角右键会差出大半个浮层的高度。
 * ⚠️ 更不能「直接夹进视口」：浮层高几百 px，按 `viewport.height - height` 夹 y，
 *    窗口下半部分触发时浮层会被整体拽到光标上方几百像素处，离触发点极远。
 */

/** 与视口边缘的最小间距 */
export const POPUP_EDGE_GAP = 6

/** 翻转到锚点另一侧时与锚点留的缝（别让浮层压在锚点边框上） */
export const POPUP_ANCHOR_GAP = 4

/** 视口坐标下的矩形 */
export interface PopupRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** 视口可视区尺寸 */
export interface PopupViewport {
  width: number
  height: number
}

export interface PlacePopupInput {
  /** 光标（视口坐标）：首选落点是「左上角贴光标」，与系统右键菜单一致 */
  cursorX: number
  cursorY: number
  /** 浮层自身尺寸 —— 必须**渲染之后**实测，估算会把翻转判反 */
  width: number
  height: number
  /** 视口可视区尺寸 */
  viewport: PopupViewport
  /**
   * 锚点矩形（右键场景 = 节点卡片自身的视口矩形）。
   * 翻转时贴着它的边缘展开；拿不到时退化成「以光标为翻转基准」。
   */
  anchor?: PopupRect
}

export interface PlacePopupOptions {
  /** 与视口边缘的最小间距，缺省 `POPUP_EDGE_GAP` */
  edgeGap?: number
  /** 翻转后与锚点之间的间隙，缺省 `POPUP_ANCHOR_GAP` */
  anchorGap?: number
}

/** 夹进 `[min, max]`；`max < min`（视口比浮层还小）时取 min，保证左 / 上边缘可见 */
export function clampInto(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * 算出浮层左上角在视口里的落点。
 * 返回的坐标**已保证**浮层完整落在视口内（除非浮层本身比视口还大）。
 */
export function placePopup(input: PlacePopupInput, options: PlacePopupOptions = {}): {
  x: number
  y: number
  /** 是否向左翻转了（调试 / 断言用） */
  flippedX: boolean
  /** 是否向上翻转了（调试 / 断言用） */
  flippedY: boolean
} {
  const edgeGap = options.edgeGap ?? POPUP_EDGE_GAP
  const anchorGap = options.anchorGap ?? POPUP_ANCHOR_GAP
  const { cursorX, cursorY, width, height, viewport, anchor } = input

  let x = cursorX
  let y = cursorY

  const flippedX = x + width + edgeGap > viewport.width
  const flippedY = y + height + edgeGap > viewport.height
  if (flippedX) x = (anchor ? anchor.left : cursorX) - width - anchorGap
  if (flippedY) y = (anchor ? anchor.top : cursorY) - height - anchorGap

  x = clampInto(x, edgeGap, viewport.width - width - edgeGap)
  y = clampInto(y, edgeGap, viewport.height - height - edgeGap)
  return { x, y, flippedX, flippedY }
}
