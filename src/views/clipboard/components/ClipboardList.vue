<template>
  <!-- 剪贴板列表（原子组件）：虚拟滚动 + 空态 + 批量删除工具条 -->
  <div class="clipboard-content">
    <VirtualList
      :items="items"
      item-key="id"
      :estimated-item-height="120"
      :gap="12"
      :loading="loading"
      @reach-end="$emit('load-more')"
    >
      <template #default="{ item }">
        <ClipboardCard
          :item="item"
          :selected="item.id != null && selectedIds.includes(item.id)"
          :keyword="keyword"
          @copy="$emit('copy', $event)"
          @delete="$emit('delete', $event)"
          @toggle-select="$emit('toggle-select', $event)"
        />
      </template>

      <template #empty>
        <el-empty description="暂无剪贴板记录" />
      </template>

      <template #footer>
        <div v-if="loading" class="loading-state">加载中...</div>
      </template>
    </VirtualList>

    <!-- 批量删除工具条：选中后出现（浮在滚动区之上，不随内容滚动） -->
    <div v-if="selectedIds.length > 0" class="batch-bar">
      <span class="batch-count">已选 {{ selectedIds.length }} 项</span>
      <div class="batch-actions">
        <el-button size="small" @click="$emit('clear-selection')">取消</el-button>
        <el-button size="small" type="danger" @click="$emit('delete-selected')">
          <LucideIcon name="Trash2" :size="12" />
          删除选中
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'
import ClipboardCard from './ClipboardCard.vue'
import type { ClipboardCopyPayload, ClipboardItem } from '../types'

defineProps<{
  items: ClipboardItem[]
  loading: boolean
  hasMore: boolean
  selectedIds: number[]
  /** 当前搜索关键词，透传给卡片做命中高亮 */
  keyword?: string
}>()

const emit = defineEmits<{
  (e: 'load-more'): void
  (e: 'copy', payload: ClipboardCopyPayload): void
  (e: 'delete', item: ClipboardItem): void
  (e: 'toggle-select', id?: number): void
  (e: 'delete-selected'): void
  (e: 'clear-selection'): void
}>()
</script>

<style scoped lang="scss">
.clipboard-content {
  flex: 1;
  min-height: 0;
  position: relative;

  .loading-state {
    text-align: center;
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
  }

  // 批量删除工具条
  .batch-bar {
    position: absolute;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    box-shadow: var(--shadow-card);
    z-index: 2;

    .batch-count {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .batch-actions {
      display: flex;
      gap: 8px;
    }
  }
}
</style>
