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
      @copy-curl="(cfg) => emit('copyHistoryCurl', cfg)"
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
      @copy-curl="(n) => emit('copyNodeCurl', n)"
      @move="(dragId, targetId) => emit('moveNode', dragId, targetId)"
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
  (e: 'copyHistoryCurl', config: RequestConfig): void
  (e: 'copyNodeCurl', node: CollectionNode): void
  (e: 'moveNode', dragId: number, targetParentId: number): void
}>()
</script>

<style scoped lang="scss">
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}

// 页签：胶囊分段容器
.sidebar-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.sidebar-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 0;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: all 0.15s;

  &:hover {
    color: var(--el-text-color-primary);
  }

  &.active {
    background: var(--el-bg-color);
    color: var(--el-color-primary);
    font-weight: 600;
    box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
  }
}
</style>
