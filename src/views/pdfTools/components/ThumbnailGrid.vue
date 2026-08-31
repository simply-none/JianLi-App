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
        <div v-else class="thumb-ph" :ref="(el) => registerObs(el, p.srcIndex)"></div>
      </div>

      <div class="thumb-ops" @click.stop>
        <LucideIcon name="RotateCw" :size="14" class="op" title="旋转 90°" @click="rotate(p.srcIndex)" />
        <LucideIcon name="Trash2" :size="14" class="op danger" title="删除该页" @click="remove(p.srcIndex)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onBeforeUnmount } from 'vue';
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
const rendered = new Set<number>();
const dragPos = ref(-1);
let observer: IntersectionObserver | null = null;
const pending = new Map<number, Element>();

function rotStyle(rotation: number): Record<string, string> {
  return rotation ? { transform: `rotate(${rotation}deg)` } : {};
}

function ensureObserver(): void {
  if (observer || typeof IntersectionObserver === 'undefined') return;
  observer = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const idx = Number((en.target as HTMLElement).dataset.src);
      observer?.unobserve(en.target);
      pending.delete(idx);
      renderThumb(idx);
    }
  });
}

function registerObs(el: unknown, srcIndex: number): void {
  if (!el) return;
  ensureObserver();
  const node = el as HTMLElement;
  node.dataset.src = String(srcIndex);
  if (observer) observer.observe(node);
  else pending.set(srcIndex, node); // 无 IO 支持时回退：直接渲染
}

async function renderThumb(srcIndex: number): Promise<void> {
  if (!props.doc || rendered.has(srcIndex)) return;
  rendered.add(srcIndex);
  try {
    const page = await props.doc.getPage(srcIndex + 1);
    const url = await renderPageToImage(page, props.thumbWidth ?? 150);
    if (url) thumbs[srcIndex] = url;
  } catch (e) {
    rendered.delete(srcIndex);
    console.warn('[pdf] thumb render failed', srcIndex, e);
  }
}

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
  observer?.disconnect();
  observer = null;
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
