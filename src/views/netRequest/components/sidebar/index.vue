<template>
  <div class="sidebar">
    <!-- 顶部页签：历史 | 集合 -->
    <div class="sidebar-tabs">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="sidebar-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <LucideIcon :name="tab.icon" :size="14" />
        {{ tab.label }}
      </div>
    </div>

    <!-- 历史面板 -->
    <HistoryPanel
      v-if="activeTab === 'history'"
      :items="historyList"
      @load="(cfg) => emit('load', cfg)"
      @delete="(id) => emit('deleteHistory', id)"
      @clear="emit('clearHistory')"
      @search="(kw) => emit('searchHistory', kw)"
    />

    <!-- 集合面板 -->
    <CollectionPanel
      v-else
      :tree="tree"
      @load="(cfg, id, name) => emit('load', cfg, id, name)"
      @create-folder="(pid) => emit('createFolder', pid)"
      @rename="(id, name) => emit('renameNode', id, name)"
      @delete="(id) => emit('deleteNode', id)"
      @import="emit('import')"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 侧边栏容器：历史 / 集合两个页签
 * 数据与操作均由父组件（index.vue）通过 composables 管理后传入
 */
import { ref } from 'vue'
import HistoryPanel from './HistoryPanel.vue'
import CollectionPanel from './CollectionPanel.vue'
import type { CollectionNode, HistoryItem, RequestConfig } from '../../types'

/** 页签定义 */
const tabs = [
  { key: 'history', label: '历史', icon: 'History' },
  { key: 'collection', label: '集合', icon: 'Folders' },
] as const

/** 当前激活页签 */
const activeTab = ref<'history' | 'collection'>('history')

/** 组件 props 定义 */
defineProps<{
  /** 历史列表 */
  historyList: HistoryItem[];
  /** 集合树 */
  tree: CollectionNode[];
}>()

/** 事件：转发各面板操作 */
const emit = defineEmits<{
  (e: 'load', config: RequestConfig, nodeId?: number, name?: string): void
  (e: 'deleteHistory', id: number): void
  (e: 'clearHistory'): void
  (e: 'searchHistory', keyword: string): void
  (e: 'createFolder', parentId: number): void
  (e: 'renameNode', id: number, name: string): void
  (e: 'deleteNode', id: number): void
  (e: 'import'): void
}>()
</script>

<style scoped lang="scss">
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.sidebar-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 0;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: var(--el-text-color-secondary);

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-weight: 600;
  }
}
</style>
