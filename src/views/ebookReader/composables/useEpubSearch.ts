/**
 * EpubReader 全文搜索 composable
 *
 * 与 useEpubRender / useEpubHighlight / useEpubBookmarks 共享同一个 ctx（见 epubContext.ts）。
 * 本 composable 负责：
 *   - 遍历 book.spine 的所有 Section，逐个加载后用 epubjs 原生的 Section.find 检索关键词
 *   - 收集全部命中（cfi + 上下文摘录），通过 ctx.emit 回传给父组件用于结果列表展示
 *   - 跳转到指定命中位置
 *
 * 说明：epubjs 没有「全书搜索」聚合 API，这里按 Section 串行加载+检索+卸载，避免一次性占满内存。
 * 检索大小写不敏感（epubjs Section.find 内部已 lowercased 比较）。结果上限 300 条，避免超长列表。
 */
import { ref } from 'vue';
import type { EpubCtx } from './epubContext';

/** 单条搜索命中结果 */
export interface EpubSearchResult {
  /** 命中位置 CFI（可用于 rendition.display 跳转） */
  cfi: string;
  /** 命中上下文摘录 */
  excerpt: string;
  /** 所在 spine 项的 href（用于展示来源章节） */
  sectionHref: string;
}

/** 单次搜索结果上限（防止超长列表拖慢渲染） */
const MAX_RESULTS = 300;

export function useEpubSearch(ctx: EpubCtx) {
  /** 搜索输入框内容（受控于 UI，可选） */
  const query = ref('');
  /** 搜索结果列表 */
  const results = ref<EpubSearchResult[]>([]);
  /** 是否正在搜索 */
  const searching = ref(false);

  /**
   * 执行全文搜索。
   * @param term - 搜索关键词（不传则使用 query.value）
   */
  async function runSearch(term?: string): Promise<void> {
    const q = (term ?? query.value).trim();
    if (!q) {
      results.value = [];
      ctx.emit('search-results', results.value);
      return;
    }
    const book = ctx.book;
    if (!book) return;

    searching.value = true;
    ctx.emit('searching', true);
    const out: EpubSearchResult[] = [];
    try {
      const items: any[] = (book.spine as any)?.spineItems || [];
      for (const section of items) {
        if (out.length >= MAX_RESULTS) break;
        try {
          // 加载章节文档（epubjs Section.find 依赖 section.document）
          await section.load(book.load.bind(book));
          const matches: { cfi: string; excerpt: string }[] = section.find(q) || [];
          for (const m of matches) {
            out.push({
              cfi: m.cfi,
              excerpt: m.excerpt || '',
              sectionHref: section.href || '',
            });
            if (out.length >= MAX_RESULTS) break;
          }
          // 释放章节文档，避免一次性占满内存
          if (typeof section.unload === 'function') {
            section.unload();
          }
        } catch (err) {
          // 单个章节加载/检索失败不中断整体搜索，仅跳过
          console.warn('搜索章节失败，已跳过：', section?.href, err);
        }
      }
    } catch (err) {
      console.error('全文搜索异常', err);
    } finally {
      results.value = out;
      searching.value = false;
      ctx.emit('search-results', results.value);
      ctx.emit('searching', false);
    }
  }

  /**
   * 跳转到指定搜索命中位置。
   */
  function jumpToSearchResult(cfi: string): void {
    if (!ctx.rendition || !cfi) return;
    ctx.rendition.display(cfi);
  }

  /** 清空搜索结果 */
  function clearSearch(): void {
    results.value = [];
    query.value = '';
    ctx.emit('search-results', results.value);
  }

  return {
    query,
    results,
    searching,
    runSearch,
    jumpToSearchResult,
    clearSearch,
  };
}
