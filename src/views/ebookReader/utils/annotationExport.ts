/**
 * 笔记与划线导出工具（HTML / CSV / 分享长图）
 *
 * 全部走「导出统一规范」（references/export.md）：
 * - 不弹系统保存框，经 src/utils/exportToFile.ts 直写缓存目录；
 * - 成功反馈由 exportToFile 内部的 fileNotify 完成，调用方只处理失败。
 *
 * 数据来源为外壳 AnnotationDrawer 的展示列表（AnnotationDisplayItem + color/type 可选字段），
 * 不读数据库、不依赖具体格式（epub/txt/pdf 通用）。
 */
import { exportTextToCache, exportBufferToCache } from '@/utils/exportToFile';
import { HIGHLIGHT_COLOR_MAP } from '../highlightConfig';
import type { AnnotationDisplayItem } from '../types';

/** 标注类型标签（与主进程 md 导出一致） */
const TYPE_LABELS: Record<string, string> = {
  highlight: '高亮',
  underline: '下划线',
  mark: '删除线',
  markStrong: '双下划线',
};

/** 颜色标识 → 中文标签 */
const COLOR_LABELS: Record<string, string> = {
  yellow: '黄色',
  green: '绿色',
  blue: '蓝色',
  pink: '粉色',
  orange: '橙色',
  purple: '紫色',
};

/** 颜色标识 → 实色（长图/HTML 里做引文侧条） */
const COLOR_SOLID: Record<string, string> = {
  yellow: '#FBC02D',
  green: '#66BB6A',
  blue: '#42A5F5',
  pink: '#EC407A',
  orange: '#FFA726',
  purple: '#AB47BC',
};

function typeLabel(t?: string): string {
  return TYPE_LABELS[t || ''] || '高亮';
}
function colorLabel(c?: string): string {
  return COLOR_LABELS[c || ''] || '默认';
}
function colorSolid(c?: string): string {
  return COLOR_SOLID[c || ''] || '#90A4AE';
}
function colorCss(c?: string): string {
  return HIGHLIGHT_COLOR_MAP[c || ''] || 'rgba(144, 164, 174, 0.35)';
}
function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 导出结果（与 exportToFile 的 ExportResult 一致的必要子集） */
export interface AnnotationExportResult {
  success: boolean;
  path?: string;
  message?: string;
}

/** 生成文件名时间戳（YYYYMMDD-HHmmss，本地时间） */
function fileStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 转义 HTML 特殊字符 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 导出为 HTML（内联样式，带颜色/类型/时间；浏览器或 WPS 直接打开）。
 */
