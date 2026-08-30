/**
 * 排版引擎 - 令牌常量
 * ------------------------------------------------------------------
 * 字号档位与灰阶档位的映射表，供引擎渲染与排版 UI 共用，
 * 保证「档位定义」只有一处来源。
 */

import type { InkLevel, SizeKey } from './types'

/** 字号档位定义：delta 为相对全局正文字号的偏移（pt） */
export const SIZE_STEPS: { key: SizeKey; delta: number; label: string }[] = [
  { key: 'xs', delta: -1.5, label: '特小' },
  { key: 'sm', delta: -0.75, label: '小' },
  { key: 'base', delta: 0, label: '正文' },
  { key: 'md', delta: 0.5, label: '中' },
  { key: 'lg', delta: 1, label: '大' },
  { key: 'xl', delta: 1.5, label: '加大' },
  { key: 'xxl', delta: 2.5, label: '特大' },
  { key: 'huge', delta: 5, label: '超大' },
  { key: 'giant', delta: 7.5, label: '巨大' },
]

/** 灰阶档位定义（灰黑白色调梯度） */
export const INK_LEVELS: { level: InkLevel; color: string; label: string }[] = [
  { level: 1000, color: '#1a1a1a', label: '最重' },
  { level: 900, color: '#333333', label: '较重' },
  { level: 850, color: '#444444', label: '中重' },
  { level: 750, color: '#555555', label: '偏灰' },
  { level: 650, color: '#666666', label: '中等' },
  { level: 500, color: '#888888', label: '中灰' },
  { level: 450, color: '#999999', label: '浅灰' },
  { level: 250, color: '#d9d9d9', label: '最浅' },
]

/**
 * 按字号档位计算实际 pt 值
 * @param key 档位 key
 * @param baseFontSize 全局正文字号 pt
 * @returns 实际字号 pt
 */
export function resolveFontSize(key: SizeKey, baseFontSize: number): number {
  const step = SIZE_STEPS.find((s) => s.key === key)
  return +(baseFontSize + (step ? step.delta : 0)).toFixed(2)
}

/**
 * 按灰阶档位取颜色值
 * @param level 灰阶档位
 * @returns 颜色 hex
 */
export function resolveInkColor(level: InkLevel): string {
  return INK_LEVELS.find((i) => i.level === level)?.color || '#333333'
}
