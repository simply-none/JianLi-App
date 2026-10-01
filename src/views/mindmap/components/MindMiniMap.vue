<!--
  思维导图 —— MiniMap 缩略图（自研，零新依赖）。

  ⚠️ **为什么不用 `@vue-flow/minimap`**（这是对原方案的一次刻意偏离，理由写在这里）：
    1. `@vue-flow/core@1.48` 的 `dist/components/MiniMap` 有实现但**没有从 `dist/index.d.ts`
       导出**，要用官方子包 `@vue-flow/minimap`；而本模块全程「零新依赖」，
       且这是一个 30KB 的依赖只为画几十个 `<rect>`。
    2. 本模块**本来就有一份现成的「树 + 布局 → 矩形」能力**（`utils/layout.ts`），
       画布上的节点尺寸也都在 vue-flow store 里 —— 画缩略图只需要把它们等比缩小。
       这与 `svgExport`「由数据生成而不是抠 DOM」是同一条思路。
    3. 自研可以去读**画布实测坐标 + 当前视口**，视口框与节点位置天然一致；
       子包的内部实现反而要额外对齐主题变量。

  交互：点缩略图任意位置 → 主画布把该点移到视口中心；按住拖动 = 连续平移。
  尺寸：固定 168×120，右下角 —— **与缩放条（MindZoomBar）错开**，见下方样式里的 bottom。
-->
<template>
  <div ref="rootRef" class="mind-minimap" :title="'点选 / 拖动可快速跳转视野'">
    <svg :width="BOX_W" :height="BOX_H" :viewBox="`0 0 ${BOX_W} ${BOX_H}`">
      <rect x="0" y="0" :width="BOX_W" :height="BOX_H" rx="6" class="mind-minimap__bg" />
      <rect
        v-for="item in rects"
        :key="item.id"
        :x="item.x"
        :y="item.y"
        :width="item.width"
        :height="item.height"
        rx="1"
        class="mind-minimap__node"
      />
      <rect
        v-if="viewRect"
        :x="viewRect.x"
        :y="viewRect.y"
        :width="viewRect.width"
        :height="viewRect.height"
        rx="2"
        class="mind-minimap__view"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import type { GraphNode } from '@vue-flow/core'

import { MINDMAP_FLOW_ID } from '../constants'

/** 缩略图尺寸（绘图坐标系） */
const BOX_W = 168
const BOX_H = 120
/** 内容四周留白（缩略图单位） */
const PAD = 6

// `viewport` 用 store 里的 **ref**（不要用 `getViewport()` 那个一次性快照：
// 它不参与响应式，平移画布时视口框不会跟着动）
const { getNodes, viewport, setViewport } = useVueFlow(MINDMAP_FLOW_ID)

const rootRef = ref<HTMLElement>()
/** 主画布的像素尺寸（由 ResizeObserver 跟随窗口/大纲开合变化） */
const canvasSize = ref({ width: 0, height: 0 })
let observer: ResizeObserver | undefined

onMounted(() => {
  // 缩略图就在 `.mind-canvas` 内部，向上找一次即可拿到主画布容器
  const host = rootRef.value?.closest('.mind-canvas') as HTMLElement | null
  if (!host) return
  observer = new ResizeObserver(entries => {
    const rect = entries[0]?.contentRect
    if (rect) canvasSize.value = { width: rect.width, height: rect.height }
  })
  observer.observe(host)
  const rect = host.getBoundingClientRect()
  canvasSize.value = { width: rect.width, height: rect.height }
})

onUnmounted(() => observer?.disconnect())

/** 画布上的节点（画布坐标 + 实测尺寸） */
const nodes = computed(() => getNodes.value as GraphNode[])

/**
 * 当前视口在**画布坐标**下的矩形。
 * vue-flow 的 viewport = `{ x, y, zoom }`，含义是「画布原点在屏幕上的位置」，
 * 所以屏幕 (0,0) 对应的画布坐标是 `(-x/zoom, -y/zoom)`，视口宽高是容器尺寸 `/zoom`。
 */
const viewRectFlow = computed(() => {
  const vp = viewport.value
  const zoom = vp?.zoom || 1
  const { width, height } = canvasSize.value
  if (!width || !height) return undefined
  return { x: -(vp?.x ?? 0) / zoom, y: -(vp?.y ?? 0) / zoom, width: width / zoom, height: height / zoom }
})

/**
 * 缩略图的**内容包围盒** = 节点包围盒 ∪ 当前视口矩形。
 *
 * 为什么要把视口也算进去：把画布平移到很远的地方时（视野里没有节点），
 * 若只按节点算包围盒，视口框会跑出缩略图外面 —— 用户看着「一个小方框消失了」，
 * 完全不知道自己在哪。把视口纳入包围盒，框永远可见。
 */
