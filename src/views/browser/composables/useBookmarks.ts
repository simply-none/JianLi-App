/**
 * 内置浏览器 - 书签状态（模块级单例 composable）
 * ------------------------------------------------------------------
 * 持有全部书签列表与「已收藏地址集合」，供NavBar 星标按钮、
 * BookmarkPanel 书签面板、AddressBar 下拉建议共享同一份状态。
 */
import { computed, ref } from "vue";
import { addBookmark as apiAdd, fetchBookmarks, removeBookmark as apiRemove, type BookmarkRecord } from "../api/browserApi";

/** 全部书签列表（按收藏时间倒序） */
const bookmarks = ref<BookmarkRecord[]>([]);
/** 是否已加载过（避免面板反复重复拉取） */
const loaded = ref(false);
/** 加载中标记 */
const loading = ref(false);

/** 已收藏地址集合（O(1) 判断当前页是否已收藏） */
const bookmarkedUrls = computed(() => new Set(bookmarks.value.map((b) => b.key)));

/**
 * 从数据库加载书签列表
 */
export async function loadBookmarks(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  try {
    bookmarks.value = await fetchBookmarks();
    loaded.value = true;
  } finally {
    loading.value = false;
  }
}

/**
 * 判断地址是否已收藏
 * @param url 必填，地址
 * @returns true 表示已收藏
 */
export function isBookmarked(url: string): boolean {
  return !!url && bookmarkedUrls.value.has(url);
}

/**
 * 添加书签（成功后同步本地列表）
 * @param url 必填，地址
 * @param title 可选，标题
 * @returns 是否成功
 */
export async function addBookmark(url: string, title: string = ""): Promise<boolean> {
  const ok = await apiAdd(url, title);
  if (ok && !isBookmarked(url)) {
    bookmarks.value = [{ key: url, title, create_time: new Date().toISOString() }, ...bookmarks.value];
  }
  return ok;
}

/**
 * 删除书签（成功后同步本地列表）
 * @param url 必填，地址
 * @returns 是否成功
 */
export async function removeBookmark(url: string): Promise<boolean> {
  const ok = await apiRemove(url);
  if (ok) {
    bookmarks.value = bookmarks.value.filter((b) => b.key !== url);
  }
  return ok;
}

/**
 * 切换当前地址的收藏状态
 * @param url 必填，地址
 * @param title 可选，标题
 * @returns 切换后的状态：true 已收藏 / false 已取消
 */
export async function toggleBookmark(url: string, title: string = ""): Promise<boolean> {
  if (isBookmarked(url)) {
    await removeBookmark(url);
    return false;
  }
  await addBookmark(url, title);
  return true;
}

/**
 * 获取书签单例状态（组件中统一入口）
 */
export function useBookmarks() {
  return { bookmarks, loaded, loading, loadBookmarks, isBookmarked, addBookmark, removeBookmark, toggleBookmark };
}
