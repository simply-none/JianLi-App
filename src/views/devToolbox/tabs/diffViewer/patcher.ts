/**
 * Patch 工具模块 —— 封装 diff 库的结构化调用 + hunk 分组 + patch 导出/应用
 */
import * as DiffLib from 'diff';
import type { DiffAlgorithm, NormalizeOptions } from './utils';
import { normalize } from './utils';

/**
 * 单个 diff 块（diff-lib 返回的原始 item，加上我们需要的标记）
 */
export interface DiffItem {
  /** 块内容（可能是多行） */
  value: string;
  /** 是否新增块 */
  added?: boolean;
  /** 是否删除块 */
  removed?: boolean;
  /** 块包含的行数（diff-lib 直接给，或 char/word 级时为 undefined） */
  count?: number;
  /** 是否 matched（算法的 matched 标记） */
  matched?: boolean;
}

/**
 * 一个 hunk = 一串连续的 diff blocks（从第一个变化到最后一个变化，带前后各 3 行上下文）
 * 用于差异导航 + 小地图 + Patch 导出
 */
export interface DiffHunk {
  /** 在左侧原文里的起始行（1-based） */
  oldStart: number;
  /** 在右侧新文里的起始行（1-based） */
  newStart: number;
  /** 左侧涉及行数 */
  oldLines: number;
  /** 右侧涉及行数 */
  newLines: number;
  /** 该 hunk 包含的所有 DiffItem */
  items: DiffItem[];
  /** 是否为修改（removed + added 配对） */
  isModified: boolean;
  /** 是否为纯新增 */
  isAdded: boolean;
  /** 是否为纯删除 */
  isRemoved: boolean;
}

/**
 * 根据算法选择 diff-lib 的对应函数
 * @param algo Diff 算法
 * @param a 左文本（已归一化）
 * @param b 右文本（已归一化）
 * @returns DiffItem[]
 */
export function runDiff(algo: DiffAlgorithm, a: string, b: string): DiffItem[] {
  // 空输入保护
  if (!a && !b) return [];
  // 选择算法
  switch (algo) {
    case 'char':
      return DiffLib.diffChars(a, b);
    case 'word':
      return DiffLib.diffWords(a, b);
    case 'json': {
      // JSON Diff 先尝试 stringify 两个字符串（确保都是合法 JSON）
      let aStr = a, bStr = b;
      try { aStr = JSON.stringify(JSON.parse(a), null, 2); } catch { /* 不是 JSON，保持原样 */ }
      try { bStr = JSON.stringify(JSON.parse(b), null, 2); } catch { /* 不是 JSON，保持原样 */ }
      try {
        // diffJson 第三个参数类型可能不兼容，用 ts-ignore 绕过
        // @ts-ignore - diff-lib 的 diffJson options 类型和当前 TS 配置有冲突
        return DiffLib.diffJson(aStr, bStr, { sortKeys: false });
      } catch {
        // fallback 到 line
        return DiffLib.diffLines(aStr, bStr);
      }
    }
    case 'css': {
      try {
        return DiffLib.diffCss(a, b);
      } catch {
        return DiffLib.diffLines(a, b);
      }
    }
    case 'line':
    default:
      return DiffLib.diffLines(a, b);
  }
}

/**
 * 包装：带归一化 + 算法选择的完整 diff 调用
 * @param leftRaw 左侧原始文本
 * @param rightRaw 右侧原始文本
 * @param opts 归一化选项
 * @param algo Diff 算法
 * @returns DiffItem[]
 */
export function computeDiff(
  leftRaw: string,
  rightRaw: string,
  opts: NormalizeOptions,
  algo: DiffAlgorithm
): DiffItem[] {
  const a = normalize(leftRaw, opts);
  const b = normalize(rightRaw, opts);
  return runDiff(algo, a, b);
}

/**
 * 把 DiffItem[] 分组为 hunks（用于差异导航 + 小地图 + 块级应用）
 * 规则：连续变化块合并为一个 hunk；hunk 之间至少 1 个 unchanged；
 * 每个 hunk 头部保存 oldStart/newStart 行号
 * @param items diff 结果数组
 * @returns DiffHunk[]
 */
