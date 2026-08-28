<template>
  <!--
    通用虚拟滚动容器（纵向）：只挂载视口内 ±overscan 的项，解决长列表 DOM 累积导致的卡顿。
    内容由使用方经 #default 插槽自定义，组件只负责渲染窗口、滚动定位与触底通知。
    两种高度模式：传 item-height 走定高快路径；不传则自动测量真实高度（支持内容动态变高）。
  -->
  <div class="virtual-list" :style="rootStyle">
    <slot v-if="!items.length" name="empty">
      <div class="vl-empty">暂无数据</div>
    </slot>

    <div v-else :ref="setViewportRef" class="vl-viewport" @scroll.passive="onScroll">
      <div class="vl-sizer" :style="sizerStyle">
        <div
          v-for="idx in visibleIndexes"
          :key="keyOfIndex(idx)"
          :ref="setItemRef"
          class="vl-item"
          :data-index="idx"
          :style="{ paddingBottom: gap + 'px' }"
        >
          <slot :item="items[idx]" :index="idx" />
        </div>
      </div>

      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, nextTick, onBeforeUnmount, onUpdated, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 数据源（整体替换表示新查询，push 追加表示加载更多） */
    items: T[]
    /** 项的唯一 key：字段名或取值函数，默认用数组下标 */
    itemKey?: string | ((item: T, index: number) => string | number)
    /** 固定行高（含内容高度，不含 gap）；> 0 时走定高快路径，跳过测量 */
    itemHeight?: number
    /** 不定高模式下的估算高度，用于未测量项的占位 */
    estimatedItemHeight?: number
    /** 项间距（px），以 padding 形式加在每项底部，会被计入测量高度 */
    gap?: number
    /** 视口上下额外渲染的项数，防快速滚动白屏 */
    overscan?: number
    /** 距底部多少 px 时触发触底 */
    reachEndThreshold?: number
    /** 触底事件冷却时间（ms），避免加载中重复触发 */
    reachEndCooldown?: number
    /** 外部是否正在加载，加载中不再触发触底 */
    loading?: boolean
    /** 数据源整体替换时是否自动回到顶部（push 追加不受影响） */
    resetScrollOnItemsChange?: boolean
    /** 容器高度，默认撑满父级 */
    height?: string | number
  }>(),
  {
    itemKey: undefined,
    itemHeight: 0,
    estimatedItemHeight: 96,
    gap: 0,
    overscan: 4,
    reachEndThreshold: 120,
    reachEndCooldown: 300,
    loading: false,
    resetScrollOnItemsChange: true,
    height: '100%',
  }
)

const emit = defineEmits<{
  (e: 'reach-end'): void
  (e: 'visible-range-change', range: { start: number; end: number }): void
}>()

defineSlots<{
  default(props: { item: T; index: number }): any
  empty(): any
  footer(): any
}>()

const viewportEl = ref<HTMLElement | null>(null)
const viewportHeight = ref(0)
const scrollTop = ref(0)

// 已测量高度缓存：key -> 高度，滚出视口的项保留缓存，回滚时不重测
const heights = new Map<string | number, number>()
// 前缀和：offsets[i] 为第 i 项顶部偏移，offsets[n] 即总高度
const offsets = ref<number[]>([0])
const totalHeight = ref(0)

const start = ref(0)
const end = ref(-1)

const rootStyle = computed(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
}))

const visibleIndexes = computed(() => {
  const list: number[] = []
  for (let i = start.value; i <= end.value; i++) list.push(i)
  return list
})

const sizerStyle = computed(() => ({
  paddingTop: `${offsets.value[start.value] ?? 0}px`,
  paddingBottom: `${Math.max(0, totalHeight.value - (offsets.value[end.value + 1] ?? 0))}px`,
}))

function keyOfIndex(index: number): string | number {
  const item = props.items[index]
  if (item == null) return index
  if (typeof props.itemKey === 'function') return props.itemKey(item, index)
  if (typeof props.itemKey === 'string') {
    const val = (item as Record<string, unknown>)[props.itemKey]
    if (val != null) return val as string | number
  }
  return index
}

// 单条占位高度：定高直接算，不定高取缓存或估算值
function sizeOfIndex(index: number): number {
  if (props.itemHeight > 0) return props.itemHeight + props.gap
  return heights.get(keyOfIndex(index)) ?? props.estimatedItemHeight + props.gap
}

