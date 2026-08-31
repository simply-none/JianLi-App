<template>
  <!-- 文件选择区：支持点击选择对话框与系统拖拽放入 -->
  <div
    class="drop-zone"
    :class="{ dragging }"
    @click="openPicker"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <LucideIcon name="Upload" :size="22" class="dz-icon" />
    <div class="dz-text">{{ multiple ? '点击选择或拖入多个 PDF 文件' : '点击选择或拖入一个 PDF 文件' }}</div>
    <div class="dz-hint">仅支持 .pdf 格式</div>
    <input
      ref="inputRef"
      type="file"
      accept="application/pdf,.pdf"
      :multiple="multiple"
      class="dz-input"
      @change="onInputChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { pdfApi } from '../api/pdfApi';

const props = withDefaults(defineProps<{ multiple?: boolean }>(), { multiple: false });
const emit = defineEmits<{ (e: 'select', paths: string[]): void }>();

const inputRef = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

function openPicker(): void {
  // 优先用 Electron 系统对话框：直接返回绝对路径，规避沙箱/原生 input 下 File.path 为 undefined 的问题
  pickWithDialog();
}

function pickWithDialog(): void {
  pdfApi.pickFiles().then((res) => {
    if (res.success && res.files && res.files.length) {
      emit('select', res.files.filter(Boolean));
    }
  });
}

/** 从 File 列表提取绝对路径；原生 input / 拖拽在沙箱渲染端 File.path 可能为 undefined，需过滤 */
function toPaths(files: FileList | File[] | null | undefined): string[] {
  if (!files) return [];
  return Array.from(files)
    .map((f) => (f as any).path as string)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
}

function onInputChange(e: Event): void {
  const files = (e.target as HTMLInputElement).files;
  const paths = toPaths(files);
  if (paths.length) emit('select', paths);
  (e.target as HTMLInputElement).value = '';
}

function onDrop(e: DragEvent): void {
  dragging.value = false;
  const files = Array.from(e.dataTransfer?.files || []).filter(
    (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf',
  );
  const paths = toPaths(files);
  if (paths.length) emit('select', paths);
}

// 暴露给父组件：当希望优先用系统对话框而非隐藏 input 时调用
defineExpose({ openPicker: pickWithDialog });
</script>

<style scoped>
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1.5px dashed var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--bg-base);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
  text-align: center;
}
.drop-zone:hover,
.drop-zone.dragging {
  border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}
.dz-icon {
  color: var(--color-primary);
}
.dz-text {
  color: var(--text-primary);
  font-size: 14px;
}
.dz-hint {
  color: var(--text-muted);
  font-size: 12px;
}
.dz-input {
  display: none;
}
</style>
