/**
 * PdfReader 书签 composable
 *
 * 与 usePdfRender / usePdfHighlight 共享同一个 ctx（见 pdfContext.ts）。本 composable 负责：
 *   - 基于当前页码新增 / 删除书签，并持久化到主进程数据库（复用通用 ebook_bookmark 表与 IPC）
 *   - 加载并维护当前文件的书签列表（按阅读百分比升序）
 *   - 判断「当前页是否已书签」（用于底部按钮填充态）
 *   - 跳转到指定书签（复用 ctx.goToPage）
 *
 * 与 epub 的差异：epub 用 CFI 作锚点，PDF 用「页码字符串」作锚点（存入 BookmarkRecord.cfi 字段，
 * 该字段对任意格式都是自由字符串，故复用即可，无需改表结构）。外壳 BookmarksDrawer 通过
 * current-cfi 高亮当前书签，PDF 侧把 currentFileCfi 设为当前页码字符串即可对齐。
 */
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import type { PdfCtx } from './pdfContext';

export function usePdfBookmarks(ctx: PdfCtx) {
  /** 当前文件的书签列表（按阅读顺序升序） */
  const bookmarks = ref<BookmarkRecord[]>([]);

  /** 当前阅读页码是否已存在书签 */
  const currentBookmarked = computed(() =>
    bookmarks.value.some((b) => b.cfi === String(ctx.currentPage.value))
  );

  /**
   * 加载指定文件的书签列表（loadDocument 完成后调用）。
   */
  async function loadBookmarks(filePath: string): Promise<void> {
    if (!filePath) return;
    try {
      const res = await window.ipcRenderer.ebook.getBookmarks(filePath);
      if (res?.success && Array.isArray(res.data)) {
        bookmarks.value = res.data;
        ctx.emit('bookmarks-updated', bookmarks.value);
      }
    } catch (err) {
      console.error('加载书签列表失败', err);
    }
  }

  /**
   * 新增当前页码的书签。
   */
  async function addBookmark(): Promise<void> {
    const page = ctx.currentPage.value;
    if (!page) return;
    const percent = Math.min(100, Math.round((page / Math.max(1, ctx.numPages.value)) * 100));
    const label = `第 ${page} 页`;
    try {
      const res = await window.ipcRenderer.ebook.addBookmark({
        filePath: ctx.props.filePath,
        format: 'pdf',
        cfi: String(page),
        label,
        percent,
      });
      if (!res?.success || typeof res.id !== 'number') {
        ElMessage.error(`添加书签失败：${res?.error || '未知错误'}`);
        return;
      }
      const record: BookmarkRecord = {
        id: res.id,
        file_path: ctx.props.filePath,
        format: 'pdf',
        cfi: String(page),
        label,
        percent,
        created_at: new Date().toISOString(),
      };
      bookmarks.value.push(record);
      bookmarks.value.sort((a, b) => a.percent - b.percent);
      ctx.emit('bookmarks-updated', bookmarks.value);
      ElMessage.success('已添加书签');
    } catch (err) {
      console.error('添加书签异常', err);
      ElMessage.error('添加书签失败');
    }
  }

  /**
   * 删除指定书签（按数据库 id）。
   */
  async function removeBookmark(id: number): Promise<void> {
    try {
      const res = await window.ipcRenderer.ebook.removeBookmark(id);
      if (!res?.success) {
        ElMessage.error(`删除书签失败：${res?.error || '未知错误'}`);
        return;
      }
      const idx = bookmarks.value.findIndex((b) => b.id === id);
      if (idx !== -1) {
        bookmarks.value.splice(idx, 1);
        ctx.emit('bookmarks-updated', bookmarks.value);
      }
    } catch (err) {
      console.error('删除书签异常', err);
      ElMessage.error('删除书签失败');
    }
  }

  /**
   * 切换当前页书签：已书签则删除，未书签则新增。
   */
  async function toggleBookmark(): Promise<void> {
    const existing = bookmarks.value.find((b) => b.cfi === String(ctx.currentPage.value));
    if (existing) {
      await removeBookmark(existing.id);
    } else {
      await addBookmark();
    }
  }

  /**
   * 跳转到指定书签位置（cfi 为页码字符串）。
   */
  function jumpToBookmark(cfi: string): void {
    const page = Number(cfi);
    if (!Number.isNaN(page) && page > 0 && page <= ctx.numPages.value) {
      ctx.goToPage?.(page, true);
    }
  }

  return {
    bookmarks,
    currentBookmarked,
    loadBookmarks,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    jumpToBookmark,
  };
}
