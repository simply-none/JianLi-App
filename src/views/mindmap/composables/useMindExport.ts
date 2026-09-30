/**
 * 思维导图 —— SVG / PNG 导出编排（工具条「导出」菜单的一项）。
 *
 * 两条产物共用**同一份 SVG**：
 *   SVG  —— 直接 `exportTextToCache` 落盘，是真矢量，可继续在 AI / Inkscape 里编辑；
 *   PNG  —— 把同一份 SVG 当图片载入 → 画到 canvas → `toDataURL` → `exportBufferToCache`。
 *
 * 为什么 PNG 不另写一套绘制逻辑：SVG 已经把「圆角框、色条、贝塞尔连线、折行文本」
 * 都表达清楚了，浏览器栅格化它比我们再写一遍 canvas 绘制代码更准、更短。
 * 代价是文本用系统字体渲染（不内嵌 webfont）—— 对导图这种以系统字体为主的场景可以接受。
 *
 * ⚠️ 生成 SVG 用的坐标取「画布实测值」（vue-flow store 里的 position / dimensions），
 *    这样导出结果与用户屏幕上看到的一致，包括他手动拖过的位置。
 *    只有画布尚未同步（节点缺失）时才回落到 layoutTree 现算一遍，避免导出一坨叠在原点的方块。
 */

import { ElMessage } from 'element-plus'
import { useVueFlow } from '@vue-flow/core'

import { exportBufferToCache, exportTextToCache } from '@/utils/exportToFile'
import { MIND_COLORS, MINDMAP_FLOW_ID } from '../constants'
import type { MindBranchColor, MindColorKey, MindFlowNodeData, MindPositions, MindSize } from '../types'
import { pngFileName, svgFileName } from '../utils/exchange'
import { layoutTree } from '../utils/layout'
import { estimateSize } from '../utils/measure'
import {
  buildMindSvg,
  resolveCssColor,
  type SvgBuildResult,
  type SvgExportNode,
  type SvgTheme,
} from '../utils/svgExport'
import { flattenVisible } from '../utils/tree'
import { useMindDoc } from './useMindDoc'

/** PNG 输出倍率：2 倍够清晰，又不至于把大图撑到几十 MB */
const PNG_SCALE = 2
/** canvas 单边上限（超过会被浏览器静默清零，必须主动压倍率） */
const PNG_MAX_EDGE = 8192

/** 主题变量取不到时的兜底色（中灰系，保证导出的图至少能看） */
const FALLBACK = {
  background: '#ffffff',
  nodeBg: '#ffffff',
  nodeBorder: '#d9d9d9',
  nodeText: '#1f1f1f',
  rootBg: '#eef2ff',
  rootBorder: '#8a90f0',
  l1Bg: '#f5f7ff',
  l1Border: '#c3c8e8',
  line: '#9a9a9a',
  noteBg: '#fdf3d8',
  noteBorder: '#d9ab3a',
  noteText: '#a8791a',
  foldBg: '#f2f2f2',
  foldBorder: '#d9d9d9',
  foldText: '#666666',
  branch: '#888888',
  /* 色板实色 / 低透铺底色取不到时的兜底（中灰 / 浅灰，至少能区分出「有设过色」） */
  tone: '#888888',
  toneSoft: '#f0f0f0',
} as const

