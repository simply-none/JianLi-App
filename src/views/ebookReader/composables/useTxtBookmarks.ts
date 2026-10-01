/**
 * TxtReader 书签 composable
 *
 * 与 usePdfBookmarks 同构：复用通用 ebook_bookmark 表与 IPC，锚点存「全文字符偏移字符串」
 * （BookmarkRecord.cfi 对任意格式都是自由字符串，无需改表结构）。
 * 差异点：
 *   - 锚点 = 当前视口首字符的全局偏移（与进度/划线同一偏移空间）；
 *   - 书签标签优先取「偏移所属章节标题」（TXT 已做章节识别），无章节时回退「进度 x%」；
 *   - 判重用精确偏移相等（TXT 同一视口的偏移计算是确定性的，天然稳定，无需 EPUB 的段落指纹）。
 */
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import type { TxtCtx } from './txtContext';
import { findChapterIndexByOffset } from '../utils/txtChapters';

/** 书签 composable 所需的渲染侧最小接口（由 useTxtRender 返回值直接满足） */
export interface TxtBookmarkRenderApi {
  /** 当前阅读位置（视口首字符全局偏移） */
  currentStartOffset: () => number;
  /** 跳转到指定全局字符偏移 */
  jumpToOffset: (offset: number) => void;
}

export function useTxtBookmarks(ctx: TxtCtx, render: TxtBookmarkRenderApi) {
  /** 当前文件的书签列表（按阅读顺序升序） */
  const bookmarks = ref<BookmarkRecord[]>([]);

  /** 当前阅读位置是否已存在书签（按精确偏移判重） */
  const currentBookmarked = computed(() =>
    bookmarks.value.some((b) => b.cfi === String(render.currentStartOffset()))
  );

  /** 书签默认标签：优先章节标题，无章节结构时回退「进度 x%」 */
  function bookmarkLabel(offset: number, percent: number): string {
    const idx = findChapterIndexByOffset(ctx.chapters.value, offset);
    if (idx >= 0 && ctx.chapters.value[idx]?.title) {
      return ctx.chapters.value[idx].title;
    }
    return percent > 0 ? `进度 ${percent}%` : '开头';
  }

  /**
   * 加载指定文件的书签列表（loadContent 完成后调用）。
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
   * 新增当前位置的书签（锚点 = 视口首字符全局偏移）。
   */
  async function addBookmark(): Promise<void> {
    if (!ctx.fullContent.value) return;
    const offset = render.currentStartOffset();
    const total = ctx.fullContent.value.length || 1;
    const percent = Math.min(100, Math.round((offset / total) * 100));
    const label = bookmarkLabel(offset, percent);
    try {
      const res = await window.ipcRenderer.ebook.addBookmark({
        filePath: ctx.props.filePath,
        format: 'txt',
        cfi: String(offset),
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
        format: 'txt',
        cfi: String(offset),
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
        bookmarks.value.splice(idx, 1);
        ctx.emit('bookmarks-updated', bookmarks.value);
      }
    } catch (err) {
      console.error('删除书签异常', err);
      ElMessage.error('删除书签失败');
    }
  }

  /**
   * 重命名书签（标签）：IPC 落库后同步本地列表。
   */
  async function renameBookmark(id: number, label: string): Promise<void> {
    const trimmed = (label || '').trim();
    try {
      const res = await window.ipcRenderer.ebook.updateBookmark({ id, label: trimmed });
      if (!res?.success) {
        ElMessage.error(`重命名书签失败：${res?.error || '未知错误'}`);
        return;
      }
      const target = bookmarks.value.find((b) => b.id === id);
      if (target) target.label = trimmed || null;
      ctx.emit('bookmarks-updated', bookmarks.value);
    } catch (err) {
      console.error('重命名书签异常', err);
      ElMessage.error('重命名书签失败');
    }
  }

  /**
   * 切换当前位置书签：已书签则删除，未书签则新增。
   */
  async function toggleBookmark(): Promise<void> {
    const existing = bookmarks.value.find((b) => b.cfi === String(render.currentStartOffset()));
    if (existing) {
      await removeBookmark(existing.id);
    } else {
      await addBookmark();
    }
  }

  /**
   * 跳转到指定书签位置（cfi 为全局字符偏移字符串）。
   */
  function jumpToBookmark(cfi: string): void {
    const offset = parseInt(cfi, 10);
    if (!Number.isNaN(offset) && offset >= 0) {
      render.jumpToOffset(offset);
    }
  }

  // 暴露给 render composable（loadContent 完成后加载书签）
  ctx.loadBookmarks = loadBookmarks;

  return {
    bookmarks,
    currentBookmarked,
    loadBookmarks,
    addBookmark,
    removeBookmark,
    renameBookmark,
    toggleBookmark,
    jumpToBookmark,
  };
}
