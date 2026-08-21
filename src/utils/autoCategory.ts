/**
 * 记账功能 - 自动匹配分类工具
 *
 * 匹配策略（纯函数，便于组件与 store 复用）：
 * 1) 历史学习：若备注与某条历史记录备注完全相同（归一化后），沿用其分类。
 * 2) 关键词规则：遍历分类关键词，取「最长命中关键词」对应的分类（更具体优先）。
 * 3) 均未命中：返回 null，由用户手动选择。
 */

import type { AccountingCategory, AccountingRecord } from '@/constants/accounting'

/** 匹配结果 */
export interface CategoryMatchResult {
  /** 推荐分类名（可能为 null） */
  category: string | null
  /** 命中的关键词（关键词规则下） */
  matchedKeyword?: string
  /** 命中来源：历史学习 / 关键词规则 / 无 */
  source: 'history' | 'keyword' | null
}

/** 备注归一化：去首尾空格并转小写，用于历史学习精确比对 */
function normalize(text: string): string {
  return (text || '').trim().toLowerCase()
}

/**
 * 根据备注文本推荐分类
 * @param remark 用户输入的备注 / 商户名
 * @param categories 当前分类配置
 * @param history 历史记录（用于学习），可选
 */
export function matchCategory(
  remark: string,
  categories: AccountingCategory[],
  history: AccountingRecord[] = [],
): CategoryMatchResult {
  const text = (remark || '').trim()
  if (!text) return { category: null, source: null }

  // 1) 历史学习：同备注最近一次的分类
  const norm = normalize(text)
  if (history && history.length > 0) {
    const hit = [...history].reverse().find((r) => normalize(r.note) === norm)
    if (hit && hit.category) {
      return { category: hit.category, source: 'history' }
    }
  }

  // 2) 关键词规则：取最长命中的关键词对应分类
  let best: { name: string; keyword: string; len: number } | null = null
  for (const c of categories) {
    if (!c.keywords || c.keywords.length === 0) continue
    for (const kw of c.keywords) {
      if (kw && text.includes(kw)) {
        if (!best || kw.length > best.len) {
          best = { name: c.name, keyword: kw, len: kw.length }
        }
      }
    }
  }

  if (best) {
    return { category: best.name, matchedKeyword: best.keyword, source: 'keyword' }
  }

  // 3) 未命中
  return { category: null, source: null }
}
