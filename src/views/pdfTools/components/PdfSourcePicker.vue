<template>
  <!-- 单个 PDF 源文件选择：未选时显示拖拽区，已选时显示文件名与移除按钮 -->
  <div class="pdf-src">
    <FileDropZone v-if="!path" :multiple="false" @select="onSel" />
    <div v-else class="src-row">
      <LucideIcon name="FileText" :size="15" class="ficon" />
      <span class="fname" :title="path">{{ name }}</span>
      <LucideIcon name="X" :size="15" class="op" title="移除" @click="$emit('update:path', null)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import FileDropZone from './FileDropZone.vue';

const props = defineProps<{ path: string | null }>();
const emit = defineEmits<{ (e: 'update:path', p: string | null): void }>();

const name = computed(() => (props.path || '').replace(/^.*[\\/]/, ''));
function onSel(paths: string[]): void {
  if (paths.length) emit('update:path', paths[0]);
}
</script>

<style scoped>
.pdf-src {
  margin-top: 4px;
}
.src-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
}
.ficon {
  color: var(--color-primary);
  flex: none;
}
.fname {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.op {
  cursor: pointer;
  color: var(--text-secondary);
  padding: 2px;
  border-radius: 4px;
  flex: none;
}
.op:hover {
  background: var(--bg-hover);
  color: var(--color-error);
}
</style>
