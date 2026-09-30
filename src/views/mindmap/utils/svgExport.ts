/**
 * 思维导图 —— SVG 生成器（**纯函数**，不依赖 Vue，也不读画布 DOM）。
 *
 * 为什么不用「克隆画布 DOM 再序列化」那条路（html-to-image / foreignObject）：
 *
 *   1. 布局坐标**本来就是我们自己算的**（utils/layout.ts），画布只是把这些坐标渲染出来。
 *      既然树与尺寸都在手上，直接生成 SVG 比「把渲染结果再抠下来」更短、更可控。
 *   2. HTML 节点要转成 SVG 只能靠 `<foreignObject>` —— 浏览器能显示，
 *      但 Illustrator / Inkscape / Word 基本都读不了。手绘 `<rect>` + `<text>` 出来的是
 *      **真矢量**，任何矢量工具都能继续编辑。
 *   3. 不受视口裁切影响：克隆 DOM 只能拿到「当前可见区域」，
 *      而由数据生成可以完整导出整张图，无论它有多大、用户当前缩放到多少。
 *   4. 零新依赖（html-to-image 要 ~40KB，且仍然只解决 PNG 那一半）。
 *
 * 调用方（useMindExport）负责把「主题色 / 实测尺寸」喂进来：
 *   - 尺寸优先用画布实测值，保证导出结果与屏幕上看到的一致；
 *   - 主题色在导出那一刻从 `.mind-canvas` 的 CSS 变量解析成 sRGB 字面量，
 *     于是生成的 SVG 是**自带颜色、可脱离宿主环境**的独立文件。
 *
 * ⚠️ 文本换行要靠字体度量：本文件内置离屏 canvas 的实现（`defaultMeasureText`），
 *    同时允许注入 `measureText`，这样纯逻辑断言可以在 Node 里跑（见模块文档验证小节）。
 */

import { MIND_COLORS, NODE_PADDING_X, fontSizeOf, fontWeightOf } from '../constants'
import type { MindBranchColor, MindColorKey, MindLayoutDir, MindSide } from '../types'
import { escapeXml } from './xml'

/* ------------------------------------------------------------------ 类型 */

/** 一个待绘制的节点（**画布坐标**，即 vue-flow 的 position / dimensions） */
export interface SvgExportNode {
  id: string
  parentId?: string
  x: number
  y: number
  width: number
  height: number
  text: string
  /** 可见树深度，根 = 0 */
  level: number
  isRoot: boolean
  /** 相对根的侧向（`down` 布局下无意义） */
  side: MindSide
  /** 继承到的分支色 key */
  branch?: MindBranchColor
  /** 自定义背景色 key（未设 = 按层级取主题默认底色） */
  bg?: MindColorKey
  /** 自定义文字色 key（未设 = 主题默认文字色） */
  fg?: MindColorKey
  hasNote: boolean
  hasChildren: boolean
  collapsed: boolean
}

/** 已解析成 sRGB 字面量的主题色（**不能是 var() / color-mix()**，否则脱离宿主就失效） */
export interface SvgTheme {
  background: string
  nodeBg: string
  nodeBorder: string
  nodeText: string
  rootBg: string
  rootBorder: string
  l1Bg: string
  l1Border: string
  line: string
  noteBg: string
  noteBorder: string
  noteText: string
  foldBg: string
  foldBorder: string
  foldText: string
  fontFamily: string
  branch: Record<MindBranchColor, string>
  /**
   * 主题色板实色（文字色用）。
   * ⚠️ 与 `branch` 是**同一批颜色**，但导出侧刻意分成两张表：
   *    `branch` 表达「这一支的描边色」，`tone` 表达「这个色 key 的实色」——
   *    合成一张表会让「背景色节点的文字色」这种用法在代码里读不通。
   *    解析来源也一致（`--mm-branch-*` 是 `--mm-tone-*` 的别名）。
   */
  tone: Record<MindColorKey, string>
  /** 主题色板低透铺底色（背景色用；与画布上的 `--mm-tone-*-soft` 对应） */
  toneSoft: Record<MindColorKey, string>
}

export interface SvgBuildResult {
  svg: string
  width: number
  height: number
}

