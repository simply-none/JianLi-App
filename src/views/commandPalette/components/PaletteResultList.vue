<template>
  <!-- 结果列表：条目数量有限（≤30），直接用 v-for，不接 VirtualList -->
  <div class="palette-list">
    <PaletteResultItem
      v-for="(item, index) in items"
      :key="item.id"
      :item="item"
      :active="index === activeIndex"
      @select="$emit('select', index)"
      @run="$emit('run', index)"
    />

    <PaletteEmpty v-if="!items.length" :loading="loading" :query="query" />

    <div v-if="items.length && loading" class="palette-list__loading">搜索中…</div>
  </div>
</template>

<script setup lang="ts">
import PaletteResultItem from './PaletteResultItem.vue'
import PaletteEmpty from './PaletteEmpty.vue'
import type { CommandItem } from '../types'

defineProps<{
  items: CommandItem[]
  activeIndex: number
  loading: boolean
  query: string
}>()

defineEmits<{
  (e: 'select', index: number): void
  (e: 'run', index: number): void
}>()
</script>

<style scoped lang="scss">
.palette-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-subtle);
    border-radius: 3px;
  }

  &__loading {
    padding: 8px 10px;
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
  }
}
</style>
