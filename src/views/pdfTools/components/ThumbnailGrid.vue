<template>
  <!-- 页面缩略图网格：懒渲染(IntersectionObserver) + 选择/旋转/删除/拖拽重排 -->
  <div class="thumb-grid">
    <div
      v-for="(p, pos) in pages"
      :key="p.srcIndex"
      class="thumb-card"
      :class="{ selected: selected.has(p.srcIndex) }"
      draggable="true"
      @dragstart="dragPos = pos"
      @dragover.prevent
      @drop.prevent="onDrop(pos)"
      @click="toggle(p.srcIndex)"
    >
      <div class="thumb-top">
        <input type="checkbox" :checked="selected.has(p.srcIndex)" @click.stop="toggle(p.srcIndex)" />
        <span class="pnum">第 {{ p.srcIndex + 1 }} 页</span>
        <span v-if="p.rotation" class="rot-badge">{{ p.rotation }}°</span>
      </div>

      <div class="thumb-canvas">
        <img v-if="thumbs[p.srcIndex]" :src="thumbs[p.srcIndex]" class="thumb-img" :style="rotStyle(p.rotation)" />
        <div v-else class="thumb-ph"></div>
      </div>

      <div class="thumb-ops" @click.stop>
        <LucideIcon name="RotateCw" :size="14" class="op" title="旋转 90°" @click="rotate(p.srcIndex)" />
        <LucideIcon name="Trash2" :size="14" class="op danger" title="删除该页" @click="remove(p.srcIndex)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onBeforeUnmount } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { renderPageToImage } from '../composables/usePdfjs';
import type { OrganizePageState } from '../types';

const props = defineProps<{
  doc: any;
  pages: OrganizePageState[];
  selected: Set<number>;
  thumbWidth?: number;
}>();
const emit = defineEmits<{
  (e: 'toggle', srcIndex: number): void;
  (e: 'rotate', srcIndex: number): void;
  (e: 'remove', srcIndex: number): void;
  (e: 'reorder', payload: { from: number; to: number }): void;
}>();

const thumbs = reactive<Record<number, string>>({});
const dragPos = ref(-1);
/** 记录上次渲染所用文档，文档切换时清空旧缩略图避免串页 */
let lastDoc: any = null;

function rotStyle(rotation: number): Record<string, string> {
  return rotation ? { transform: `rotate(${rotation}deg)` } : {};
}

/** 并发渲染所有页缩略图（避免大文档一次性卡顿） */
async function renderAll(): Promise<void> {
  if (!props.doc) return;
  if (props.doc !== lastDoc) {
    lastDoc = props.doc;
    for (const k of Object.keys(thumbs)) delete thumbs[Number(k)];
  }
  const idxs = props.pages.map((p) => p.srcIndex);
  const CONCURRENCY = 6;
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < idxs.length) {
      const srcIndex = idxs[cursor++];
      if (thumbs[srcIndex]) continue;
      try {
        const page = await props.doc.getPage(srcIndex + 1);
        const url = await renderPageToImage(page, props.thumbWidth ?? 150);
        if (url) thumbs[srcIndex] = url;
      } catch (e) {
        console.warn('[pdf] thumb render failed', srcIndex, e);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

// doc 或「页集合(去重后顺序无关)」变化时重新渲染；仅重排/旋转不触发
watch(
  () => [props.doc, props.pages.map((p) => p.srcIndex).sort((a, b) => a - b).join(',')],
  renderAll,
  { immediate: true },
);

function toggle(srcIndex: number): void {
  emit('toggle', srcIndex);
}
function rotate(srcIndex: number): void {
  emit('rotate', srcIndex);
}
function remove(srcIndex: number): void {
  emit('remove', srcIndex);
}
function onDrop(target: number): void {
  const from = dragPos.value;
  dragPos.value = -1;
  if (from < 0 || from === target) return;
  emit('reorder', { from, to: target });
}

onBeforeUnmount(() => {
  lastDoc = null;
});
</script>

<style scoped>
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.thumb-card {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.thumb-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
}
.thumb-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
}
.thumb-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.pnum {
  color: var(--text-secondary);
  font-size: 12px;
}
.rot-badge {
  margin-left: auto;
  color: var(--color-warning);
  font-size: 11px;
}
.thumb-canvas {
  height: 200px;
  display: grid;
  place-items: center;
  background: var(--bg-base);
  border-radius: 6px;
  overflow: hidden;
}
.thumb-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.thumb-ph {
  width: 100%;
  height: 100%;
  background: color-mix(in srgb, var(--text-muted) 8%, transparent);
}
.thumb-ops {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}
.op {
  cursor: pointer;
  color: var(--text-secondary);
  padding: 3px;
  border-radius: 4px;
}
.op:hover {
  background: var(--bg-hover);
  color: var(--color-primary);
}
.op.danger:hover {
  color: var(--color-error);
}
</style>