export function useMindExport() {
  const mind = useMindDoc()
  const { getNodes } = useVueFlow(MINDMAP_FLOW_ID)

  /* ---------------------------------------------------------- 主题色 */

  /** 读一个 CSS 变量并归一化成 sRGB 字面量 */
  function cssColor(style: CSSStyleDeclaration, name: string, fallback: string): string {
    return resolveCssColor(style.getPropertyValue(name), fallback)
  }

  /**
   * 从画布元素上解析出导出用的主题色快照。
   * 取 `.mind-canvas` 而不是 `:root`：`--mm-*` 全系列都定义在那上面。
   */
  function readTheme(): SvgTheme {
    const scope = (document.querySelector('.mind-canvas') as HTMLElement | null) ?? document.documentElement
    const style = getComputedStyle(scope)

    const branch = {} as Record<MindBranchColor, string>
    const tone = {} as Record<MindColorKey, string>
    const toneSoft = {} as Record<MindColorKey, string>
    for (const item of MIND_COLORS) {
      branch[item.value] = cssColor(style, `--mm-branch-${item.value}`, FALLBACK.branch)
      tone[item.value] = cssColor(style, `--mm-tone-${item.value}`, FALLBACK.tone)
      // ⚠️ 低透铺底色是 `color-mix()` 算出来的，resolveCssColor 会借 canvas 折算成 sRGB ——
      //    导出侧拿到的是**已经折算好的实色**，所以导出的 SVG 与屏幕上看到的底色一致，
      //    且脱离宿主（Illustrator / Inkscape）打开也不会变成透明。
      toneSoft[item.value] = cssColor(style, `--mm-tone-${item.value}-soft`, FALLBACK.toneSoft)
    }

    return {
      background: cssColor(style, '--bg-base', FALLBACK.background),
      nodeBg: cssColor(style, '--mm-node-bg', FALLBACK.nodeBg),
      nodeBorder: cssColor(style, '--mm-node-border', FALLBACK.nodeBorder),
      nodeText: cssColor(style, '--mm-node-text', FALLBACK.nodeText),
      rootBg: cssColor(style, '--mm-root-bg', FALLBACK.rootBg),
      rootBorder: cssColor(style, '--mm-root-border', FALLBACK.rootBorder),
      l1Bg: cssColor(style, '--mm-l1-bg', FALLBACK.l1Bg),
      l1Border: cssColor(style, '--mm-l1-border', FALLBACK.l1Border),
      line: cssColor(style, '--mm-line', FALLBACK.line),
      noteBg: cssColor(style, '--mm-note-bg', FALLBACK.noteBg),
      noteBorder: cssColor(style, '--mm-note-border', FALLBACK.noteBorder),
      noteText: cssColor(style, '--mm-note-text', FALLBACK.noteText),
      foldBg: cssColor(style, '--mm-fold-bg', FALLBACK.foldBg),
      foldBorder: cssColor(style, '--mm-node-border', FALLBACK.foldBorder),
      foldText: cssColor(style, '--mm-fold-text', FALLBACK.foldText),
      fontFamily: style.fontFamily || 'sans-serif',
      branch,
      tone,
      toneSoft,
    }
  }

  /* ---------------------------------------------------------- 场景数据 */

  /** 把「可见树 + 画布实测坐标/尺寸」编译成 SVG 生成器要的扁平场景 */
  function buildSceneNodes(): SvgExportNode[] {
    const root = mind.tree.value
    const dir = mind.layout.value
    const flat = flattenVisible(root)
    const flowById = new Map(getNodes.value.map(node => [node.id, node]))

    // 画布尚未同步时才需要现算一份坐标（O(n)，只在缺节点时触发）
    let fallback: MindPositions = {}
    if (flat.some(item => !flowById.has(item.node.id))) {
      fallback = layoutTree(root, {
        direction: dir,
        measure: (node, level) => estimateSize(node.text, level),
      }).positions
    }

    return flat.map(item => {
      const flow = flowById.get(item.node.id)
      const data = flow?.data as MindFlowNodeData | undefined
      const measured: MindSize | undefined =
        flow && flow.dimensions.width && flow.dimensions.height
          ? { width: flow.dimensions.width, height: flow.dimensions.height }
          : undefined
      const size = measured ?? estimateSize(item.node.text, item.level)
      const position = flow?.position ?? fallback[item.node.id] ?? { x: 0, y: 0 }

      return {
        id: item.node.id,
        parentId: item.parentId,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        text: item.node.text,
        level: item.level,
        isRoot: !item.parentId,
        side: data?.side ?? 'right',
        branch: data?.branch,
        // 背景 / 文字色没有「继承」，直接读树节点本身 ——
        // 比走 flow data 更稳：画布尚未同步（flow 缺节点）时树里的值照样拿得到
        bg: item.node.bgColor,
        fg: item.node.textColor,
        hasNote: Boolean(item.node.note),
        hasChildren: item.node.children.length > 0,
        collapsed: item.node.collapsed === true,
      }
    })
  }

  /** 生成当前图的 SVG（返回 undefined = 画布为空） */
  function buildSvg(): SvgBuildResult | undefined {
    const nodes = buildSceneNodes()
    if (!nodes.length) return undefined
    return buildMindSvg(mind.layout.value, nodes, readTheme(), {
      title: mind.doc.value.name,
    })
  }

  /* ------------------------------------------------------------ 栅格化 */

  /** SVG 文本 → PNG base64（dataURL）。用 blob URL 而非 data URL：中文不用手工转义 */
  function rasterize(built: SvgBuildResult): Promise<string> {
    return new Promise((resolve, reject) => {
      const scale = Math.min(PNG_SCALE, PNG_MAX_EDGE / Math.max(built.width, built.height, 1))
      const url = URL.createObjectURL(new Blob([built.svg], { type: 'image/svg+xml;charset=utf-8' }))
      const image = new Image()

      image.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(built.width * scale))
          canvas.height = Math.max(1, Math.round(built.height * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('无法创建画布上下文')
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/png'))
        } catch (error) {
          reject(error instanceof Error ? error : new Error('PNG 生成失败'))
        } finally {
          URL.revokeObjectURL(url)
        }
      }

      image.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('SVG 渲染失败，无法生成 PNG'))
      }

      image.src = url
    })
  }

  /* -------------------------------------------------------------- 导出 */

  /** 导出为 SVG（矢量，可继续编辑） */
  function exportSvg(): boolean {
    const built = buildSvg()
    if (!built) {
      ElMessage.warning('画布为空，没有可导出的内容')
      return false
    }
    const result = exportTextToCache(built.svg, svgFileName(mind.doc.value.name), {
      title: 'SVG 已导出',
    })
    if (!result.success) ElMessage.error(result.message || '导出失败')
    return result.success
  }

  /** 导出为 PNG（同一份 SVG 栅格化，2 倍图） */
  async function exportPng(): Promise<boolean> {
    const built = buildSvg()
    if (!built) {
      ElMessage.warning('画布为空，没有可导出的内容')
      return false
    }
    try {
      const base64 = await rasterize(built)
      const result = exportBufferToCache(base64, pngFileName(mind.doc.value.name), {
        title: 'PNG 已导出',
      })
      if (!result.success) ElMessage.error(result.message || '导出失败')
      return result.success
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : 'PNG 导出失败')
      return false
    }
  }

  return { exportSvg, exportPng }
}