export interface SvgBuildOptions {
  /** 内容四周留白 */
  padding?: number
  /** 文档名，写进 `<title>`（无标题的 SVG 在部分工具里显示为空白） */
  title?: string
  /** 文本测量函数（注入点；默认走离屏 canvas） */
  measureText?: (text: string, font: string) => number
}

/* -------------------------------------------------------------- 常量 */

/** 折叠钮半径（与 MindNode.vue 的 16px 圆钮对应） */
const FOLD_RADIUS = 8
/** 备注浮标半径（与 MindNode.vue 的 15px 圆钮对应） */
const NOTE_RADIUS = 7.5
/** 节点圆角（与 MindNode.vue 的 border-radius: 10px 对应） */
const NODE_RADIUS = 10
/** 连线控制点的最小回旋半径（太小会拉成直角，太大又变成绕远） */
const MIN_CURVE = 18

/* ------------------------------------------------------- CSS 值解析 */

let measureCtx: CanvasRenderingContext2D | null | undefined

/** 取离屏 canvas 上下文（失败返回 null，调用方自行兜底） */
function offscreenContext(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement('canvas').getContext('2d')
    } catch {
      measureCtx = null
    }
  }
  return measureCtx ?? null
}

/**
 * 文本测量（默认实现）。
 * 无 canvas 的极端环境下退化成「全角 1em / 半角 0.55em」的粗估 ——
 * 宁可换行不准，也不能让导出整个失败。
 */
export function defaultMeasureText(text: string, font: string): number {
  const ctx = offscreenContext()
  if (!ctx) {
    let em = 0
    for (const char of text) em += /[\u2E80-\uFFFF]/.test(char) ? 1 : 0.55
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 13)
    return em * size
  }
  ctx.font = font
  return ctx.measureText(text).width
}

/**
 * 把任意 CSS 颜色（含 `var()` 链、`color-mix()`、`color(srgb …)`）
 * **归一化成 sRGB 字面量**（`#rrggbb` / `#rrggbbaa` / `rgba(...)`）。
 *
 * 为什么必须归一化：导出的 SVG 要能脱离宿主环境打开。
 * `color-mix()` 与 `color(srgb …)` 在 Illustrator / Inkscape 里都认不出来，
 * 而 canvas 的 `fillStyle` 取值会把它折算回 sRGB —— 借它当一次「颜色计算器」。
 * 值非法时回落到 fallback（而不是让整个导出变成黑色）。
 */
export function resolveCssColor(raw: string, fallback: string): string {
  const value = raw.trim()
  if (!value) return fallback
  const ctx = offscreenContext()
  if (!ctx) return value
  ctx.fillStyle = '#000000'
  ctx.fillStyle = value
  const normalized = typeof ctx.fillStyle === 'string' ? ctx.fillStyle : ''
  // 非法值会让 fillStyle 保持上一次的赋值（这里就是 #000000），据此判定失败
  if (!normalized || normalized === '#000000') {
    return /^#000000$/i.test(value) ? value : fallback
  }
  return normalized
}

/* -------------------------------------------------------------- 工具 */

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * 按可用宽度折行（贪心，逐字符推进）。
 * 中文没有词边界，只能逐字断；英文尽量退到最近一个空格处断，避免把单词劈开。
 */
export function wrapText(
  text: string,
  maxWidth: number,
  font: string,
  measure: (text: string, font: string) => number,
): string[] {
  if (maxWidth <= 0 || !text) return [text]
  const lines: string[] = []
  let current = ''
  let lastSpace = -1

  for (const char of text) {
    const next = current + char
    if (current && measure(next, font) > maxWidth) {
      const breakAt = lastSpace > 0 && lastSpace < current.length ? lastSpace : -1
      if (breakAt > 0) {
        lines.push(current.slice(0, breakAt))
        current = `${current.slice(breakAt + 1)}${char}`
      } else {
        lines.push(current)
        current = char
      }
      // 断行点若正好落在空格上，行首会多出一个空格 —— 统一在这里摘掉，
      // 避免导出出来的文本比屏幕上多一个缩进（用户会以为是 bug）
      current = current.replace(/^\s+/, '')
      lastSpace = current.lastIndexOf(' ')
    } else {
      current = next
      if (char === ' ') lastSpace = current.length - 1
    }
  }

  if (current || !lines.length) lines.push(current)
  return lines
}

