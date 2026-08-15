/**
 * EpubReader 书签 composable
 *
 * 与 useEpubRender / useEpubHighlight 共享同一个 ctx（见 epubContext.ts）。本 composable 负责：
 *   - 基于当前阅读位置（CFI）新增 / 删除书签，并持久化到主进程数据库
 *   - 加载并维护当前文件的书签列表（按阅读顺序排序）
 *   - 判断「当前页是否已书签」（用于工具栏书签按钮的填充态）
 *   - 跳转到指定书签位置
 *
 * 注意：epubjs 原生没有书签概念，这里用 locations 的 CFI 作为定位锚点，配合主进程
 * ebook_bookmark 表实现持久化。本 composable 仅由 EpubReader 使用（format 恒为 'epub'）。
 */
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import type { EpubCtx } from './epubContext';

export function useEpubBookmarks(ctx: EpubCtx) {
  /** 当前文件的书签列表（按阅读顺序升序） */
  const bookmarks = ref<BookmarkRecord[]>([]);

  /** 当前阅读位置是否已存在书签 */
  const currentBookmarked = computed(() =>
    bookmarks.value.some((b) => b.cfi === ctx.currentCfi.value)
  );

  /**
   * 根据当前 href 反查目录项标题，作为书签默认标签。
   * 查不到时回退为「进度 x%」或空串。
   */
  function currentChapterLabel(): string {
    const href = ctx.currentHref.value;
    const book = ctx.book;
    if (href && book?.navigation?.get) {
      try {
        const item = book.navigation.get(href);
        const label = (item as any)?.label;
        if (label) return String(label);
      } catch {
        // 忽略：导航项查询失败时回退
      }
    }
    const pct = ctx.progressText.value.replace('%', '');
    return pct ? `进度 ${pct}%` : '';
  }

  /**
   * 加载指定文件的书签列表（在 display 完成后调用）。
   */
  async function loadBookmarks(filePath: string): Promise<void> {
    if (!filePath) return;
    try {
      const res = await window.ipcRenderer.ebook.getBookmarks(filePath, ctx.contentHash || '');
      if (res?.success && Array.isArray(res.data)) {
        bookmarks.value = res.data;
        ctx.emit('bookmarks-updated', bookmarks.value);
      }
    } catch (err) {
      console.error('加载书签列表失败', err);
    }
  }

  /**
   * 新增当前位置的 book签。
   */
  async function addBookmark(): Promise<void> {
    const cfi = ctx.currentCfi.value;
    if (!cfi || !ctx.rendition) return;
    const label = currentChapterLabel();
    const percent = Number(ctx.progressText.value.replace('%', '')) || 0;
    try {
      const res = await window.ipcRenderer.ebook.addBookmark({
        filePath: ctx.props.filePath,
        format: 'epub',
        cfi,
        label,
        percent,
        contentHash: ctx.contentHash || '',
      });
      if (!res?.success || typeof res.id !== 'number') {
        ElMessage.error(`添加书签失败：${res?.error || '未知错误'}`);
        return;
      }
      const record: BookmarkRecord = {
        id: res.id,
        file_path: ctx.props.filePath,
        format: 'epub',
        cfi,
        label: label || null,
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
        const removed = bookmarks.value[idx];
        bookmarks.value.splice(idx, 1);
        // 若删除的是「当前页书签」，列表变化需同步 currentBookmarked 计算属性（自动），
        // 但为即时反馈仍 emit 一次
        ctx.emit('bookmarks-updated', bookmarks.value);
        void removed;
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
    const existing = bookmarks.value.find((b) => b.cfi === ctx.currentCfi.value);
    if (existing) {
      await removeBookmark(existing.id);
    } else {
      await addBookmark();
    }
  }

  /**
   * 跳转到指定书签位置。
   */
  function jumpToBookmark(cfi: string): void {
    if (!ctx.rendition || !cfi) return;
    ctx.rendition.display(cfi);
  }

  // 暴露给 render composable（display 完成后加载书签）
  ctx.loadBookmarks = loadBookmarks;

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