const bounds = computed(() => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const push = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  for (const item of nodes.value) {
    const width = item.dimensions?.width ?? 0
    const height = item.dimensions?.height ?? 0
    if (!width || !height) continue
    push(item.position.x, item.position.y, width, height)
  }
  const viewBoxRect = viewRectFlow.value
  if (viewBoxRect) push(viewBoxRect.x, viewBoxRect.y, viewBoxRect.width, viewBoxRect.height)
  if (!Number.isFinite(minX)) return undefined
  return { minX, minY, maxX, maxY }
})

/** 画布坐标 → 缩略图坐标的等比映射（取两轴较小的缩放比，保证内容全部装得下） */
const mapping = computed(() => {
  const box = bounds.value
  if (!box) return undefined
  const contentW = Math.max(box.maxX - box.minX, 1)
  const contentH = Math.max(box.maxY - box.minY, 1)
  const usableW = BOX_W - PAD * 2
  const usableH = BOX_H - PAD * 2
  const scale = Math.min(usableW / contentW, usableH / contentH)
  // 居中：把内容在可用区域里居中摆放
  const offsetX = PAD + (usableW - contentW * scale) / 2
  const offsetY = PAD + (usableH - contentH * scale) / 2
  return { scale, offsetX, offsetY, minX: box.minX, minY: box.minY }
})

const rects = computed(() => {
  const map = mapping.value
  if (!map) return []
  return nodes.value
    .map(item => {
      const width = item.dimensions?.width ?? 0
      const height = item.dimensions?.height ?? 0
      if (!width || !height) return undefined
      return {
        id: item.id,
        x: (item.position.x - map.minX) * map.scale + map.offsetX,
        y: (item.position.y - map.minY) * map.scale + map.offsetY,
        width: Math.max(width * map.scale, 1.5),
        height: Math.max(height * map.scale, 1.5),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
})

const viewRect = computed(() => {
  const map = mapping.value
  const rect = viewRectFlow.value
  if (!map || !rect) return undefined
  return {
    x: (rect.x - map.minX) * map.scale + map.offsetX,
    y: (rect.y - map.minY) * map.scale + map.offsetY,
    width: Math.max(rect.width * map.scale, 3),
    height: Math.max(rect.height * map.scale, 3),
  }
})

/* -------------------------------------------------------------- 跳转 */

/** 缩略图坐标 → 画布坐标（`mapping` 的逆运算） */
function toFlowPoint(localX: number, localY: number): { x: number; y: number } | undefined {
  const map = mapping.value
  if (!map) return undefined
  return {
    x: (localX - map.offsetX) / map.scale + map.minX,
    y: (localY - map.offsetY) / map.scale + map.minY,
  }
}

/** 把某个画布坐标点移到**视口中心**（保持当前缩放：跳转不该顺带改缩放） */
function centerAt(localX: number, localY: number) {
  const point = toFlowPoint(localX, localY)
  const { width, height } = canvasSize.value
  if (!point || !width || !height) return
  const zoom = viewport.value?.zoom || 1
  setViewport({ x: width / 2 - point.x * zoom, y: height / 2 - point.y * zoom, zoom })
}

function localOf(event: PointerEvent): { x: number; y: number } {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  // svg 是 1:1 像素的（width/height 与 viewBox 同尺寸），所以直接减 rect 即可
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

let dragging = false

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  dragging = true
  const point = localOf(event)
  centerAt(point.x, point.y)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return
  const point = localOf(event)
  centerAt(point.x, point.y)
}

function onPointerUp() {
  dragging = false
  window.removeEventListener('pointermove', onPointerMove)
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<style scoped lang="scss">
/*
  ⚠️ 位置：**右下角、但在缩放条上方**（缩略图 120 高 + 缩略图到缩放条的 14px 间隙）。
     两条都贴右缘（12 / 16px），纵向错开不会叠在一起 ——
     比「去覆盖另一个组件 scoped 样式里的 bottom」稳得多（那是跨组件的样式耦合）。
*/
.mind-minimap {
  position: absolute;
  right: 12px;
  bottom: 66px;
  z-index: 5;
  padding: 4px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--mm-minimap-bg, var(--bg-card));
  box-shadow: var(--shadow-card);
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

.mind-minimap__bg {
  fill: var(--mm-minimap-bg-inner, transparent);
}

.mind-minimap__node {
  fill: var(--mm-minimap-node);
}

.mind-minimap__view {
  fill: none;
  stroke: var(--mm-minimap-view);
  stroke-width: 1.5;
}
</style>