// 重算前缀和（O(n)）。仅在数据量或高度变化时调用，滚动过程中不触发。
// 内容未变化时复用原数组：offsets 是响应式数据，无谓替换会触发重渲染甚至递归更新
function recomputeOffsets(): boolean {
  const n = props.items.length
  const next = new Array<number>(n + 1)
  next[0] = 0
  for (let i = 0; i < n; i++) next[i + 1] = next[i] + sizeOfIndex(i)

  const prev = offsets.value
  if (prev.length === next.length) {
    let same = true
    for (let i = 0; i <= n; i++) {
      if (prev[i] !== next[i]) {
        same = false
        break
      }
    }
    if (same) return false
  }

  offsets.value = next
  totalHeight.value = next[n]
  return true
}

// 二分查找：最后一个「顶部偏移 <= 目标滚动位置」的项
function findStartIndex(target: number): number {
  const arr = offsets.value
  let lo = 0
  let hi = arr.length - 2
  if (hi < 0) return 0
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (arr[mid] <= target) lo = mid
    else hi = mid - 1
  }
  return lo
}

// 依据当前滚动位置计算可视区间（含 overscan）与上下占位高度
function updateRange() {
  const n = props.items.length
  if (!n || viewportHeight.value <= 0) {
    start.value = 0
    end.value = -1
    return
  }
  const top = Math.max(0, scrollTop.value)
  const bottom = top + viewportHeight.value

  let s = findStartIndex(top)
  let e = s
  while (e < n - 1 && offsets.value[e + 1] < bottom) e++

  s = Math.max(0, s - props.overscan)
  e = Math.min(n - 1, e + props.overscan)

  const changed = start.value !== s || end.value !== e
  start.value = s
  end.value = e
  // 区间未变时不重复通知，避免父组件被动触发无谓更新
  if (changed) emit('visible-range-change', { start: s, end: e })
}

function updateViewportHeight() {
  const el = viewportEl.value
  if (el) viewportHeight.value = el.clientHeight
}

function onScroll() {
  const el = viewportEl.value
  if (!el) return
  scrollTop.value = el.scrollTop
  if (rafId) return
  // rAF 节流：一帧最多算一次，避免高频滚动重复计算
  rafId = requestAnimationFrame(() => {
    rafId = 0
    updateRange()
    checkReachEnd()
  })
}

let lastReachEndAt = 0
function checkReachEnd() {
  const el = viewportEl.value
  if (!el || props.loading) return
  if (el.scrollTop + el.clientHeight < el.scrollHeight - props.reachEndThreshold) return
  const now = Date.now()
  if (now - lastReachEndAt < props.reachEndCooldown) return
  lastReachEndAt = now
  emit('reach-end')
}

// 读取已渲染项的真实高度写回缓存，返回是否有变化
function measureVisible(): boolean {
  let changed = false
  itemEls.forEach((el) => {
    if (!el.isConnected) return
    const h = el.offsetHeight
    if (h <= 0) return
    const index = Number(el.dataset.index)
    if (Number.isNaN(index)) return
    const key = keyOfIndex(index)
    if (heights.get(key) !== h) {
      heights.set(key, h)
      changed = true
    }
  })
  return changed
}

let rafId = 0
let pendingRemeasure = false

// 高度变化后重算：以当前可视首项为锚点补偿 scrollTop，避免上方项变高把内容顶走
function remeasure() {
  const el = viewportEl.value
  if (!el) return
  const anchorIndex = start.value
  const oldTop = offsets.value[anchorIndex] ?? 0
  recomputeOffsets()
  const newTop = offsets.value[anchorIndex] ?? 0
  const delta = newTop - oldTop
  if (delta !== 0 && anchorIndex > 0) {
    el.scrollTop += delta
    scrollTop.value = el.scrollTop
  }
  updateRange()
}

function scheduleRemeasure() {
  if (pendingRemeasure) return
  pendingRemeasure = true
  requestAnimationFrame(() => {
    pendingRemeasure = false
    remeasure()
  })
}

// —— 观察器 ——
// 已挂载的项元素集合；下标一律从元素的 data-index 读取，避免节点复用时闭包下标失效
const itemEls = new Set<HTMLElement>()
let itemObserver: ResizeObserver | null = null
let viewportObserver: ResizeObserver | null = null