/* ------------------------------------------------------------ 几何 */

/** 一条边的两个锚点：父节点的「出点」与子节点的「入点」 */
function edgeAnchors(
  dir: MindLayoutDir,
  parent: SvgExportNode,
  child: SvgExportNode,
): { x1: number; y1: number; x2: number; y2: number } {
  if (dir === 'down') {
    return {
      x1: parent.x + parent.width / 2,
      y1: parent.y + parent.height,
      x2: child.x + child.width / 2,
      y2: child.y,
    }
  }
  if (child.side === 'left') {
    return {
      x1: parent.x,
      y1: parent.y + parent.height / 2,
      x2: child.x + child.width,
      y2: child.y + child.height / 2,
    }
  }
  return {
    x1: parent.x + parent.width,
    y1: parent.y + parent.height / 2,
    x2: child.x,
    y2: child.y + child.height / 2,
  }
}

/** 三次贝塞尔：左右类横向进出，`down` 纵向进出 */
function curvePath(
  dir: MindLayoutDir,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  if (dir === 'down') {
    const k = Math.max(MIN_CURVE, Math.abs(y2 - y1) * 0.5)
    return `M ${round(x1)} ${round(y1)} C ${round(x1)} ${round(y1 + k)}, ${round(x2)} ${round(y2 - k)}, ${round(x2)} ${round(y2)}`
  }
  const sign = x2 >= x1 ? 1 : -1
  const k = Math.max(MIN_CURVE, Math.abs(x2 - x1) * 0.5)
  return `M ${round(x1)} ${round(y1)} C ${round(x1 + k * sign)} ${round(y1)}, ${round(x2 - k * sign)} ${round(y2)}, ${round(x2)} ${round(y2)}`
}

/* ------------------------------------------------------------ 主入口 */

/**
 * 生成一张完整、独立的 SVG。
 * @returns 没有任何节点时返回 undefined（调用方据此提示「画布为空」）
 */
