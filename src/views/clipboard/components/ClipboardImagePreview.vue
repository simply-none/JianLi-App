<template>
  <!--
    剪贴板图片查看器（原子组件）：全屏深色遮罩 + 居中大图 + 右上角工具条。

    ⚠️ 为什么不用 el-image 的 preview-src-list：
    主窗口 DOM 上挂着全局规则 `.el-overlay { background-color: #ffffff00 }`
    （style.scss，为「透明小窗去掉遮罩」而设）。el-image-viewer 的遮罩同样吃这条规则，
    结果就是全屏遮罩完全透明 —— 挡不住背后内容、点空白处关闭也无视觉反馈。
    故这里自建遮罩，底色自行写死深色，不受该全局规则影响。
  -->
  <Teleport to="body">
    <Transition name="preview-fade">
      <div
        v-if="modelValue"
        class="image-preview"
        @click.self="close"
        @wheel.prevent="onWheel"
      >
        <!-- 工具条：缩放控制 + 复制 + 关闭 -->
        <div class="preview-toolbar" @click.stop>
          <button type="button" class="tool-btn" title="缩小" @click="zoomBy(-ZOOM_STEP)">
            <LucideIcon name="ZoomOut" :size="16" />
          </button>
          <span class="zoom-label" :title="`当前缩放 ${zoomPercent}%`">{{ zoomPercent }}%</span>
          <button type="button" class="tool-btn" title="放大" @click="zoomBy(ZOOM_STEP)">
            <LucideIcon name="ZoomIn" :size="16" />
          </button>
          <button type="button" class="tool-btn" title="恢复原尺寸" @click="resetZoom">
            <LucideIcon name="Maximize" :size="16" />
          </button>
          <span class="tool-sep" />
          <button type="button" class="tool-btn" title="复制图片" @click="emit('copy')">
            <LucideIcon name="Copy" :size="16" />
          </button>
          <button type="button" class="tool-btn is-danger" title="关闭 (Esc)" @click="close">
            <LucideIcon name="X" :size="16" />
          </button>
        </div>

        <!-- 图片舞台：溢出滚动，可拖拽平移 -->
        <div
          ref="stageRef"
          class="preview-stage"
          :class="{ 'is-dragging': dragging }"
          @click.self="close"
          @mousedown="onDragStart"
        >
          <img
            :src="src"
            alt="剪贴板图片"
            class="preview-image"
            :style="{ width: scaledSize ? scaledSize.w + 'px' : undefined }"
            draggable="false"
            @load="onImageLoad"
            @click.stop
          />
        </div>

        <p class="preview-tip">滚轮缩放 · 拖拽平移 · Esc 关闭</p>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'

const props = defineProps<{
  /** 是否展示查看器 */
  modelValue: boolean
  /** 图片 dataURL（PNG） */
  src?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'copy'): void
}>()

/** 单次缩放步进（相对原尺寸的比例） */
const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.25
const ZOOM_MAX = 8

const stageRef = ref<HTMLElement | null>(null)
/** 缩放系数：1 表示按图片原始像素尺寸展示 */
const scale = ref(1)
/** 图片加载后的原始像素尺寸，用于把 scale 换算成实际显示宽高 */
const natural = ref<{ w: number; h: number } | null>(null)
/** 拖拽平移状态 */
const dragging = ref(false)

const scaledSize = computed(() =>
  natural.value ? { w: natural.value.w * scale.value, h: natural.value.h * scale.value } : null
)
const zoomPercent = computed(() => Math.round(scale.value * 100))

function close() {
  emit('update:modelValue', false)
}

function clamp(v: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v))
}

function zoomBy(delta: number) {
  scale.value = clamp(Number((scale.value + delta).toFixed(2)))
}

function resetZoom() {
  scale.value = 1
  // 恢复原尺寸后把滚动位置也归零，避免视野停在放大时的角落
  if (stageRef.value) {
    stageRef.value.scrollTop = 0
    stageRef.value.scrollLeft = 0
  }
}

/** 滚轮缩放：向上放大、向下缩小 */
function onWheel(e: WheelEvent) {
  zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
}

// —— 拖拽平移：按下后监听 document，保证鼠标移出舞台仍能跟着走 ——
let dragStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 }

function onDragStart(e: MouseEvent) {
  const stage = stageRef.value
  if (!stage || e.button !== 0) return
  // 未放大到溢出时没有可平移空间，交给 click.self 处理关闭
  const canPan = stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight
  if (!canPan) return
  e.preventDefault()
  dragging.value = true
  dragStart = {
    x: e.clientX,
    y: e.clientY,
    scrollLeft: stage.scrollLeft,
    scrollTop: stage.scrollTop,
  }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  const stage = stageRef.value
  if (!stage) return
  stage.scrollLeft = dragStart.scrollLeft - (e.clientX - dragStart.x)
  stage.scrollTop = dragStart.scrollTop - (e.clientY - dragStart.y)
}

function onDragEnd() {
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key === '+' || e.key === '=') {
    e.preventDefault()
    zoomBy(ZOOM_STEP)
    return
  }
  if (e.key === '-') {
    e.preventDefault()
    zoomBy(-ZOOM_STEP)
    return
  }
  if (e.key === '0') {
    e.preventDefault()
    resetZoom()
  }
}

// 打开时挂键盘监听（Esc / 缩放），关闭时摘掉，避免污染全局快捷键
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      scale.value = 1
      natural.value = null
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
      onDragEnd()
    }
  }
)

// 图片加载完成：记录原始像素尺寸（缩放以原始尺寸为基准，而非受容器约束的显示尺寸）
function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  natural.value = { w: img.naturalWidth, h: img.naturalHeight }
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  onDragEnd()
})
</script>

<style scoped lang="scss">
.image-preview {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  // 遮罩底色写死深色：不跟随主题，既挡住背后内容，
  // 也保证白色图标在浅色主题下始终可读（见组件顶部注释）
  background: rgba(12, 14, 20, 0.86);
  backdrop-filter: blur(2px);
  user-select: none;
}

.preview-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(6px);

  .tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.88);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }

    &.is-danger:hover {
      background: rgba(245, 108, 108, 0.28);
      color: #ff9a9a;
    }
  }

  .zoom-label {
    min-width: 46px;
    text-align: center;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.88);
  }

  .tool-sep {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: rgba(255, 255, 255, 0.2);
  }
}

.preview-stage {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 40px;
  box-sizing: border-box;
  overflow: auto;

  &.is-dragging {
    cursor: grabbing;
  }

  .preview-image {
    display: block;
    // 未放大时受容器约束做「适应窗口」展示；放大后由 inline width 接管
    max-width: 100%;
    max-height: 100%;
    border-radius: 6px;
    box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.7);
    cursor: zoom-in;
  }
}

.preview-tip {
  position: absolute;
  bottom: 16px;
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.16s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
</style>
