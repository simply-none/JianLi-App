/**
 * ttsSentences —— 朗读句子切分（EPUB / TXT 共用）
 *
 * 按中英文标点切句，保留标点；过滤纯空白；对超长无标点段落（>200 字）做逗号/空格/硬切保护，
 * 避免单句过长导致朗读节奏拖沓、跟读高亮粒度太粗。
 *
 * 返回每个句子的全局字符区间 { text, start, end }（start 含，end 不含）。
 */

export interface SentenceSeg {
  text: string;
  start: number;
  end: number;
}

const TERMINATORS = '。！？!?；;…\n';

export function splitSentences(text: string): SentenceSeg[] {
  const raw: SentenceSeg[] = [];
  let cur = '';
  let curStart = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (cur === '') curStart = i;
    cur += ch;
    if (TERMINATORS.includes(ch)) {
      raw.push({ text: cur, start: curStart, end: i + 1 });
      cur = '';
    }
  }
  if (cur.trim()) raw.push({ text: cur, start: curStart, end: text.length });

  let segs = raw.filter((s) => s.text.trim().length > 0);
  const result: SentenceSeg[] = [];
  for (const s of segs) {
    const len = s.end - s.start;
    if (len <= 200) {
      result.push(s);
      continue;
    }
    let start = s.start;
    while (start < s.end) {
      const end = Math.min(start + 200, s.end);
      const windowText = text.slice(start, end);
      const comma = Math.max(
        windowText.lastIndexOf('，'),
        windowText.lastIndexOf('、'),
        windowText.lastIndexOf(',')
      );
      const space = windowText.lastIndexOf(' ');
      // windowText 是 text.slice(start,end) 的子串，lastIndexOf 返回的是「相对窗口起点」的偏移，
      // 必须换算成 text 的绝对偏移（start + ...），否则 cut 过小会让 start 回退 → 死循环 → Invalid array length
      let cut = comma > 0 ? start + comma + 1 : space > 0 ? start + space + 1 : end;
      if (cut <= start) cut = end; // 防御：任何异常输入都不允许 start 回退导致死循环
      result.push({ text: text.slice(start, cut), start, end: cut });
      start = cut;
    }
  }
  return result;
}
