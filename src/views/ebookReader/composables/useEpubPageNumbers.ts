/**
 * EpubReader 真实页码 composable
 *
 * 与 useEpubRender / useEpubHighlight / useEpubBookmarks / useEpubSearch 共享同一个 ctx（见 epubContext.ts）。
 * 本 composable 负责：
 *   - 加载 epub 自带的 pageList（印刷页码映射），仅在书籍包含 page-map 时生效
 *   - 根据当前 CFI 计算真实印刷页码（第 N / 共 M 页），随翻页实时更新
 *   - 暴露 hasPageList 供 UI 决定是否展示真实页码（无 pageList 则不展示，回退到原有「当前页/总页」）
 *
 * 依赖：epubjs 的 book.pageList（需 book.loaded.pageList 解析完成），且 pageFromCfi 内部需要
 * locations 已生成——本应用已在 render 阶段生成 locations，故可正常计算。
 */
import { ref } from 'vue';
import type { EpubCtx } from './epubContext';

export function useEpubPageNumbers(ctx: EpubCtx) {
  /** 真实印刷页码展示文本（如「第 123 / 456 页」），无 pageList 时为空 */
  const printPage = ref('');
  /** 当前书籍是否包含 pageList（决定是否展示真实页码） */
  const hasPageList = ref(false);

  /** 内部持有 pageList 实例，避免反复 await */
  let pageListRef: any = null;

  /**
   * 初始化页码映射：解析 book.loaded.pageList，成功后标记 hasPageList 并刷新一次当前页码。
   */
  async function setupPageNumbers(): Promise<void> {
    const book = ctx.book;
    if (!book) return;
    try {
      const pl = await (book.loaded as any).pageList;
      if (pl && Array.isArray(pl.pages) && pl.pages.length > 0) {
        pageListRef = pl;
        hasPageList.value = true;
        updatePrintPage(ctx.currentCfi.value);
      } else {
        hasPageList.value = false;
        printPage.value = '';
      }
    } catch (err) {
      // 书籍不含 pageList 或解析失败：不展示真实页码，不影响阅读
      console.warn('加载 pageList 失败（本书可能无印刷页码映射）', err);
      hasPageList.value = false;
      printPage.value = '';
    }
  }

  /**
   * 根据 CFI 更新真实页码展示。
   * @param cfi - 当前阅读位置 CFI
   */
  function updatePrintPage(cfi: string): void {
    if (!hasPageList.value || !cfi || !pageListRef) {
      printPage.value = '';
      return;
    }
    try {
      const pg = pageListRef.pageFromCfi(cfi);
      if (typeof pg === 'number' && pg > 0) {
        const total = pageListRef.totalPages || pageListRef.pages.length;
        printPage.value = `第 ${pg} / ${total} 页`;
      } else {
        printPage.value = '';
      }
    } catch (err) {
      console.warn('计算真实页码失败', err);
      printPage.value = '';
    }
  }

  // 暴露给 render composable（book 就绪后初始化 / relocated 时刷新）
  ctx.setupPageNumbers = setupPageNumbers;
  ctx.updatePrintPage = updatePrintPage;

  return {
    printPage,
    hasPageList,
    setupPageNumbers,
    updatePrintPage,
  };
}