function setViewportRef(el: unknown) {
  const node = (el as HTMLElement | null) ?? null
  // 函数 ref 在每次 patch 都会被调用，只有元素真正挂载/卸载时才做初始化，
  // 否则「初始化写响应式 → 重渲染 → 再次调用 ref」会无限递归
  if (viewportEl.value === node) return

  if (viewportEl.value && viewportObserver) viewportObserver.unobserve(viewportEl.value)
  viewportEl.value = node
  if (!node) return

  if (!viewportObserver && typeof ResizeObserver !== 'undefined') {
    viewportObserver = new ResizeObserver(() => {
      const prev = viewportHeight.value
      updateViewportHeight()
      if (viewportHeight.value !== prev) updateRange()
    })
  }
  viewportObserver?.observe(node)

  // 测量与区间计算延后到 DOM 更新之后：避免在 patch 过程中写响应式状态
  nextTick(() => {
    if (viewportEl.value !== node) return
    updateViewportHeight()
    recomputeOffsets()
    updateRange()
  })
}

// 清理已脱离文档流的项：v-for 卸载时 ref 回调拿到的下标不可靠，统一在这里回收
function pruneDetached() {
  itemEls.forEach((el) => {
    if (el.isConnected) return
    itemObserver?.unobserve(el)
    itemEls.delete(el)
  })
}

function setItemRef(el: unknown) {
  const node = (el as HTMLElement | null) ?? null
  // 卸载回调（node 为 null）不做处理，交由 pruneDetached 统一回收
  if (!node) return
  // 同样会在每次 patch 被调用，已观察过的元素直接跳过（重复 observe 无意义且徒增开销）
  if (itemEls.has(node)) return
  itemEls.add(node)
  if (!itemObserver && typeof ResizeObserver !== 'undefined') {
    itemObserver = new ResizeObserver(() => {
      if (measureVisible()) scheduleRemeasure()
    })
  }
  itemObserver?.observe(node)
}

onUpdated(() => {
  pruneDetached()
  // 同步测一次可见项（比等 ResizeObserver 回调更快，减少首屏跳动）
  if (measureVisible()) scheduleRemeasure()
  // 首屏数据不足一屏时补一次触底判断，避免内容太短导致无法继续加载
  checkReachEnd()
})

// 数据量变化（push 加载更多、删除项）时重算；引用变化视为新查询
watch(
  () => props.items.length,
  () => {
    recomputeOffsets()
    updateRange()
  }
)

watch(
  () => props.items,
  (val, old) => {
    if (val === old) return
    if (props.resetScrollOnItemsChange && viewportEl.value) {
      viewportEl.value.scrollTop = 0
      scrollTop.value = 0
    }
    recomputeOffsets()
    updateRange()
  }
)

// 定高/估算值/间距变化后整表重算
watch(
  () => [props.itemHeight, props.estimatedItemHeight, props.gap, props.overscan],
  () => {
    recomputeOffsets()
    updateRange()
  }
)

onBeforeUnmount(() => {
  itemObserver?.disconnect()
  viewportObserver?.disconnect()
  itemObserver = null
  viewportObserver = null
  itemEls.clear()
  heights.clear()
  if (rafId) cancelAnimationFrame(rafId)
})

// —— 对外方法 ——
function scrollToTop() {
  if (viewportEl.value) viewportEl.value.scrollTop = 0
  scrollTop.value = 0
  updateRange()
}

// 滚动到指定项：align 为 'start' | 'center' | 'end'
function scrollToIndex(index: number, align: 'start' | 'center' | 'end' = 'start') {
  const el = viewportEl.value
  const n = props.items.length
  if (!el || !n) return
  const i = Math.max(0, Math.min(n - 1, index))
  const top = offsets.value[i] ?? 0
  const h = sizeOfIndex(i)
  const target =
    align === 'end' ? top + h - el.clientHeight : align === 'center' ? top + h / 2 - el.clientHeight / 2 : top
  el.scrollTop = Math.max(0, target)
  scrollTop.value = el.scrollTop
  updateRange()
}

// 清空高度缓存并强制重测（数据内容大变、容器宽度剧变时调用）
function refresh() {
  heights.clear()
  scrollToTop()
  recomputeOffsets()
  updateRange()
  measureVisible()
  remeasure()
}

defineExpose({ scrollToTop, scrollToIndex, refresh })
</script>

<style scoped lang="scss">
.virtual-list {
  position: relative;
  width: 100%;
  min-height: 0;

  .vl-viewport {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .vl-item {
    width: 100%;
  }

  .vl-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 13px;
  }
}
</style>
