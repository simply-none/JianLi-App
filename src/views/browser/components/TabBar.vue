<template>
  <!-- 顶部标签栏：favicon / 加载动画 / 标题 / 关闭按钮，支持中键关闭 -->
  <div class="tab-bar" @dblclick.self="onAddTab">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ 'is-active': tab.id === activeTabId }"
      :title="tab.url === 'newtab' ? tab.title : tab.url"
      @click="setActiveTab(tab.id)"
      @auxclick.middle="closeTab(tab.id)"
    >
      <!-- 图标区：加载中转圈，否则 favicon，兜底地球图标 -->
      <span class="tab-icon">
        <LucideIcon v-if="tab.loading" name="LoaderCircle" :size="14" class="is-spinning" />
        <img v-else-if="tab.favicon" :src="tab.favicon" class="tab-favicon" alt="" />
        <LucideIcon v-else-if="!tab.isNewTab" name="Earth" :size="14" />
        <LucideIcon v-else name="Plus" :size="14" />
      </span>
      <span class="tab-title">{{ tab.title }}</span>
      <span class="tab-close" title="关闭标签页 (Ctrl+W)" @click.stop="closeTab(tab.id)">
        <LucideIcon name="X" :size="12" />
      </span>
    </div>
    <div class="tab-add" title="新建标签页 (Ctrl+T)" @click="onAddTab">
      <LucideIcon name="Plus" :size="15" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 标签栏
 * 职责：展示标签列表、切换/关闭/新建标签；中键关闭、双击空白新建。
 * 状态与动作直接来自 useBrowser store，无本地状态。
 */
import { storeToRefs } from "pinia";
import LucideIcon from "@/components/LucideIcon.vue";
import useBrowser from "@/store/useBrowser";

const browserStore = useBrowser();
const { tabs, activeTabId } = storeToRefs(browserStore);
const { createTab, closeTab, setActiveTab } = browserStore;

/** 新建空白标签页 */
function onAddTab() {
  createTab();
}
</script>

<style scoped lang="scss">
.tab-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
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
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  max-width: 180px;
  min-width: 100px;
  transition: all 0.2s;
  user-select: none;
  flex-shrink: 0;

  .tab-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: var(--text-muted);
  }

  .tab-favicon {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    object-fit: contain;
  }

  .tab-title {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .tab-close {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    opacity: 0;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-hover);
    }
  }

  &.is-active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);

    .tab-title {
      color: var(--color-primary-solid);
      font-weight: 500;
    }
    .tab-close {
      opacity: 0.6;
    }
  }

  &:hover {
    &:not(.is-active) {
      background: var(--bg-hover);
    }
    .tab-close {
      opacity: 0.6;
    }
  }
}

.tab-add {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px dashed var(--border-subtle);
  color: var(--text-muted);
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--color-primary);
  }
}

.is-spinning {
  animation: tab-spin 1s linear infinite;
}

@keyframes tab-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
