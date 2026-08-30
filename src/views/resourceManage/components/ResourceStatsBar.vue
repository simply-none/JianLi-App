<template>
  <div class="resource-stats-bar">
    <div class="stat-item">
      <LucideIcon name="Files" :size="14" />
      <span class="stat-label">资源总数</span>
      <span class="stat-value">{{ stats.total }}</span>
    </div>
    <div class="stat-item">
      <LucideIcon name="HardDrive" :size="14" />
      <span class="stat-label">总占用</span>
      <span class="stat-value">{{ formatSize(stats.totalSize) }}</span>
    </div>
    <div class="stat-types">
      <el-tag
        v-for="opt in typeBadges"
        :key="opt.type"
        :class="['type-tag', opt.type]"
        size="small"
        effect="plain"
      >
        {{ opt.label }} {{ opt.count }}
      </el-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 资源统计条：展示资源总数 / 总占用大小 / 各类型数量徽章
 * 数据由父组件传入（来自 useResourceList 的 stats 计算属性）。
 */
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { getTypeLabel, formatSize } from '../utils/fileType';
import type { ResourceStats, ResourceType } from '../types';

/** 组件属性定义 */
const props = defineProps<{
  /** 统计信息（必填） */
  stats: ResourceStats;
}>();

/** 各类型数量徽章（仅展示数量大于 0 的类型） */
const typeBadges = computed(() => {
  const types: ResourceType[] = [
    'image', 'video', 'audio', 'text', 'pdf', 'font', 'archive', 'document', 'other',
  ];
  return types
    .map((type) => ({ type, label: getTypeLabel(type), count: props.stats.typeCounts[type] || 0 }))
    .filter((badge) => badge.count > 0);
});
</script>

<style scoped lang="scss">
.resource-stats-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--text-secondary);

    .stat-value {
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .stat-types {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-left: auto;

    .type-tag {
      border: none;

      &.image { background: rgba(99, 102, 241, 0.1); color: var(--color-primary); }
      &.video { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      &.audio { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
      &.text  { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
      &.pdf   { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      &.font  { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
      &.archive { background: rgba(6, 182, 212, 0.1); color: #06b6d4; }
      &.document { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
      &.other { background: rgba(156, 163, 175, 0.1); color: var(--text-muted); }
    }
  }
}
</style>
