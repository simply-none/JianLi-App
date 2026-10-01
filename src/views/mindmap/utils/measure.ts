/**
 * 思维导图 —— 首帧尺寸估算（纯函数）。
 *
 * 为什么需要它：vue-flow 只有在节点**渲染进 DOM 之后**才知道真实尺寸
 * （`findNode(id).dimensions`），而布局必须在 `setNodes` 时就给出坐标。
 * 所以流程是「估算 → 渲染 → 实测 → 重排」两段式：
 * 估算的准确性只影响第一帧的观感，最终坐标一律用实测值算。
 *
 * ⚠️ 估算参数（字号 / 内边距 / 最大宽度）与 `components/MindNode.vue` 的 CSS 耦合，
 *    集中定义在 `constants.ts`，改一处请同步另一处。
 */

import {
  DEFAULT_FONT_SIZE,
  ESTIMATE,
  NODE_ICON_WIDTH,
  NODE_MIN_HEIGHT,
  fontSizeOf,
} from '../constants'
import type { MindSize } from '../types'

/** 文本宽度折算：「全角字符 = 1 em，半角字符 = asciiRatio em」 */
function textWidthEm(text: string): number {
  let em = 0
  for (const char of text) {
    em += /[\u2E80-\uFFFF]/.test(char) ? 1 : ESTIMATE.asciiRatio
  }
  return em
}

/**
 * 估算节点尺寸。
 *
 * @param text 节点文本
 * @param level 深度（根 = 0），用于取对应层级的字号
 * @param icon 节点图标（emoji）。有图标时宽度加上 `NODE_ICON_WIDTH`
 *             —— 不加的话首帧会明显偏窄，图标一渲染出来布局就跳一下。
 *             ⚠️ emoji 的渲染宽度与全角汉字相当（都约 1em），所以按常量加而不是按字数累加。
 * @param baseFontSize 文档级**基准字号**（`MindDocData.fontSize`）；缺省 = `DEFAULT_FONT_SIZE`。
 *             ⚠️ 必须与 `MindNode.vue` 内联的 `font-size` 用**同一个** `fontSizeOf(level, base)`，
 *                否则「首帧估算 == 实测」这条不变量会在改过字号之后失效（布局会先跳一下才稳）。
 */
export function estimateSize(
  text: string,
  level: number,
  icon?: string,
  baseFontSize?: number,
): MindSize {
  const fontSize = fontSizeOf(level, baseFontSize)
  const contentWidth = Math.max(textWidthEm(text || ' '), 0.6) * fontSize
  const iconWidth = icon ? NODE_ICON_WIDTH : 0

  const width = Math.min(
    ESTIMATE.maxWidth,
    Math.max(ESTIMATE.minWidth, Math.ceil(contentWidth + iconWidth + ESTIMATE.paddingX * 2)),
  )
  const innerWidth = Math.max(width - iconWidth - ESTIMATE.paddingX * 2, fontSize)
  const lines = Math.max(1, Math.ceil(contentWidth / innerWidth))
  // 行高估计值按字号**等比缩放**：`ESTIMATE.lineHeight`（20）是「字号 13 时」的默认态标定值
  // （见 constants 里的说明 —— 它还含了节点上下边框的补偿），
  // 除以 `DEFAULT_FONT_SIZE` 保证默认态**逐像素不变**；字号变大时估算跟着等比变大
  // （否则多行节点首帧会明显偏矮、再被实测值纠正一次，看起来像抖了一下）。
  const lineHeight = (ESTIMATE.lineHeight * fontSize) / DEFAULT_FONT_SIZE
  const height = Math.max(
    NODE_MIN_HEIGHT,
    Math.ceil(lines * lineHeight + ESTIMATE.paddingY * 2),
  )

  return { width, height }
}
