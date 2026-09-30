<!--
  思维导图 —— 缩放条（浮在画布右下角）。

  自己持有 vue-flow 的视口助手，不通过 props 从上往下传 —— 缩放是纯显示行为，
  没必要让 MindCanvas 多背一份状态。`useVueFlow(MINDMAP_FLOW_ID)` 按 id 取到同一个
  store 实例，所以这里调 zoomIn 和画布里调的是同一个视口。
-->
<template>
  <div class="mind-zoom-bar">
    <button type="button" class="mind-zoom-bar__btn" title="缩小" @click="onZoomOut">
      <LucideIcon name="ZoomOut" :size="15" />
    </button>
    <button type="button" class="mind-zoom-bar__value" title="恢复到 100%" @click="onReset">
      {{ zoomPercent }}%
    </button>
    <button type="button" class="mind-zoom-bar__btn" title="放大" @click="onZoomIn">
      <LucideIcon name="ZoomIn" :size="15" />
    </button>
    <span class="mind-zoom-bar__divider" />
    <button type="button" class="mind-zoom-bar__btn" title="适应画布（Ctrl + 0）" @click="onFit">
      <LucideIcon name="Fullscreen" :size="15" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVueFlow } from '@vue-flow/core'

import LucideIcon from '@/components/LucideIcon.vue'
import { MINDMAP_FLOW_ID } from '../constants'

const { viewport, zoomIn, zoomOut, zoomTo, fitView } = useVueFlow(MINDMAP_FLOW_ID)

const zoomPercent = computed(() => Math.round((viewport.value?.zoom ?? 1) * 100))

function onZoomIn() {
  zoomIn({ duration: 120 })
}

function onZoomOut() {
  zoomOut({ duration: 120 })
}

function onReset() {
  zoomTo(1, { duration: 160 })
}

function onFit() {
  fitView({ padding: 0.2, duration: 220 })
}
</script>

<style scoped lang="scss">
.mind-zoom-bar {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.mind-zoom-bar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.mind-zoom-bar__value {
  min-width: 48px;
  height: 26px;
  padding: 0 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.mind-zoom-bar__divider {
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: var(--border-subtle);
}
</style>
