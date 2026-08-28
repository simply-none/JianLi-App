/**
 * 关键词打分工具：完全相等 > 前缀匹配 > 包含 > 顺序子序列。
 * 返回 0 表示未命中（调用方据此过滤）。
 */

export function matchScore(query: string, text: string): number {
  const q = (query || '').trim().toLowerCase()
  const t = (text || '').toLowerCase()
  if (!t) return 0
  // 空关键词走「默认推荐」分支，给一个极低的基础分保持原顺序
  if (!q) return 1
  if (t === q) return 100
  if (t.startsWith(q)) return 80

  const idx = t.indexOf(q)
  if (idx > -1) {
    // 命中位置越靠前分越高，最低保底 30 分
    return Math.max(30, 60 - Math.min(idx, 25))
  }

  return subsequenceScore(q, t)
}

/**
 * 顺序子序列匹配：q 的每个字符按顺序出现在 t 中即算命中。
 * 例如「账本」可命中「记账本」。连续命中越多分越高。
 */
function subsequenceScore(q: string, t: string): number {
  let qi = 0
  let hits = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      qi += 1
      hits += 1
    }
  }
  return qi === q.length ? 20 + hits : 0
}

/** 按分数降序排序；分数相同时保持原顺序（Array.prototype.sort 在 V8 里是稳定的） */
export function byScoreDesc<T extends { score: number }>(list: T[]): T[] {
  return list.sort((a, b) => b.score - a.score)
}
