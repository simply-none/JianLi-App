<template>
  <div class="resource-grid">
    <ResourceCard
      v-for="item in items"
      :key="item.key"
      :item="item"
      :batch-mode="batchMode"
      :selected="selectedKeys.has(item.key)"
      @preview="emit('preview', $event)"
      @open-location="emit('open-location', $event)"
      @star="emit('star', $event)"
      @delete="emit('delete', $event)"
      @toggle-select="emit('toggle-select', $event)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 资源网格视图：自适应列网格容器，内部渲染 ResourceCard 并上抛其事件
 */
import ResourceCard from './ResourceCard.vue';
import type { ResourceItem } from '../types';

/** 组件属性定义 */
defineProps<{
  /** 资源列表（必填，已筛选排序） */
  items: ResourceItem[];
  /** 是否批量模式 */
  batchMode?: boolean;
  /** 已选中主键集合 */
  selectedKeys: Set<string>;
}>();

/** 组件事件定义（转发卡片操作） */
const emit = defineEmits<{
  (e: 'preview', item: ResourceItem): void;
  (e: 'open-location', item: ResourceItem): void;
  (e: 'star', item: ResourceItem): void;
  (e: 'delete', item: ResourceItem): void;
  (e: 'toggle-select', key: string): void;
}>();
</script>

<style scoped lang="scss">
.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  width: 100%;
}
</style>
