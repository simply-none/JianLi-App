/**
 * 排版引擎 - 装饰线原子渲染
 * ------------------------------------------------------------------
 * 根据装饰线配置生成 HTML 片段：
 *   - position after：与标题同行，flex 弹性延伸（通栏）/ 固定长度
 *   - position below：独立成行的水平线
 * 支持 直线/线段/虚线/虚点 四种类型与「渐细」渐变效果。
 */

import { resolveInkColor } from '../tokens'
import type { LineDecoration } from '../types'

/**
 * 渲染装饰线
 * @param dec 装饰线配置
 * @param withText 是否与文字同行渲染（after 模式由标题组件置于 flex 容器内）
 * @returns HTML 片段（enabled=false 返回空串）
 */
export function renderLine(dec: LineDecoration, withText: boolean): string {
  if (!dec.enabled) return ''

  const color = resolveInkColor(dec.ink)
  const styles: string[] = [`height:${dec.thickness}px`, 'flex-shrink:1']

  // 长度模式：after 模式下 full=弹性延伸 / short=固定短线 / text=与文字等宽需外层控制，此处按固定处理
  if (withText) {
    if (dec.lengthMode === 'full') styles.push('flex:1')
    else styles.push(`width:${dec.lengthMode === 'short' ? 72 : 0}px`)
  } else {
    if (dec.lengthMode === 'full') styles.push('width:100%')
    else if (dec.lengthMode === 'short') styles.push('width:72px')
    else styles.push('width:auto')
  }

  // 线型：dashed 虚线 / dotted 虚点 / solid 直线
  if (dec.kind === 'dashed') styles.push(`background:repeating-linear-gradient(90deg,${color} 0 6px,transparent 6px 10px)`)
  else if (dec.kind === 'dotted') styles.push(`background:repeating-linear-gradient(90deg,${color} 0 2px,transparent 2px 6px)`)
  else if (dec.taper) styles.push(`background:linear-gradient(90deg,${color},rgba(0,0,0,0))`)
  else styles.push(`background:${color}`)

  // line 段线类型：两端留空通过短长度+容器对齐体现，此处与 solid 视觉一致但长度按 short 处理已由外层保证
  return `<span class="rfs-line" style="${styles.join(';')}"></span>`
}

/**
 * 渲染「标题下方」独立成行的装饰线容器
 * @param dec 装饰线配置
 * @returns HTML 片段（enabled=false 或 position!=below 返回空串）
 */
export function renderLineBelow(dec: LineDecoration): string {
  if (!dec.enabled || dec.position !== 'below') return ''
  return `<div style="margin-top:${dec.gap}px;display:flex;align-items:center">${renderLine({ ...dec, position: 'below' }, false)}</div>`
}
