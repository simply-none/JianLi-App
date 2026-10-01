/**
 * PdfReader TTS 朗读适配器（2026-10-01 新增，补齐 PDF 朗读）
 *
 * 与 useEpubTts / useTxtTts 同构：只负责「取文本 + 句级高亮 + 翻页跟随 + 断点定位」，
 * 朗读引擎与循环由 useBookTts 单例统一掌控。
 *
 * 设计要点：
 *   - 取文本：pdf.js getTextContent 逐页拉取，items 用空格拼接为页内文本（与 usePdfSearch 同口径）；
 *     句子携带 { page, start }（页内字符偏移），断点串 = `页:页内偏移`。
 *   - 队列：从「当前页」（或断点页）构建到全书末尾（与 TXT 一致），hasNextQueue 恒 false。
 *   - 句级高亮：不改动文本层 DOM——用 textContent items 的 transform 坐标换算 viewport 矩形，
 *     在既有划线层（.pdf-hl-layer）上叠加半透明 `.tts-hl` 色块（pointer-events:none，不干扰选区/划线点击）。
 *   - 翻页跟随：ctx.goToPage（滚动模式滚动、翻页模式切页，由 usePdfRender 统一处理）。
 *   - 逐字高亮：PDF 不支持（文本层 span 与偏移无稳定映射），仅句级高亮（所有引擎均生效）。
 */
import { onUnmounted } from 'vue';
import { splitSentences } from './ttsSentences';
import { useBookTts } from './useBookTts';
import type { PdfCtx } from './pdfContext';
import type { TtsAdapter, TtsSentence } from './useBookTts';
import { buildPageText, rectsForRange, type PdfPageText } from '../utils/pdfTextRects';

export function usePdfTts(ctx: PdfCtx) {
  const bookTts = useBookTts();

  /** 页内文本缓存（页码 → 拼接文本与各 item 偏移区间），切书时随组件销毁 */
  const pageTextCache = new Map<number, PdfPageText>();
  /** 断点恢复待处理状态（play 先 restoreFromBreakpoint 再 buildQueue，用此传递起始位置） */
  let pendingBp: { page: number; offset: number } | null = null;

  /** 取某页拼接文本与每项偏移区间（带缓存；拼接口径与全文搜索一致） */
  async function getPageText(pageNum: number) {
    const cached = pageTextCache.get(pageNum);
    if (cached) return cached;
    const doc = ctx.pdfDoc;
    if (!doc) return { text: '', spans: [] };
    const page = await doc.getPage(pageNum);
    const result = buildPageText(await page.getTextContent());
    pageTextCache.set(pageNum, result);
    return result;
  }

  /** 取某页当前缩放的 viewport（优先用渲染缓存，未渲染页现算） */
  function getViewport(pageNum: number, page: any) {
    const cached = ctx.pageViewports.get(pageNum);
    if (cached) return cached;
    return page.getViewport({ scale: ctx.scale.value });
  }

  /** 句级高亮：把句子的字符区间换算为 items 矩形，画到该页划线层 */
  async function highlightSentence(pageNum: number, start: number, end: number): Promise<void> {
    try {
      const { spans } = await getPageText(pageNum);
      if (!spans.length) return;
      const doc = ctx.pdfDoc;
      if (!doc) return;
      const page = await doc.getPage(pageNum);
      const viewport = getViewport(pageNum, page);
      const hlEl = ctx.hlRefs.get(pageNum);
      if (!hlEl) return; // 页未渲染（理论上 ensureVisible 后已渲染），跳过视觉
      const rects = rectsForRange(spans, start, end, viewport);
      if (!rects.length) return;
      for (const r of rects) {
        const div = document.createElement('div');
        div.className = 'tts-hl';
        div.style.left = `${r.left}px`;
        div.style.top = `${r.top}px`;
        div.style.width = `${r.width}px`;
        div.style.height = `${r.height}px`;
        hlEl.appendChild(div);
      }
    } catch (err) {
      console.warn('PDF TTS 句级高亮失败', err);
    }
  }

  /** 清除全部 TTS 句级高亮（所有已渲染页的划线层） */
  function clearHighlight(): void {
    for (const [, hlEl] of ctx.hlRefs) {
      hlEl.querySelectorAll('.tts-hl').forEach((n) => n.remove());
    }
  }

  /** 构建从当前页（或断点页）到书末尾的朗读队列 */
  async function buildQueue(): Promise<TtsSentence[]> {
    const doc = ctx.pdfDoc;
    if (!doc) return [];
    let startPage = pendingBp?.page || ctx.currentPage.value;
    const startOffset = pendingBp?.offset ?? 0;
    pendingBp = null;
    startPage = Math.max(1, Math.min(startPage, ctx.numPages.value || 1));
    const sentences: TtsSentence[] = [];
    for (let p = startPage; p <= ctx.numPages.value; p++) {
      const { text } = await getPageText(p);
      if (!text.trim()) continue;
      const isFirstPage = p === startPage;
      // splitSentences 返回页内偏移区间 { text, start, end }，直接携带
      for (const seg of splitSentences(text)) {
        // 断点页：跳过起点之前的句子
        if (isFirstPage && seg.end <= startOffset) continue;
        sentences.push({ text: seg.text, page: p, start: seg.start, bp: `${p}:${seg.start}` });
      }
    }
    return sentences;
  }

  /** 断点恢复：解析 `页:偏移`，跳页定位并记录待处理起始位置（buildQueue 消费） */
  async function restoreFromBreakpoint(bp: string): Promise<number> {
    const m = /^(\d+):(\d+)$/.exec(bp || '');
    if (!m) return 0;
    const page = parseInt(m[1], 10);
    const offset = parseInt(m[2], 10) || 0;
    if (page >= 1 && page <= ctx.numPages.value) {
      pendingBp = { page, offset };
      ctx.goToPage?.(page);
    }
    return 0;
  }

  const adapter: TtsAdapter = {
    bookKey: ctx.contentHash || ctx.props.filePath,
    format: 'pdf',
    buildQueue,
    onSentenceStart: (_index, sentence) => {
      void highlightSentence(sentence.page, sentence.start, sentence.start + sentence.text.length);
    },
    clearHighlight,
    ensureVisible: async (_index, sentence) => {
      if (sentence.page && sentence.page !== ctx.currentPage.value) {
        ctx.goToPage?.(sentence.page);
      }
    },
    restoreFromBreakpoint,
    dispose: () => {
      clearHighlight();
      pageTextCache.clear();
    },
  };

  bookTts.registerAdapter(adapter);
  onUnmounted(() => {
    bookTts.unregisterAdapter(adapter);
  });

  return adapter;
}
