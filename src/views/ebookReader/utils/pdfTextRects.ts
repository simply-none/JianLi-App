/**
 * PDF 页内文本与矩形换算公共工具（搜索命中高亮 / TTS 句级高亮共用）
 *
 * 拼接口径与 usePdfSearch 历史实现一致：相邻 item 无缝隙时补一个空格，
 * 保证「搜索文本偏移」与「高亮换算偏移」永远同一空间。
 */
import * as pdfjsLib from 'pdfjs-dist';

/** 页内文本项（getTextContent item 的最小字段） */
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** 单个 item 在拼接文本中的 [start, end) 偏移区间 */
export interface PdfTextSpan {
  start: number;
  end: number;
  item: PdfTextItem;
}

/** 一页的拼接文本 + 各 item 偏移区间 */
export interface PdfPageText {
  text: string;
  spans: PdfTextSpan[];
}

/**
 * 把一页的 TextContent.items 拼接为文本并记录每个 item 的偏移区间。
 * pdf.js 常把单词拆成多个 item，若相邻 item 间无缝隙则在中间补一个空格，
 * 以便跨 item 的多词关键词也能命中（与全文搜索的文本口径完全一致）。
 */
export function buildPageText(content: any): PdfPageText {
  const items = content?.items || [];
  let text = '';
  const spans: PdfTextSpan[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as PdfTextItem;
    const str = typeof item?.str === 'string' ? item.str : '';
    if (!str) continue;
    if (text && !/\s$/.test(text) && !/^\s/.test(str)) {
      text += ' ';
    }
    const start = text.length;
    text += str;
    spans.push({ start, end: text.length, item });
  }
  return { text, spans };
}

/** 换算出的 viewport 矩形（css px，y 向下） */
export interface PdfRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 计算 [start, end) 字符区间覆盖到的 items 在当前 viewport 下的矩形列表。
 * 坐标换算与 pdf.js 文本层同款（Util.transform + fontHeight 近似行高），
 * 供在划线层叠加半透明色块（搜索命中 / 朗读句级高亮）。
 */
export function rectsForRange(
  spans: PdfTextSpan[],
  start: number,
  end: number,
  viewport: any
): PdfRect[] {
  const rects: PdfRect[] = [];
  for (const sp of spans) {
    if (sp.end <= start || sp.start >= end) continue;
    if (!sp.item.transform || !sp.item.str.trim()) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, sp.item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]) || (sp.item.height || 0) * viewport.scale || 12;
    const left = tx[4];
    const top = tx[5] - fontHeight; // 近似行顶（含上伸部）
    const width = (sp.item.width || 0) * viewport.scale;
    if (width <= 0) continue;
    rects.push({ left, top, width, height: fontHeight });
  }
  return rects;
}
