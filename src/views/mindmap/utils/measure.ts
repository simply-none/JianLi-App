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

import { ESTIMATE, NODE_MIN_HEIGHT, fontSizeOf } from '../constants'
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
 * @param text 节点文本
 * @param level 深度（根 = 0），用于取对应层级的字号
 */
export function estimateSize(text: string, level: number): MindSize {
  const fontSize = fontSizeOf(level)
  const contentWidth = Math.max(textWidthEm(text || ' '), 0.6) * fontSize

  const width = Math.min(
    ESTIMATE.maxWidth,
    Math.max(ESTIMATE.minWidth, Math.ceil(contentWidth + ESTIMATE.paddingX * 2)),
  )
  const innerWidth = Math.max(width - ESTIMATE.paddingX * 2, fontSize)
  const lines = Math.max(1, Math.ceil(contentWidth / innerWidth))
  const height = Math.max(
    NODE_MIN_HEIGHT,
    Math.ceil(lines * ESTIMATE.lineHeight + ESTIMATE.paddingY * 2),
  )

  return { width, height }
}
