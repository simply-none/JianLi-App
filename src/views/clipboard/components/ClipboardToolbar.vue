<template>
  <!-- 顶部【普通查询】区：关键词搜索 + 查询/重置 + 高级查询开关 + 清空全部 -->
  <div class="clipboard-toolbar">
    <div class="search-box">
      <LucideIcon name="Search" class="search-icon" />
      <el-input
        :model-value="keyword"
        placeholder="搜索剪贴板内容..."
        clearable
        @update:model-value="$emit('update:keyword', $event)"
        @keyup.enter="$emit('search')"
      />
    </div>

    <div class="toolbar-actions">
      <el-button type="primary" @click="$emit('search')">查询</el-button>
      <el-button @click="$emit('reset')">重置</el-button>
      <el-button :type="advancedOpen ? 'warning' : 'default'" @click="$emit('toggle-advanced')">
        <LucideIcon name="Filter" :size="14" />
        高级查询
      </el-button>
      <el-button type="danger" @click="$emit('clear-all')">
        <LucideIcon name="Trash2" :size="14" />
        清空全部
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'

defineProps<{
  keyword: string
  advancedOpen: boolean
}>()

defineEmits<{
  (e: 'update:keyword', v: string): void
  (e: 'search'): void
  (e: 'reset'): void
  (e: 'toggle-advanced'): void
  (e: 'clear-all'): void
}>()
</script>

<style scoped lang="scss">
.clipboard-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 12px 16px;
  gap: 12px;
  flex-wrap: wrap;

  .search-box {
    flex: 1;
    max-width: 400px;
    min-width: 200px;
    position: relative;

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 16px;
      z-index: 1;
    }

    :deep(.el-input__wrapper) {
      padding-left: 36px;
      background: var(--bg-base);
      box-shadow: 0 0 0 1px var(--border-subtle) inset;

      &:hover {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }
    }
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .el-button + .el-button {
      margin-left: 0 !important;
    }
  }
}
</style>
