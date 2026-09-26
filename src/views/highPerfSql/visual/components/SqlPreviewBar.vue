<script setup lang="ts">
/**
 * 底部实时 SQL 预览条：展示当前图编译出的 SQL（与节点片段同源）。
 */
defineProps<{
  sql: string;
  errors: string[];
}>();
</script>

<template>
  <div class="sql-preview" :class="{ invalid: errors.length > 0 }">
    <span class="preview-badge">实时 SQL</span>
    <code v-if="errors.length === 0" class="preview-code">{{ sql }}</code>
    <span v-else class="preview-error">{{ errors[0] }}{{ errors.length > 1 ? `（等 ${errors.length} 个问题）` : "" }}</span>
  </div>
</template>

<style scoped lang="scss">
.sql-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #1e293b;
  border-radius: 8px;
  min-height: 40px;
  box-sizing: border-box;

  &.invalid {
    background: #45272a;
  }
}

.preview-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 500;
}

.preview-code {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}

.preview-error {
  font-size: 11px;
  color: #fecaca;
}
</style>
