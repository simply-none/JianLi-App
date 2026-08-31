<template>
  <div class="resume-paper-root">
    <div ref="containerRef" class="resume-paper" @scroll="onScroll">
      <div ref="wrapperRef" class="paper-wrapper" :style="{ zoom: effectiveZoom }">
        <iframe
          :key="iframeKey"
          ref="iframeRef"
          class="paper"
          :srcdoc="html"
          sandbox="allow-same-origin"
          title="简历预览"
          @load="onFrameLoad"
        />
      </div>
    </div>
    <!-- 页码悬浮控件：多页时上一页/下一页 -->
    <div v-if="totalPages > 1" class="pager">
      <button class="pager-btn" :disabled="curPage <= 1" title="上一页" @click="goPage(curPage - 1)">
        <LucideIcon name="ChevronLeft" :size="15" />
      </button>
      <span class="pager-text">{{ curPage }} / {{ totalPages }}</span>
      <button class="pager-btn" :disabled="curPage >= totalPages" title="下一页" @click="goPage(curPage + 1)">
        <LucideIcon name="ChevronRight" :size="15" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { paginateDocument } from '../utils/paginate'

/**
 * A4 简历纸张渲染（原子组件）
 * - iframe srcdoc 隔离渲染，样式与全局主题零污染
 * - 加载后执行共享分页逻辑（utils/paginate）切出多张 .rfs-page 纸张，
 *   body 加 preview-mode 类（灰底 + 纸张阴影）呈现分页隔开效果
 * - 默认按容器宽度自适应缩放（fit-width），可手动指定 zoom 数字
 * - 页码悬浮控件：多页时上一页/下一页，滚动反推当前页
 */
const props = defineProps<{
  /** 模板渲染的完整 HTML 文档字符串 */
  html: string
  /** 缩放模式：'fit' 按容器宽度自适应 / 数字为固定倍率（默认 'fit'） */
  zoom?: 'fit' | number
  /** 是否允许模块内切断（切页粒度开关，默认开启） */
  innerSplit?: boolean
}>()

/** iframe 重建 key：模块内切断开关变化时递增，强制 iframe 重载后按新设置重新切页 */
const iframeKey = ref(0)

/** A4 宽度像素（210mm @96dpi ≈ 794） */
const A4_WIDTH_PX = 794

/** 容器引用（测量可用宽度 + 滚动容器） */
const containerRef = ref<HTMLDivElement>()
/** 缩放包装层引用（分页测量时临时恢复 zoom=1） */
const wrapperRef = ref<HTMLDivElement>()
/** iframe 引用（同步内容高度） */
const iframeRef = ref<HTMLIFrameElement>()
/** 实测容器宽度 */
const containerWidth = ref(0)
/** 总页数（切页后统计） */
const totalPages = ref(0)
/** 当前页码（按钮切换/滚动反推） */
const curPage = ref(1)
/** ResizeObserver 句柄 */
let ro: ResizeObserver | null = null

/** 生效缩放：fit 模式 = 容器可用宽度 / A4 宽度，并限制上限 1 */
const effectiveZoom = computed<'fit' | string>(() => {
  if (props.zoom !== 'fit' && typeof props.zoom === 'number') return String(props.zoom)
  if (containerWidth.value <= 0) return '1'
  const scale = Math.min(1, (containerWidth.value - 24) / A4_WIDTH_PX)
  return String(+scale.toFixed(3))
})

/**
 * 同步 iframe 高度为内容实际高度（分页纸张总高）
 */
function syncHeight() {
  const frame = iframeRef.value
  try {
    const doc = frame?.contentDocument
    if (doc && doc.body) {
      frame!.style.height = `${doc.body.scrollHeight}px`
    }
  } catch {
    /* srcdoc 同源沙箱下可安全访问，异常时保持默认高度 */
  }
}

/**
 * iframe 加载完成：执行共享分页切分（多张 A4 纸 + 预览灰底效果），再同步总高度
 */
