<template>
  <div class="resource-toolbar">
    <!-- 左侧：搜索 + 类型筛选 -->
    <div class="toolbar-left">
      <el-input
        :model-value="keyword"
        class="search-input"
        placeholder="搜索文件名..."
        clearable
        :prefix-icon="Search"
        @update:model-value="emit('update:keyword', $event)"
      />
      <el-select
        :model-value="filterTypes"
        class="type-filter"
        multiple
        collapse-tags
        collapse-tags-tooltip
        clearable
        placeholder="全部类型"
        @update:model-value="emit('update:filterTypes', $event)"
      >
        <el-option
          v-for="opt in typeOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </div>

    <!-- 右侧：排序 / 视图 / 批量操作 -->
    <div class="toolbar-right">
      <el-select
        :model-value="sortBy"
        class="sort-select"
        @update:model-value="emit('update:sortBy', $event)"
      >
        <el-option label="按添加时间" value="created_at" />
        <el-option label="按名称" value="name" />
        <el-option label="按大小" value="size" />
      </el-select>
      <el-button
        class="order-btn"
        :title="order === 'desc' ? '降序' : '升序'"
        @click="emit('update:order', order === 'desc' ? 'asc' : 'desc')"
      >
        <LucideIcon :name="order === 'desc' ? 'ArrowDown' : 'ArrowUp'" :size="14" />
      </el-button>

      <div class="view-toggle">
        <el-button
          :type="viewMode === 'grid' ? 'primary' : ''"
          :title="'网格视图'"
          @click="emit('update:viewMode', 'grid')"
        >
          <LucideIcon name="LayoutGrid" :size="14" />
        </el-button>
        <el-button
          :type="viewMode === 'list' ? 'primary' : ''"
          :title="'列表视图'"
          @click="emit('update:viewMode', 'list')"
        >
          <LucideIcon name="List" :size="14" />
        </el-button>
      </div>

      <el-button
        :type="batchMode ? 'warning' : ''"
        @click="emit('update:batchMode', !batchMode)"
      >
        <LucideIcon name="CheckSquare" :size="14" />
        {{ batchMode ? '退出批量' : '批量' }}
      </el-button>

      <el-button :loading="refreshing" title="刷新列表" @click="emit('refresh')">
        <LucideIcon name="RefreshCw" :size="14" />
      </el-button>
    </div>

    <!-- 批量操作条 -->
    <div v-if="batchMode" class="batch-bar">
      <span class="batch-count">已选 {{ selectedCount }} / {{ totalCount }} 项</span>
      <el-button size="small" :disabled="selectedCount >= totalCount" @click="emit('select-all')">
        全选
      </el-button>
      <el-button size="small" :disabled="selectedCount === 0" @click="emit('clear-selection')">
        取消选择
      </el-button>
      <el-button
        size="small"
        type="danger"
        :disabled="selectedCount === 0"
        @click="emit('batch-delete')"
      >
        批量删除
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 资源管理工具栏：搜索 / 类型筛选 / 排序 / 视图切换 / 批量操作入口
 * 全部状态由父组件（index.vue）通过 v-model 双向绑定，本组件不持有状态。
 */
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { Search } from '@lucide/vue';
import { getTypeLabel } from '../utils/fileType';
import type { ResourceType, SortField, SortOrder, ViewMode } from '../types';

/** 组件属性定义 */
defineProps<{
  /** 搜索关键词（双向绑定） */
  keyword: string;
  /** 类型筛选（双向绑定，空数组=全部） */
  filterTypes: ResourceType[];
  /** 排序字段（双向绑定） */
  sortBy: SortField;
  /** 排序方向（双向绑定） */
  order: SortOrder;
  /** 视图模式（双向绑定） */
  viewMode: ViewMode;
  /** 批量模式开关（双向绑定） */
  batchMode: boolean;
  /** 已选数量 */
  selectedCount: number;
  /** 资源总数 */
  totalCount: number;
  /** 刷新按钮 loading 态 */
  refreshing?: boolean;
}>();

/** 组件事件定义 */
const emit = defineEmits<{
  (e: 'update:keyword', value: string): void;
  (e: 'update:filterTypes', value: ResourceType[]): void;
  (e: 'update:sortBy', value: SortField): void;
  (e: 'update:order', value: SortOrder): void;
  (e: 'update:viewMode', value: ViewMode): void;
  (e: 'update:batchMode', value: boolean): void;
  (e: 'select-all'): void;
  (e: 'clear-selection'): void;
  (e: 'batch-delete'): void;
  (e: 'refresh'): void;
}>();

/** 类型筛选下拉选项 */
const typeOptions = computed(() => {
  const types: ResourceType[] = [
    'image', 'video', 'audio', 'text', 'pdf', 'font', 'archive', 'document', 'other',
  ];
  return types.map((t) => ({ value: t, label: getTypeLabel(t) }));
});
</script>

<style scoped lang="scss">
.resource-toolbar {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 260px;

    .search-input {
      width: 220px;
    }

    .type-filter {
      width: 200px;
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .sort-select {
      width: 130px;
    }

    .order-btn {
      padding: 8px;
    }

    .view-toggle {
      display: flex;
      gap: 0;

      :deep(.el-button + .el-button) {
        margin-left: 0;
      }

      :deep(.el-button:first-child) {
        border-radius: var(--radius-card) 0 0 var(--radius-card);
      }

      :deep(.el-button:last-child) {
        border-radius: 0 var(--radius-card) var(--radius-card) 0;
      }
    }
  }

  .batch-bar {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--border-subtle);

    .batch-count {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-right: 4px;
    }
  }
}
</style>
