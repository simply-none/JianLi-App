/**
 * 页码范围（tag 式）解析工具
 * 与 RangeInput.vue 配套：用户以「回车即生成 tag」的方式输入多个范围，
 * 这里负责把 tag 文本列表解析为 0 基页码（pdf-lib / pdf.js 均用 0 基）。
 * 支持单页「5」与闭区间「a-b」（均为 1 基、闭区间）。
 */

/** 校验单个片段是否为合法范围/单页（1 基，a>=1，区间 b>=a） */
export function isValidRangeSeg(seg: string): boolean {
  const s = seg.trim();
  if (!s) return false;
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    return a >= 1 && b >= a;
  }
  return /^\d+$/.test(s) && parseInt(s, 10) >= 1;
}

/** tag 列表 → 0 基闭区间 [[s,e]]（保持 tag 顺序） */
export function rangeTagsToRanges(tags: string[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const t of tags) {
    const s = t.trim();
    const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10) - 1;
      const b = parseInt(m[2], 10) - 1;
      if (b >= a) out.push([a, b]);
    } else if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10) - 1;
      out.push([n, n]);
    }
  }
  return out;
}

/** tag 列表 → 0 基页码索引数组（升序去重） */
export function rangeTagsToIndices(tags: string[]): number[] {
  const set = new Set<number>();
  for (const [s, e] of rangeTagsToRanges(tags)) {
    for (let i = s; i <= e; i++) set.add(i);
  }
  return [...set].sort((a, b) => a - b);
}