function onFrameLoad() {
  const frame = iframeRef.value
  const doc = frame?.contentDocument
  if (!doc || !doc.body) return
  // 空 HTML（如弹窗未就绪时）不做分页，避免「页数： 0」噪音
  if (!props.html || !props.html.trim()) return

  // 测量期间取消缩放（zoom 会传播进 iframe 文档导致 offsetHeight 缩放失真）
  const wrapper = wrapperRef.value
  const prevZoom = wrapper?.style.zoom ?? ''
  if (wrapper) wrapper.style.zoom = '1'

  try {
    const count = paginateDocument(doc, { innerSplit: props.innerSplit !== false })
    totalPages.value = count
    curPage.value = 1
    // 预览模式：灰底衬托纸张边界（导出序列化前会移除该类）
    if (count > 0) doc.body.classList.add('preview-mode')
    console.debug('[resume] 分页完成，页数：', count)
  } catch (e) {
    // 切页异常时退化为单页长图预览，不阻断显示
    console.error('简历分页失败', e)
    totalPages.value = 0
  } finally {
    if (wrapper) wrapper.style.zoom = prevZoom
  }
  syncHeight()
}

/**
 * 跳转到指定页（滚动外层容器到该页顶部，按 zoom 换算视觉位置）
 * @param n 目标页码（1 起）
 */
function goPage(n: number) {
  const frame = iframeRef.value
  const doc = frame?.contentDocument
  if (!doc || !containerRef.value) return
  const pages = doc.querySelectorAll('.rfs-page')
  const el = pages[n - 1] as HTMLElement | undefined
  if (!el) return
  const z = parseFloat(effectiveZoom.value) || 1
  containerRef.value.scrollTop = Math.max(0, el.offsetTop * z - 10)
  curPage.value = n
}

/**
 * 滚动时反推当前页码（取视口顶部所在页）
 */
function onScroll() {
  if (totalPages.value <= 1) return
  const frame = iframeRef.value
  const doc = frame?.contentDocument
  if (!doc || !containerRef.value) return
  const z = parseFloat(effectiveZoom.value) || 1
  const y = containerRef.value.scrollTop / z
  let page = 1
  doc.querySelectorAll('.rfs-page').forEach((p, i) => {
    if ((p as HTMLElement).offsetTop <= y + 48) page = i + 1
  })
  curPage.value = page
}

// 模块内切断开关变化：重建 iframe（srcdoc 相同时不会自动重载），按新粒度重新切页
watch(
  () => props.innerSplit,
  () => {
    iframeKey.value++
  }
)

onMounted(() => {
  ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      containerWidth.value = entry.contentRect.width
    }
  })
  if (containerRef.value) ro.observe(containerRef.value)
  containerWidth.value = containerRef.value?.clientWidth || 0
  // 热重载等场景补偿：iframe 已加载但本次挂载未触发 @load 时，补执行分页
  nextTick(() => {
    const doc = iframeRef.value?.contentDocument
    if (doc?.body?.querySelector('.rfs-flow')) {
      onFrameLoad()
    }
  })
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})

defineExpose({ syncHeight })
</script>

<style scoped>
.resume-paper-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.resume-paper {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
}
.paper-wrapper {
  width: 210mm;
  flex-shrink: 0;
}
.paper {
  display: block;
  width: 100%;
  min-height: 297mm;
  border: 0;
  background: transparent;
}
/* 页码悬浮控件（多页时显示在右下角，不随内容滚动） */
.pager {
  position: absolute;
  right: 18px;
  bottom: 18px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 2px 8px;
  box-shadow: var(--shadow-card);
  z-index: 5;
}
.pager-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  padding: 4px;
  border-radius: 50%;
  display: inline-flex;
}
.pager-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}
.pager-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.pager-text {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 44px;
  text-align: center;
  user-select: none;
}
</style>
