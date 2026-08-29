<template>
  <!-- 书签栏：常显横条，点击在当前标签打开，Ctrl+点击新标签打开 -->
  <div v-if="bookmarks.length > 0" class="bookmarks-bar">
    <div
      v-for="bm in bookmarks"
      :key="bm.key"
      class="bookmark-item"
      :title="`${bm.title || bm.key}\n${bm.key}\n（Ctrl+点击在新标签打开）`"
      @click="onOpen(bm, $event)"
    >
      <img class="bookmark-favicon" :src="hostFavicon(bm.key)" alt="" @error="onFaviconError($event)" />
      <span class="bookmark-title">{{ bm.title || hostOf(bm.key) }}</span>
    </div>
    <div class="bookmark-manage" title="管理书签" @click="emit('manage')">
      <LucideIcon name="BookMarked" :size="13" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 书签栏（常显）
 * ------------------------------------------------------------------
 * 职责：横向展示全部书签（favicon + 标题），点击当前标签打开、Ctrl+点击新标签；
 * 尾部「管理」按钮打开书签面板。数据复用 useBookmarks 单例状态。
 * 图标用 Google favicon 服务（与新标签页快捷站点一致），失败自动隐藏。
 */
import { onMounted } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import type { BookmarkRecord } from "../api/browserApi";
import { navigateActiveTab } from "../composables/useWebviewBridge";
import { useBookmarks } from "../composables/useBookmarks";

/** 组件事件 */
const emit = defineEmits<{
  /** 打开书签管理面板 */
  (e: "manage"): void;
}>();

const { bookmarks, loadBookmarks } = useBookmarks();

// 首次挂载拉取书签（已加载则内部自动跳过）
onMounted(() => {
  loadBookmarks();
});

/**
 * 从地址提取主机名
 * @param url 必填，地址
 * @returns 主机名；解析失败返回空串
 */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * 从地址推导站点图标地址（Google favicon 服务）
 * @param url 必填，站点地址
 * @returns 图标地址
 */
function hostFavicon(url: string): string {
  const host = hostOf(url);
  return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
}

/**
 * favicon 加载失败：隐藏图片（保留标题占位）
 * @param e 必填，错误事件
 */
function onFaviconError(e: Event) {
  (e.target as HTMLImageElement).style.display = "none";
}

/**
 * 打开书签：默认当前标签；Ctrl/Cmd+点击新标签
 * @param bm 必填，书签记录
 * @param e 可选，鼠标事件
 */
function onOpen(bm: BookmarkRecord, e?: MouseEvent) {
  if (e && (e.ctrlKey || e.metaKey)) {
    openInNewTab(bm.key);
  } else {
    navigateActiveTab(bm.key);
  }
}

/** 新标签打开（动态取 store 实例） */
async function openInNewTab(url: string) {
  const mod = await import("@/store/useBrowser");
  const store = mod.default();
  store.createTab(url, "书签打开");
}
</script>

<style scoped lang="scss">
.bookmarks-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-subtle);
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 3px;
  }
  &:hover::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
  }

  .bookmark-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    max-width: 160px;
    transition: background 0.15s;

    &:hover {
      background: var(--bg-hover);
    }

    .bookmark-favicon {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .bookmark-title {
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .bookmark-manage {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted);
    flex-shrink: 0;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}
</style>
