<!-- 子任务完成进度条：紧凑展示 已完成/总数 与百分比填充 -->
<template>
  <div class="subtask-progress" :title="`${done}/${total} 已完成`">
    <div class="sp-bar">
      <div class="sp-fill" :style="{ width: pct + '%' }"></div>
    </div>
    <span class="sp-text">
      <LucideIcon name="ListChecks" :size="12" />
      {{ done }}/{{ total }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

const props = defineProps<{
  done: number;
  total: number;
}>();

const pct = computed(() => (props.total ? Math.round((props.done / props.total) * 100) : 0));
</script>

<style scoped lang="scss">
.subtask-progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  .sp-bar {
    width: 48px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-subtle);
    overflow: hidden;
  }

  .sp-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--color-primary);
    transition: width 0.25s ease;
  }

  .sp-text {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--text-muted);
  }
}
</style>