export function exportAnnotationsHtml(
  items: AnnotationDisplayItem[],
  bookTitle: string
): AnnotationExportResult {
  const body = items
    .map((it, i) => {
      const isNote = (it.note || '').trim().length > 0;
      const meta = [typeLabel(it.type), colorLabel(it.color), formatTime(it.createdAt)]
        .filter(Boolean)
        .join(' · ');
      const noteHtml = isNote
        ? `<div class="note">${escapeHtml(it.note!)}</div>`
        : '';
      return `
  <div class="card">
    <div class="quote" style="border-left-color:${colorSolid(it.color)};background:${colorCss(it.color)}22">
      <div class="idx">#${i + 1}</div>
      <div class="text">${escapeHtml(it.text || '')}</div>
    </div>
    ${noteHtml}
    <div class="meta">${escapeHtml(meta)}</div>
  </div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>《${escapeHtml(bookTitle)}》笔记与划线</title>
<style>
  body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 860px; margin: 24px auto; padding: 0 16px; color: #333; background: #fafafa; }
  h1 { font-size: 22px; border-bottom: 2px solid #4A90D9; padding-bottom: 8px; }
  .export-time { color: #888; font-size: 12px; margin-bottom: 20px; }
  .card { background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .quote { padding: 10px 12px; border-left: 4px solid #999; border-radius: 4px; position: relative; }
  .quote .idx { position: absolute; right: 10px; top: 8px; color: #999; font-size: 11px; }
  .quote .text { font-size: 14px; line-height: 1.8; }
  .note { margin-top: 10px; font-size: 13px; line-height: 1.7; color: #555; background: #f5f7fa; border-radius: 6px; padding: 8px 12px; }
  .note::before { content: '✎ 笔记：'; color: #4A90D9; font-weight: 600; }
  .meta { margin-top: 8px; color: #aaa; font-size: 11px; }
</style>
</head>
<body>
  <h1>《${escapeHtml(bookTitle)}》笔记与划线</h1>
  <div class="export-time">共 ${items.length} 条 · 导出于 ${new Date().toLocaleString('zh-CN')} · 由渐离阅读导出</div>
  ${body}
</body>
</html>`;

  return exportTextToCache(html, `渐离阅读-${bookTitle}-笔记_${fileStamp()}.html`, {
    title: 'HTML 笔记已导出',
  });
}

/** CSV 字段转义：含逗号/引号/换行时包引号，内部引号翻倍 */
function csvEscape(v: string): string {
  const s = (v ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * 导出为 CSV（带 BOM，Excel 直接打开不乱码；含类型/颜色/时间/锚点列）。
 */
export function exportAnnotationsCsv(
  items: AnnotationDisplayItem[],
  bookTitle: string
): AnnotationExportResult {
  const rows: string[] = ['序号,分类,类型,颜色,原文,笔记,锚点,创建时间,更新时间'];
  items.forEach((it, i) => {
    const kind = (it.note || '').trim() ? '笔记' : '划线';
    rows.push(
      [
        String(i + 1),
        kind,
        typeLabel(it.type),
        colorLabel(it.color),
        csvEscape(it.text || ''),
        csvEscape(it.note || ''),
        csvEscape(it.anchor || ''),
        formatTime(it.createdAt),
        formatTime(it.updatedAt),
      ].join(',')
    );
  });
  // BOM 头：Excel 识别 UTF-8
  const text = '\uFEFF' + rows.join('\r\n');
  return exportTextToCache(text, `渐离阅读-${bookTitle}-笔记_${fileStamp()}.csv`, {
    title: 'CSV 笔记已导出',
  });
}

/**
 * 导出为分享长图（书摘卡片样式 PNG）：
 * canvas 绘制标题头 + 逐条卡片（彩色引文侧条 + 原文 + 笔记 + 元信息），
 * 自动换行、按内容自适应高度，PNG → exportBufferToCache 直写缓存目录。
 */
export function exportAnnotationsImage(
  items: AnnotationDisplayItem[],
  bookTitle: string
): AnnotationExportResult {
  const W = 900;
  const PAD = 48;
  const CARD_GAP = 18;
  const contentW = W - PAD * 2;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { success: false, message: '画布初始化失败' };
  }

  /** 文本自动换行：返回行数组 */
  function wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const rawLine of text.split('\n')) {
      let cur = '';
      for (const ch of rawLine) {
        if (ctx!.measureText(cur + ch).width > maxWidth && cur) {
          lines.push(cur);
          cur = ch;
        } else {
          cur += ch;
        }
      }
      lines.push(cur);
    }
    return lines;
  }

  // 预排版：先测总高度（字体设置必须在 measureText 前生效）
  const fontQuote = '15px "Microsoft YaHei", sans-serif';
  const fontNote = '13px "Microsoft YaHei", sans-serif';
  const fontMeta = '11px "Microsoft YaHei", sans-serif';
  const fontTitle = 'bold 26px "Microsoft YaHei", sans-serif';

  ctx.font = fontQuote;
  const lineHeight = 26;
  const noteLineHeight = 22;

  interface LayoutCard {
    quoteLines: string[];
    noteLines: string[];
    meta: string;
    color: string;
    bg: string;
    height: number;
  }
  const cards: LayoutCard[] = [];
  let totalH = PAD + 96; // 标题头
  for (const it of items) {
    ctx.font = fontQuote;
    const quoteLines = wrapText(it.text || '', contentW - 40);
    ctx.font = fontNote;
    const noteLines = (it.note || '').trim() ? wrapText(it.note!.trim(), contentW - 40) : [];
    ctx.font = fontMeta;
    const meta = [typeLabel(it.type), colorLabel(it.color), formatTime(it.createdAt)].filter(Boolean).join(' · ');
    const quoteH = Math.max(1, quoteLines.length) * lineHeight + 24;
    const noteH = noteLines.length ? noteLines.length * noteLineHeight + 18 : 0;
    const h = 16 + quoteH + noteH + 26 + 14;
    cards.push({ quoteLines, noteLines, meta, color: colorSolid(it.color), bg: colorCss(it.color), height: h });
    totalH += h + CARD_GAP;
  }
  totalH += PAD;

  canvas.width = W;
  canvas.height = totalH;
  // 重设 canvas 尺寸会重置状态，重新取 ctx
  const c2d = canvas.getContext('2d')!;
  // 背景
  c2d.fillStyle = '#FAFAFA';
  c2d.fillRect(0, 0, W, totalH);
  // 标题头
  c2d.fillStyle = '#333';
  c2d.font = fontTitle;
  c2d.fillText(`《${bookTitle}》`, PAD, PAD + 26);
  c2d.fillStyle = '#999';
  c2d.font = fontMeta;
  c2d.fillText(`共 ${items.length} 条 · 渐离阅读 · ${new Date().toLocaleString('zh-CN')}`, PAD, PAD + 56);
  c2d.fillStyle = '#4A90D9';
  c2d.fillRect(PAD, PAD + 70, W - PAD * 2, 2);

  // 卡片
  let y = PAD + 96;
  for (const card of cards) {
    const cardTop = y;
    // 卡片底
    c2d.fillStyle = '#FFFFFF';
    c2d.strokeStyle = '#EEEEEE';
    c2d.beginPath();
    c2d.roundRect(PAD, cardTop, contentW, card.height, 10);
    c2d.fill();
    c2d.stroke();
    // 引文块背景 + 侧条
    const quoteH = card.quoteLines.length * lineHeight + 24;
    c2d.fillStyle = card.bg;
    c2d.beginPath();
    c2d.roundRect(PAD + 16, cardTop + 16, contentW - 32, quoteH, 6);
    c2d.fill();
    c2d.fillStyle = card.color;
    c2d.fillRect(PAD + 16, cardTop + 16, 4, quoteH);
    // 原文
    c2d.fillStyle = '#333';
    c2d.font = fontQuote;
    let ty = cardTop + 16 + 20 + lineHeight - 6;
    for (const line of card.quoteLines) {
      c2d.fillText(line, PAD + 32, ty);
      ty += lineHeight;
    }
    // 笔记
    let ny = cardTop + 16 + quoteH + 10;
    if (card.noteLines.length) {
      c2d.fillStyle = '#F5F7FA';
      c2d.beginPath();
      c2d.roundRect(PAD + 16, ny, contentW - 32, card.noteLines.length * noteLineHeight + 16, 6);
      c2d.fill();
      c2d.fillStyle = '#4A90D9';
      c2d.font = fontNote;
      c2d.fillText('✎ 笔记', PAD + 28, ny + 20);
      c2d.fillStyle = '#555';
      ny += 20 + noteLineHeight - 8;
      for (const line of card.noteLines) {
        c2d.fillText(line, PAD + 28, ny);
        ny += noteLineHeight;
      }
      ny += 8;
    } else {
      ny = cardTop + 16 + quoteH + 6;
    }
    // 元信息
    c2d.fillStyle = '#AAAAAA';
    c2d.font = fontMeta;
    c2d.fillText(card.meta, PAD + 16, Math.max(ny, cardTop + 16 + quoteH + 22) + 4);
    y += card.height + CARD_GAP;
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return exportBufferToCache(base64, `渐离阅读-${bookTitle}-书摘_${fileStamp()}.png`, {
    title: '书摘长图已导出',
  });
}
