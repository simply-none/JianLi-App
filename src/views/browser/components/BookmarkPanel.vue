<template>
  <!-- 书签管理抽屉：列表 + 点击打开 + 单条删除 -->
  <el-drawer
    v-model="visible"
    title="书签"
    direction="rtl"
    size="380px"
    :append-to-body="true"
  >
    <div class="bookmark-panel">
      <div class="bookmark-list">
        <template v-if="bookmarks.length > 0">
          <div
            v-for="item in bookmarks"
            :key="item.key"
            class="bookmark-item"
            :title="item.key"
            @click="onOpen(item.key)"
          >
            <span class="item-icon">
              <LucideIcon name="Bookmark" :size="14" />
            </span>
            <span class="item-body">
              <span class="item-title">{{ item.title || item.key }}</span>
              <span class="item-sub">{{ item.key }}</span>
            </span>
            <span class="item-delete" title="删除书签" @click.stop="onDelete(item.key)">
              <LucideIcon name="Trash2" :size="13" />
            </span>
          </div>
        </template>
        <div v-else class="bookmark-empty">
          <LucideIcon name="BookMarked" :size="36" color="var(--text-muted)" />
          <p>暂无书签，点击地址栏右侧书签按钮收藏</p>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 书签管理抽屉
 * 数据源为 useBookmarks 单例状态（与地址栏星标共享），点击条目新标签打开。
 */
import LucideIcon from "@/components/LucideIcon.vue";
import { useBookmarks, removeBookmark } from "../composables/useBookmarks";
import useBrowser from "@/store/useBrowser";

/** 抽屉显隐（v-model:visible） */
const visible = defineModel<boolean>("visible", { default: false });

const emit = defineEmits<{
  /** 请求打开某地址 */
  (e: "open-url", url: string): void;
}>();

const browserStore = useBrowser();
const { bookmarks } = useBookmarks();

/**
 * 新标签页打开书签
 * @param url 必填，地址
 */
function onOpen(url: string) {
  browserStore.createTab(url, "书签打开");
  emit("open-url", url);
}

/**
 * 删除书签
 * @param url 必填，地址
 */
async function onDelete(url: string) {
  await removeBookmark(url);
}
</script>

<style scoped lang="scss">
.bookmark-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.bookmark-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.bookmark-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--bg-hover);

    .item-delete {
      opacity: 1;
    }
  }

  .item-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .item-title {
      font-size: 13px;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-sub {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .item-delete {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;

    &:hover {
      color: var(--color-danger, #f56c6c);
    }
  }
}

.bookmark-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 20px;
  color: var(--text-muted);
  text-align: center;

  p {
    font-size: 13px;
    margin: 0;
  }
}
</style>
