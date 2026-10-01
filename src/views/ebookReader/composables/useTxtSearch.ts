/**
 * TxtReader 全文搜索 composable
 *
 * 与 usePdfSearch / useEpubSearch 同构：结果统一为 EpubSearchResult 形状
 * （cfi = `offset:${起始偏移}`，sectionHref = 命中所在章节标题），复用外壳 SearchPanel 展示。
 * TXT 全文已在内存中（ctx.fullContent），直接字符串检索，毫秒级完成，无需取消机制；
 * 大小写不敏感（统一 toLowerCase 比较）。
 */
import { ref } from 'vue';
import type { TxtCtx } from './txtContext';
import type { EpubSearchResult } from '../types';
import { findChapterIndexByOffset } from '../utils/txtChapters';

/** 单次搜索结果上限（与 EPUB/PDF 一致，防止超长列表拖慢渲染） */
const MAX_RESULTS = 300;

/** 命中摘录的前后文长度（字符数） */
const EXCERPT_PAD = 30;

/** 搜索所需的渲染侧最小接口 */
export interface TxtSearchRenderApi {
  /** 跳转到指定全局字符偏移 */
  jumpToOffset: (offset: number) => void;
  /** 选中 [start, end) 字符区间（命中可见化） */
  selectRange: (start: number, end: number) => void;
  /** 清除当前选区 */
  clearSelection: () => void;
}

export function useTxtSearch(ctx: TxtCtx, render: TxtSearchRenderApi) {
  /** 搜索输入框内容（受控于 UI，可选） */
  const query = ref('');
  /** 搜索结果列表 */
  const results = ref<EpubSearchResult[]>([]);
  /** 是否正在搜索（TXT 为同步检索，仅短暂为 true） */
  const searching = ref(false);

  /** 命中偏移所属章节标题（无章节结构时返回空串，面板不显示来源） */
  function sectionLabelAt(offset: number): string {
    const idx = findChapterIndexByOffset(ctx.chapters.value, offset);
    return idx >= 0 ? ctx.chapters.value[idx]?.title || '' : '';
  }

  /** 命中可见化所需：最近一次搜索的关键词（推导命中区间长度） */
  let lastTerm = '';

  /**
   * 执行全文搜索（大小写不敏感，顺序全文扫描，结果上限 300）。
   * @param term - 搜索关键词（不传则使用 query.value）
   */
  function runSearch(term?: string): void {
    const q = (term ?? query.value).trim();
    lastTerm = q;
    const out: EpubSearchResult[] = [];
    const content = ctx.fullContent.value || '';
    if (!q || !content) {
      results.value = [];
      ctx.emit('search-results', results.value);
      return;
    }
    searching.value = true;
    ctx.emit('searching', true);
    try {
      const lowerContent = content.toLowerCase();
      const lowerQ = q.toLowerCase();
      let from = 0;
      while (out.length < MAX_RESULTS) {
        const idx = lowerContent.indexOf(lowerQ, from);
        if (idx < 0) break;
        const start = Math.max(0, idx - EXCERPT_PAD);
        const end = Math.min(content.length, idx + q.length + EXCERPT_PAD);
        const prefix = start > 0 ? '…' : '';
        const suffix = end < content.length ? '…' : '';
        out.push({
          cfi: `offset:${idx}`,
          excerpt: `${prefix}${content.slice(start, end)}${suffix}`,
          sectionHref: sectionLabelAt(idx),
        });
        from = idx + Math.max(1, q.length);
      }
    } finally {
      results.value = out;
      searching.value = false;
      ctx.emit('search-results', results.value);
      ctx.emit('searching', false);
    }
  }

  /**
   * 跳转到指定搜索命中位置（cfi 形如 `offset:123`），
   * 并用原生选区标示命中文字（搜索命中可见化）。
   */
  function jumpToSearchResult(cfi: string): void {
    const m = /^offset:(\d+)$/.exec(cfi || '');
    if (!m) return;
    const start = parseInt(m[1], 10);
    render.jumpToOffset(start);
    const len = lastTerm.length || 1;
    render.selectRange(start, start + len);
  }

  /** 清空搜索结果与命中选区 */
  function clearSearch(): void {
    render.clearSelection();
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
