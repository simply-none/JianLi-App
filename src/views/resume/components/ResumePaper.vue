<template>
  <div ref="containerRef" class="resume-paper">
    <div class="paper-wrapper" :style="{ zoom: effectiveZoom }">
      <iframe
        ref="iframeRef"
        class="paper"
        :srcdoc="html"
        sandbox="allow-same-origin"
        title="简历预览"
        @load="syncHeight"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * A4 简历纸张渲染（原子组件）
 * - iframe srcdoc 隔离渲染，样式与全局主题零污染
 * - 默认按容器宽度自适应缩放（fit-width），可手动指定 zoom 数字
 * - iframe 高度随内容自适应（支持多页简历完整展示）
 */
const props = defineProps<{
  /** 模板渲染的完整 HTML 文档字符串 */
  html: string
  /** 缩放模式：'fit' 按容器宽度自适应 / 数字为固定倍率（默认 'fit'） */
  zoom?: 'fit' | number
}>()

/** A4 宽度像素（210mm @96dpi ≈ 794） */
const A4_WIDTH_PX = 794

/** 容器引用（测量可用宽度） */
const containerRef = ref<HTMLDivElement>()
/** iframe 引用（同步内容高度） */
const iframeRef = ref<HTMLIFrameElement>()
/** 实测容器宽度 */
const containerWidth = ref(0)
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
 * 同步 iframe 高度为内容实际高度（多页简历完整展示）
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

onMounted(() => {
  ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      containerWidth.value = entry.contentRect.width
    }
  })
  if (containerRef.value) ro.observe(containerRef.value)
  containerWidth.value = containerRef.value?.clientWidth || 0
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})

defineExpose({ syncHeight })
</script>

<style scoped>
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
  border: 1px solid var(--skin-border, #d9d9d9);
  border-radius: 2px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
</style>
