<template>
  <div class="clipboard-page">
    <div class="clipboard-header">
      <div class="clipboard-title">
        <h2>剪贴板历史</h2>
        <p>记录您的复制历史，随时查看和管理</p>
      </div>
    </div>

    <!-- 顶部普通查询区 -->
    <ClipboardToolbar
      v-model:keyword="keyword"
      v-model:kind="kind"
      :advanced-open="advancedOpen"
      @search="search"
      @reset="reset"
      @toggle-advanced="advancedOpen = !advancedOpen"
      @clear-all="clearAll"
    />

    <!-- 高级查询（删除场景）：时间范围 + 去重 -->
    <ClipboardAdvancedSearch
      v-model:start-time="startTime"
      v-model:end-time="endTime"
      :open="advancedOpen"
      @query="advancedSearch"
      @delete-by-condition="deleteByCondition"
      @dedup="dedup"
      @close="advancedOpen = false"
    />

    <!-- 列表：滚动分页 + 批量删除 -->
    <ClipboardList
      :items="items"
      :loading="loading"
      :has-more="hasMore"
      :selected-ids="selectedIds"
      :keyword="keyword"
      @load-more="loadMore"
      @copy="({ item, mode }) => copyItem(item, mode)"
      @delete="deleteItem"
      @toggle-select="toggleSelect"
      @delete-selected="deleteSelected"
      @clear-selection="clearSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import ClipboardToolbar from './components/ClipboardToolbar.vue'
import ClipboardAdvancedSearch from './components/ClipboardAdvancedSearch.vue'
import ClipboardList from './components/ClipboardList.vue'
import { useClipboard } from './composables/useClipboard'

// 组合式逻辑（功能化）：查询/分页/删除/清空/高级查询/去重/复制
const {
  items,
  loading,
  hasMore,
  keyword,
  kind,
  startTime,
  endTime,
  advancedOpen,
  selectedIds,
  search,
  reset,
  loadMore,
  copyItem,
  deleteItem,
  deleteSelected,
  clearAll,
  advancedSearch,
  deleteByCondition,
  dedup,
  toggleSelect,
  clearSelection,
} = useClipboard()

onMounted(() => {
  search()
})
</script>

<style scoped lang="scss">
.clipboard-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}

.clipboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .clipboard-title {
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }

    p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-muted);
    }
  }
}
</style>
