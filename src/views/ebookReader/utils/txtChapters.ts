/**
 * TXT 章节识别与定位工具（纯函数，便于逻辑断言直载测试）
 *
 * 章节锚点 = 全文字符偏移（与划线/进度同一偏移空间），
 * 识别规则：行首匹配「第X章/卷/节/回/部/篇/集/话、Chapter N、序章/楔子/引子」等标记，
 * 且整行长度受限（≤80 字符），避免把「正文里提到第 3 章」的长段落误判为章节。
 * 命中少于 2 个标记视为无章节结构（返回空数组，阅读器不提供目录）。
 */

/** 章节行标记正则（对 trim 后的行做 test；不要求行尾，防止「第3章 标题：副标题」漏判） */
const TXT_CHAPTER_RE =
  /^(?:第\s*[0-9０-９零一二三四五六七八九十百千万两]+\s*[章卷节回部篇集话幕]|chapter\s+[0-9]+|chapter\s+[IVXLCivxlc]+|序章|序言|楔子|引子|前言|后记|尾声|终章|番外)/i;

/** 章节行最大长度：超过视为普通正文（防止长段落开头恰好出现「第X章」字样被误判） */
const MAX_CHAPTER_LINE_LEN = 80;

/** 单章结构：title 章节标题；start/end 在全文字符偏移空间（end 为 exclusive） */
export interface TxtChapter {
  title: string;
  start: number;
  end: number;
}

/**
 * 按章节标记切分全文为章节列表（start 升序、覆盖整文、互不重叠）。
 * @param content 全文内容（已统一 \n 换行）
 * @returns 章节列表；有效标记 < 2 时返回空数组（无目录）
 */
export function splitTxtChapters(content: string): TxtChapter[] {
  if (!content) return [];
  const marks: { title: string; start: number }[] = [];
  const lines = content.split('\n');
  let offset = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length <= MAX_CHAPTER_LINE_LEN && TXT_CHAPTER_RE.test(trimmed)) {
      marks.push({ title: trimmed, start: offset });
    }
    // 逐行累加偏移：+1 为被 split 掉的 '\n'（最后一行多算的 1 不会越界使用）
    offset += line.length + 1;
  }
  if (marks.length < 2) return [];
  const out: TxtChapter[] = [];
  // 第一个标记之前若有正文，归入「开头」
  if (marks[0].start > 0) {
    out.push({ title: '开头', start: 0, end: marks[0].start });
  }
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].start;
    const end = i + 1 < marks.length ? marks[i + 1].start : content.length;
    out.push({ title: marks[i].title, start, end });
  }
  return out;
}

/**
 * 二分查找偏移所属章节下标（最后一个 start <= offset 的章节）。
 * @returns 章节下标；列表为空或 offset 越界时返回 -1
 */
export function findChapterIndexByOffset(chapters: TxtChapter[], offset: number): number {
  if (!chapters.length || offset < 0) return -1;
  let lo = 0;
  let hi = chapters.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (chapters[mid].start <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
