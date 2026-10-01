/**
 * PdfReader 全文搜索 composable
 *
 * 与 usePdfRender / usePdfHighlight 共享同一个 ctx（见 pdfContext.ts）。本 composable 负责：
 *   - 遍历每一页的 TextContent，拼接为页文本后检索关键词（大小写不敏感）
 *   - 收集全部命中（页码 + 上下文摘录），通过 ctx.emit 回传给外壳搜索面板
 *   - 跳转到指定命中位置（复用 ctx.goToPage）
 *
 * 说明：pdf.js 没有「全书搜索」聚合 API，这里逐页 getPage + getTextContent 检索。每处理完一页
 * 让出一次事件循环（await setTimeout(0)）并把当前累积结果 emit 出去，避免在数百页文档上长时间
 * 阻塞主线程导致 UI 卡死。结果上限 300 条，避免超长列表拖慢渲染。
 * 复用外壳 SearchPanel：其 results 字段为 EpubSearchResult（cfi / excerpt / sectionHref），
 * PDF 侧把页码写入 cfi、上下文写入 excerpt、来源页数写入 sectionHref，无需改壳组件。
 */
import { ref } from 'vue';
import type { PdfCtx } from './pdfContext';
import type { EpubSearchResult } from '../types';
import { buildPageText, rectsForRange } from '../utils/pdfTextRects';

/** 单次搜索结果上限（防止超长列表拖慢渲染） */
const MAX_RESULTS = 300;

/** 摘录上下文长度（命中前后各取多少字） */
const EXCERPT_PAD = 30;

export function usePdfSearch(ctx: PdfCtx) {
  /** 搜索结果列表 */
  const results = ref<EpubSearchResult[]>([]);
  /** 是否正在搜索 */
  const searching = ref(false);

  /** 当前命中的页内区间（供跳转后在划线层绘制命中高亮） */
  let hits: { page: number; start: number; end: number }[] = [];

  /** 清除全部搜索命中高亮（所有已渲染页的划线层） */
  function clearHitOverlays(): void {
    for (const [, hlEl] of ctx.hlRefs) {
      hlEl.querySelectorAll('.pdf-search-hit').forEach((n) => n.remove());
    }
  }

  /** 在指定页绘制单个命中区间的高亮（等待该页渲染完成后再画，最多约 2s） */
  async function paintHit(pageNum: number, start: number, end: number): Promise<void> {
    try {
      const doc = ctx.pdfDoc;
      if (!doc) return;
      // 等待页面渲染出划线层（goToPage 触发懒渲染，翻页模式切页后同样）
      let hlEl: HTMLElement | null = null;
      for (let i = 0; i < 40 && !hlEl; i++) {
        hlEl = ctx.hlRefs.get(pageNum) || null;
        if (!hlEl) await new Promise((r) => setTimeout(r, 50));
      }
      if (!hlEl) return;
      const page = await doc.getPage(pageNum);
      const viewport = ctx.pageViewports.get(pageNum) || page.getViewport({ scale: ctx.scale.value });
      const { spans } = buildPageText(await page.getTextContent());
      const rects = rectsForRange(spans, start, end, viewport);
      hlEl.querySelectorAll('.pdf-search-hit').forEach((n) => n.remove());
      for (const r of rects) {
        const div = document.createElement('div');
        div.className = 'pdf-search-hit';
        div.style.left = `${r.left}px`;
        div.style.top = `${r.top}px`;
        div.style.width = `${r.width}px`;
        div.style.height = `${r.height}px`;
        hlEl.appendChild(div);
      }
    } catch (err) {
      console.warn('绘制搜索命中高亮失败', err);
    }
  }

  /**
   * 执行全文搜索。
   * @param term - 搜索关键词
   */
  async function runSearch(term: string): Promise<void> {
    const q = (term || '').trim();
    clearHitOverlays();
    hits = [];
    if (!q) {
      results.value = [];
      ctx.emit('search-results', results.value);
      return;
    }
    if (!ctx.pdfDoc) return;

    const termLower = q.toLowerCase();
    searching.value = true;
    ctx.emit('searching', true);
    const out: EpubSearchResult[] = [];
    try {
      const total = ctx.numPages.value;
      for (let n = 1; n <= total; n++) {
        if (out.length >= MAX_RESULTS) break;
        try {
          const page = await ctx.pdfDoc.getPage(n);
          const content = await page.getTextContent();
          // 拼接文本同时记录每个 item 的偏移区间（命中高亮换算与检索同一空间）
          const { text, spans } = buildPageText(content);
          const lower = text.toLowerCase();
          let idx = lower.indexOf(termLower);
          while (idx >= 0 && out.length < MAX_RESULTS) {
            const start = Math.max(0, idx - EXCERPT_PAD);
            const end = Math.min(text.length, idx + q.length + EXCERPT_PAD);
            const excerpt = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
            // cfi = `页码:命中起点`（起点供跳转后绘制命中高亮）
            out.push({
              cfi: `${n}:${idx}`,
              excerpt,
              sectionHref: `第 ${n} 页`,
            });
            hits.push({ page: n, start: idx, end: idx + q.length });
            idx = lower.indexOf(termLower, idx + Math.max(1, q.length));
          }
          // 让出事件循环，避免长文档上持续占用主线程造成 UI 卡死
          await new Promise((r) => setTimeout(r, 0));
          // 每页增量回传，保证面板实时更新
          results.value = out.slice();
          ctx.emit('search-results', results.value);
        } catch (err) {
          // 单页解析失败不中断整体搜索，仅跳过
          console.warn('搜索 PDF 页失败，已跳过：', n, err);
        }
      }
    } catch (err) {
      console.error('PDF 全文搜索异常', err);
    } finally {
      results.value = out;
      searching.value = false;
      ctx.emit('search-results', results.value);
      ctx.emit('searching', false);
    }
  }

  /**
   * 跳转到指定搜索命中位置（cfi 为 `页码:命中起点`），并绘制该命中的页内高亮。
   */
  function jumpToSearchResult(cfi: string): void {
    const m = /^(\d+)(?::(\d+))?$/.exec(cfi || '');
    if (!m) return;
    const page = Number(m[1]);
    if (Number.isNaN(page) || page <= 0 || page > ctx.numPages.value) return;
    ctx.goToPage?.(page, true);
    const start = m[2] != null ? parseInt(m[2], 10) : null;
    if (start != null) {
      // 从命中记录取完整区间（cfi 只带了起点）
      const hit = hits.find((h) => h.page === page && h.start === start);
      void paintHit(page, start, hit ? hit.end : start + 1);
    }
  }

  /** 清空搜索结果与命中高亮 */
  function clearSearch(): void {
    clearHitOverlays();
    hits = [];
    results.value = [];
    ctx.emit('search-results', results.value);
  }

  return {
    results,
    searching,
    runSearch,
    jumpToSearchResult,
    clearSearch,
    /** 兼容外壳「关闭面板取消搜索」钩子：清除命中高亮与结果 */
    cancelSearch: clearSearch,
  };
}