export function buildHunks(items: DiffItem[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  // 遍历每个 item，累加 oldLine/newLine 行号
  for (const item of items) {
    const lineCount = item.count ?? item.value.split('\n').filter(Boolean).length;

    if (item.added || item.removed) {
      // 变化块 → 开启/加入当前 hunk
      // hunk 起始行号 = 上一个 unchanged 块之后的下一行（1-based）
      if (!current) {
        current = {
          oldStart: oldLine + 1,
          newStart: newLine + 1,
          oldLines: 0,
          newLines: 0,
          items: [],
          isAdded: false,
          isRemoved: false,
          isModified: false
        };
      }
      current.items.push(item);
      if (item.added) {
        current.newLines += lineCount;
        current.isAdded = true;
        newLine += lineCount;
      }
      if (item.removed) {
        current.oldLines += lineCount;
        current.isRemoved = true;
        oldLine += lineCount;
      }
    } else {
      // 未变块 → 结束当前 hunk（如果有）
      if (current) {
        // 补 hunk 的 start 行号
        if (current.oldStart === 0) current.oldStart = oldLine - current.oldLines + 1;
        if (current.newStart === 0) current.newStart = newLine - current.newLines + 1;
        // 修改判定：既有 removed 又有 added
        current.isModified = current.isAdded && current.isRemoved;
        hunks.push(current);
        current = null;
      }
      oldLine += lineCount;
      newLine += lineCount;
    }
  }
  // 收尾
  if (current) {
    if (current.oldStart === 0) current.oldStart = oldLine - current.oldLines + 1;
    if (current.newStart === 0) current.newStart = newLine - current.newLines + 1;
    current.isModified = current.isAdded && current.isRemoved;
    hunks.push(current);
  }
  return hunks;
}

/**
 * 生成标准 unified diff patch 文本（git apply 可以直接用）
 * @param leftName 左侧文件名
 * @param rightName 右侧文件名
 * @param leftText 左侧完整文本
 * @param rightText 右侧完整文本
 * @param context 每个 hunk 的上下文行数，默认 3（git 默认）
 * @returns patch 文本
 */
export function createStandardPatch(
  leftName: string,
  rightName: string,
  leftText: string,
  rightText: string,
  context = 3
): string {
  // createTwoFilesPatch 第 5/6 参数（oldHeader/newHeader）为可选 string
  // TS 严格模式下不能传 null，改用 undefined 显式忽略
  const result = DiffLib.createTwoFilesPatch(
    leftName,
    rightName,
    leftText,
    rightText,
    undefined,
    undefined,
    { context } as any
  );
  return result ?? '';
}

/**
 * 反向 patch（A→B 变 B→A）—— 用于回滚
 * @param patchText 原始 patch
 * @returns 反向 patch 文本
 */
export function reverseStandardPatch(patchText: string): string {
  const patches = DiffLib.parsePatch(patchText);
  // @ts-ignore - reversePatch 类型声明是 StructuredPatch，实际 StructuredPatch[] 也可以
  const reversed = patches.map(p => DiffLib.reversePatch(p));
  // @ts-ignore - formatPatch 类型声明和实际 StructuredPatch 可能略有出入
  return reversed.map(p => DiffLib.formatPatch(p)).join('\n');
}

/**
 * 尝试把 patch 应用到 source 文本
 * 使用 applyPatch（单个 patch 同步应用），而非 applyPatches（异步回调、需要 loadFile）
 * @param source 原始文本
 * @param patchText patch 文本
 * @returns 应用成功返回新文本，失败返回 { error: string }
 */
export function applyStandardPatch(source: string, patchText: string): string | { error: string } {
  try {
    // applyPatch 签名: applyPatch(source, patch: string | StructuredPatch, options?) => string | false
    const result = DiffLib.applyPatch(source, patchText);
    if (result === false) return { error: 'patch 应用失败（上下文不匹配，fuzzFactor 可尝试放宽）' };
    return result;
  } catch (e: any) {
    return { error: e?.message ?? 'patch 解析或应用失败' };
  }
}