export function buildMindSvg(
  dir: MindLayoutDir,
  nodes: SvgExportNode[],
  theme: SvgTheme,
  options: SvgBuildOptions = {},
): SvgBuildResult | undefined {
  if (!nodes.length) return undefined

  const padding = options.padding ?? 32
  const measure = options.measureText ?? defaultMeasureText
  const byId = new Map(nodes.map(item => [item.id, item]))

  // 包围盒要把「浮在盒外」的折叠钮与备注浮标也算进去，否则边缘会被裁掉
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x - FOLD_RADIUS)
    minY = Math.min(minY, node.y - NOTE_RADIUS)
    maxX = Math.max(maxX, node.x + node.width + FOLD_RADIUS)
    maxY = Math.max(maxY, node.y + node.height + FOLD_RADIUS)
  }

  const dx = padding - minX
  const dy = padding - minY
  const width = Math.max(1, Math.ceil(maxX - minX + padding * 2))
  const height = Math.max(1, Math.ceil(maxY - minY + padding * 2))

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${escapeXml(theme.fontFamily)}">`,
  )
  if (options.title) parts.push(`<title>${escapeXml(options.title)}</title>`)
  parts.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${theme.background}"/>`,
  )

  /* ------------------------------------------------------------ 连线 */
  for (const node of nodes) {
    if (!node.parentId) continue
    const parent = byId.get(node.parentId)
    if (!parent) continue
    // ⚠️ 锚点必须跟着 dx/dy 一起平移 —— 节点是画在 `x + dx` 上的，
    //    连线若用原始坐标，整张图的线会整体偏出 (dx, dy)，看着像「线没连上节点」。
    const { x1, y1, x2, y2 } = edgeAnchors(dir, parent, node)
    const stroke = node.branch ? theme.branch[node.branch] : theme.line
    parts.push(
      `<path d="${curvePath(dir, x1 + dx, y1 + dy, x2 + dx, y2 + dy)}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`,
    )
  }

  /* -------------------------------------------------------- 节点层 */
  for (const node of nodes) {
    const x = node.x + dx
    const y = node.y + dy
    const accent = node.branch ? theme.branch[node.branch] : undefined
    // 背景：自定义背景色优先；没设才按层级取主题默认底色（与 MindNode.vue 的
    // `var(--mm-node-bg-user, var(--mm-root-bg))` fallback 链完全对应）
    const bg = node.bg
      ? theme.toneSoft[node.bg]
      : node.isRoot
        ? theme.rootBg
        : node.level === 1
          ? theme.l1Bg
          : theme.nodeBg
    // 文字色同理：自定义优先，否则主题默认
    const textFill = node.fg ? theme.tone[node.fg] : theme.nodeText
    const border =
      accent ?? (node.isRoot ? theme.rootBorder : node.level === 1 ? theme.l1Border : theme.nodeBorder)
    const fontSize = fontSizeOf(node.level)
    const weight = fontWeightOf(node.level)

    parts.push(`<rect x="${round(x)}" y="${round(y)}" width="${round(node.width)}" height="${round(node.height)}" rx="${NODE_RADIUS}" fill="${bg}" stroke="${border}" stroke-width="1"/>`)

    // 分支色条：与 MindNode.vue 的 ::before 同款（左缘、上下各留 22%）
    if (accent) {
      parts.push(
        `<rect x="${round(x - 1)}" y="${round(y + node.height * 0.22)}" width="3" height="${round(node.height * 0.56)}" rx="1.5" fill="${accent}"/>`,
      )
    }

    // 文本：竖向居中，根节点水平居中、其余左对齐
    const font = `${weight} ${fontSize}px ${theme.fontFamily}`
    const innerWidth = Math.max(node.width - NODE_PADDING_X * 2, fontSize)
    const lines = wrapText(node.text, innerWidth, font, measure)
    const lineHeight = fontSize * 1.4
    const startY = y + node.height / 2 - (lines.length * lineHeight) / 2
    const anchor = node.isRoot ? 'middle' : 'start'
    const textX = node.isRoot ? x + node.width / 2 : x + NODE_PADDING_X
    lines.forEach((line, index) => {
      const centerY = startY + lineHeight * (index + 0.5)
      parts.push(
        `<text x="${round(textX)}" y="${round(centerY)}" text-anchor="${anchor}" dominant-baseline="central" font-size="${fontSize}" font-weight="${weight}" fill="${textFill}">${escapeXml(line)}</text>`,
      )
    })

    // 折叠钮：跟着「子节点生长的那一侧」；`down` 布局在下边缘
    if (node.hasChildren) {
      const horizontal = dir !== 'down'
      let cx: number
      let cy: number
      if (!horizontal) {
        cx = x + node.width / 2
        cy = y + node.height + 1
      } else if (node.isRoot || node.side === 'right') {
        cx = x + node.width + 1
        cy = y + node.height / 2
      } else {
        cx = x - 1
        cy = y + node.height / 2
      }
      parts.push(
        `<circle cx="${round(cx)}" cy="${round(cy)}" r="${FOLD_RADIUS}" fill="${theme.foldBg}" stroke="${theme.foldBorder}" stroke-width="1"/>`,
      )
      const arm = 3.5
      parts.push(
        `<path d="M ${round(cx - arm)} ${round(cy)} H ${round(cx + arm)}" fill="none" stroke="${theme.foldText}" stroke-width="1.4" stroke-linecap="round"/>`,
      )
      if (node.collapsed) {
        parts.push(
          `<path d="M ${round(cx)} ${round(cy - arm)} V ${round(cy + arm)}" fill="none" stroke="${theme.foldText}" stroke-width="1.4" stroke-linecap="round"/>`,
        )
      }
    }

    // 备注浮标：右上角，两小横线示意「有文字」
    if (node.hasNote) {
      const cx = x + node.width - 0.5
      const cy = y + 0.5
      parts.push(
        `<circle cx="${round(cx)}" cy="${round(cy)}" r="${NOTE_RADIUS}" fill="${theme.noteBg}" stroke="${theme.noteBorder}" stroke-width="1"/>`,
      )
      parts.push(
        `<path d="M ${round(cx - 3)} ${round(cy - 1.6)} H ${round(cx + 3)} M ${round(cx - 3)} ${round(cy + 1.6)} H ${round(cx + 1)}" fill="none" stroke="${theme.noteText}" stroke-width="1.1" stroke-linecap="round"/>`,
      )
    }
  }

  parts.push('</svg>')
  return { svg: parts.join(''), width, height }
}
