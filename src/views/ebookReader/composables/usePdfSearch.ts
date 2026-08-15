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

/** 单次搜索结果上限（防止超长列表拖慢渲染） */
const MAX_RESULTS = 300;

/** 摘录上下文长度（命中前后各取多少字） */
const EXCERPT_PAD = 30;

export function usePdfSearch(ctx: PdfCtx) {
  /** 搜索结果列表 */
  const results = ref<EpubSearchResult[]>([]);
  /** 是否正在搜索 */
  const searching = ref(false);

  /**
   * 把一页的 TextContent.items 拼成可读文本。
   * pdf.js 常把单词拆成多个 item，若相邻 item 间无缝隙则在中间补一个空格，
   * 以便跨 item 的多词关键词也能命中。
   */
  function pageTextFromContent(content: any): string {
    const items = content?.items || [];
    let text = '';
    for (let i = 0; i < items.length; i++) {
      const str = typeof items[i]?.str === 'string' ? items[i].str : '';
      if (!str) continue;
      if (text && !/\s$/.test(text) && !/^\s/.test(str)) text += ' ';
      text += str;
    }
    return text;
  }

  /**
   * 执行全文搜索。
   * @param term - 搜索关键词
   */
  async function runSearch(term: string): Promise<void> {
    const q = (term || '').trim();
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
          const text = pageTextFromContent(content);
          const lower = text.toLowerCase();
          let idx = lower.indexOf(termLower);
          while (idx >= 0 && out.length < MAX_RESULTS) {
            const start = Math.max(0, idx - EXCERPT_PAD);
            const end = Math.min(text.length, idx + q.length + EXCERPT_PAD);
            const excerpt = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
            out.push({
              cfi: String(n),
              excerpt,
              sectionHref: `第 ${n} 页`,
            });
            idx = lower.indexOf(termLower, idx + q.length);
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
   * 跳转到指定搜索命中位置（cfi 为页码字符串）。
   */
  function jumpToSearchResult(cfi: string): void {
    const page = Number(cfi);
    if (!Number.isNaN(page) && page > 0 && page <= ctx.numPages.value) {
      ctx.goToPage?.(page, true);
    }
  }

  /** 清空搜索结果 */
  function clearSearch(): void {
    results.value = [];
    ctx.emit('search-results', results.value);
  }

  return {
    results,
    searching,
    runSearch,
    jumpToSearchResult,
    clearSearch,
  };
}
