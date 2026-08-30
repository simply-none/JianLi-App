/**
 * Diff 工具模块 —— 共享函数 + 类型
 * 提供文本预处理、转义、统计、防抖等通用能力
 */

/** 空白忽略策略 */
export type WhitespaceMode = 'none' | 'all' | 'trim' | 'trailing';

/** 文本预处理选项 */
export interface NormalizeOptions {
  /** 空白忽略模式 */
  whitespace: WhitespaceMode;
  /** 是否忽略大小写 */
  ignoreCase: boolean;
  /** 是否忽略行尾 \r（Windows CRLF → LF） */
  ignoreLineEnding: boolean;
}

/** Diff 算法类型 */
export type DiffAlgorithm = 'line' | 'char' | 'word' | 'json' | 'css';

/** Diff 块类型标记（added/removed/unchanged） */
export type DiffTag = 'added' | 'removed' | 'unchanged';

/**
 * 归一化文本 —— 按照选项对文本做预处理，使 diff 更智能
 * @param s 原始文本
 * @param opts 预处理选项
 * @returns 归一化后的文本
 */
export function normalize(s: string, opts: NormalizeOptions): string {
  let r = s;
  // 先统一换行符（\r\n 和 \r → \n）
  if (opts.ignoreLineEnding) {
    r = r.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }
  // 大小写归一
  if (opts.ignoreCase) {
    r = r.toLowerCase();
  }
  // 空白策略
  switch (opts.whitespace) {
    case 'all':
      // 删除所有空白（空格 + Tab + 换行内空格）
      r = r.replace(/[ \t]+/g, '');
      break;
    case 'trim':
      // 只裁剪每行首尾空白
      r = r.replace(/[ \t]+$/gm, '').replace(/^[ \t]+/gm, '');
      break;
    case 'trailing':
      // 只裁剪行尾空白
      r = r.replace(/[ \t]+$/gm, '');
      break;
    case 'none':
    default:
      // 保持原样
      break;
  }
  return r;
}

/**
 * 统计字符串里的真实行数
 * @param s 输入文本
 * @returns 行数（空字符串为 0，\n 分隔计数）
 */
export function countLines(s: string): number {
  if (!s) return 0;
  // 以 \n 为分隔，去除末尾空行的尾巴
  const arr = s.replace(/\r\n/g, '\n').split('\n');
  // 如果最后一个元素是空（文本以 \n 结尾），不算额外一行
  return arr.length > 0 && arr[arr.length - 1] === '' ? arr.length - 1 : arr.length;
}

/**
 * 转义 HTML 特殊字符，防止 XSS
 * @param s 原始字符串
 * @returns 转义后的安全文本
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  } as Record<string, string>)[c] || c);
}

/**
 * Diff 统计结果接口
 */
export interface DiffStats {
  /** 新增真实行数 */
  added: number;
  /** 删除真实行数 */
  removed: number;
  /** 修改真实行数（added/removed 连续配对） */
  modified: number;
  /** 未变真实行数 */
  unchanged: number;
  /** 左侧总行数 */
  leftLines: number;
  /** 右侧总行数 */
  rightLines: number;
  /** 变化率（相对左侧）百分比 */
  changeRate: number;
}

/**
 * 基于 diff-lib 原始结果计算真实行级统计
 * 不是数"块数"，是每块 value.split('\n') 取真实行数
 * @param result diff-lib 返回的数组
 * @param leftText 左侧原始文本（用来算总行数）
 * @param rightText 右侧原始文本
 * @returns 精确 DiffStats
 */
export function calculateStats(
  result: Array<{ value: string; added?: boolean; removed?: boolean }>,
  leftText: string,
  rightText: string
): DiffStats {
  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;

  // 先合并连续的 removed + added 对，判定为 "modified"
  // （这是业界 diff 的语义：一个删除块 + 紧跟着的一个新增块 = 一次修改）
  const chunks: Array<{
    tag: DiffTag | 'modified';
    addedLines: number;
    removedLines: number;
  }> = [];
  let pendingRemoved: number | null = null;

  for (const item of result) {
    const lines = countLines(item.value);
    if (item.added) {
      if (pendingRemoved !== null) {
        // 合并为 modified
        chunks.push({ tag: 'modified', addedLines: lines, removedLines: pendingRemoved });
        pendingRemoved = null;
      } else {
        chunks.push({ tag: 'added', addedLines: lines, removedLines: 0 });
      }
    } else if (item.removed) {
      if (pendingRemoved !== null) {
        // 连续 removed，累加
        pendingRemoved += lines;
      } else {
        pendingRemoved = lines;
      }
    } else {
      // unchanged
      if (pendingRemoved !== null) {
        // 结束了：前面单独的 removed 块算纯删除
        chunks.push({ tag: 'removed', addedLines: 0, removedLines: pendingRemoved });
        pendingRemoved = null;
      }
      chunks.push({ tag: 'unchanged', addedLines: 0, removedLines: lines });
    }
  }
  // 收尾：最后的 pendingRemoved
  if (pendingRemoved !== null) {
    chunks.push({ tag: 'removed', addedLines: 0, removedLines: pendingRemoved });
  }

  for (const c of chunks) {
    if (c.tag === 'added') added += c.addedLines;
    else if (c.tag === 'removed') removed += c.removedLines;
    else if (c.tag === 'modified') { modified += c.removedLines + c.addedLines; }
    else unchanged += c.removedLines; // unchanged 的 addedLines/removedLines 只有一个有意义
  }

  const leftLines = countLines(leftText);
  const rightLines = countLines(rightText);
  const changeRate = leftLines > 0 ? Math.round((modified + added + removed) / leftLines * 100) : 0;

  return { added, removed, modified, unchanged, leftLines, rightLines, changeRate };
}

/**
 * 防抖函数 —— 避免每次敲击都重算 diff
 * @param fn 原函数
 * @param wait 等待毫秒数，默认 300
 * @returns 防抖后的包装函数
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, wait = 300): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * 检测文本是否是合法 JSON
 * @param s 待测文本
 * @returns 是否是 JSON
 */
export function isJson(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

/**
 * 尝试把文本格式化为 JSON，失败则抛错由调用方捕获
 * @param s 原始文本
 * @returns 格式化后的 JSON 字符串（2 空格缩进）
 */
export function formatJson(s: string): string {
  const parsed = JSON.parse(s);
  return JSON.stringify(parsed, null, 2);
}
