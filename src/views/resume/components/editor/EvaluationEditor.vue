<template>
  <div class="evaluation-editor">
    <el-input
      :model-value="evaluation"
      type="textarea"
      :rows="6"
      maxlength="600"
      show-word-limit
      placeholder="简要总结个人优势、职业态度与核心竞争力，建议 3-5 行，每行一个要点"
      @update:model-value="$emit('update:evaluation', $event)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 自我评价编辑器
 * 多行文本域，通过 v-model:evaluation 与父组件双向绑定。
 */
defineProps<{
  /** 自我评价文本 */
  evaluation: string
}>()

defineEmits<{
  /** 评价内容变更时触发 */
  (e: 'update:evaluation', value: string): void
}>()
</script>

<style scoped>
.evaluation-editor :deep(.el-textarea__inner) {
  --skin-border: var(--skin-border, #e4e4e7);
}
</style>
