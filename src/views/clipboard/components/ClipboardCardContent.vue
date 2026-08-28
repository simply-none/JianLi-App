<template>
  <!-- 卡片内容区（原子组件）：纯文本预览 + 关键词高亮 + 超长折叠/展开 -->
  <div class="card-content">
    <div
      ref="bodyRef"
      class="content-body"
      :class="{ 'is-clamped': clamped && needCollapse }"
      :style="{ '--clamp-lines': maxLines }"
    >
      <!-- 图片条目：直接渲染缩略图，不参与文本折叠与高亮 -->
      <div v-if="imageSrc" class="content-image">
        <img :src="imageSrc" alt="剪贴板图片" />
      </div>

      <span v-else-if="isEmpty" class="content-empty">（无文本内容）</span>
      <template v-else>
        <span v-for="(seg, idx) in segments" :key="idx" :class="{ 'is-hit': seg.hit }">{{
          seg.text
        }}</span>
      </template>
    </div>

    <button v-if="needCollapse" class="content-toggle" type="button" @click.stop="clamped = !clamped">
      {{ clamped ? '展开全文' : '收起' }}
      <LucideIcon name="ChevronDown" :size="12" :class="['toggle-icon', { 'is-up': !clamped }]" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { splitByKeyword } from '../utils/clipboardFormat'

const props = withDefaults(
  defineProps<{
    /** 剪贴板纯文本内容 */
    text?: string
    /** 图片条目的 dataURL，存在时渲染缩略图 */
    image?: string
    /** 当前搜索关键词，用于高亮命中片段 */
    keyword?: string
    /** 折叠时最多显示的行数 */
    maxLines?: number
  }>(),
  { maxLines: 5 }
)

const bodyRef = ref<HTMLElement | null>(null)
// 是否处于折叠态
const clamped = ref(true)
// 内容是否真的超出折叠行数（不超出时不显示展开按钮）
const needCollapse = ref(false)

const imageSrc = computed(() => (props.image ?? '').trim())
const segments = computed(() => splitByKeyword(props.text ?? '', props.keyword))
const isEmpty = computed(() => !imageSrc.value && !(props.text ?? '').trim())

// 测量是否溢出：折叠用 max-height 裁剪，scrollHeight 始终为完整内容高度，故展开状态下测量也准确
function measure() {
  const el = bodyRef.value
  if (!el) return
  // 图片条目按缩略图高度展示，无需折叠
  if (imageSrc.value) {
    needCollapse.value = false
    return
  }
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22
  needCollapse.value = el.scrollHeight > lineHeight * props.maxLines + 2
}

let observer: ResizeObserver | null = null

onMounted(() => {
  measure()
  // 观察父容器宽度：窗口/侧栏宽度变化会改变换行数，需重新判定是否需要折叠
  const parent = bodyRef.value?.parentElement
  if (parent && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    observer.observe(parent)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

// 内容被替换（如刷新列表）时回到折叠态并重新测量
watch(
  () => [props.text, props.image],
  () => {
    clamped.value = true
    requestAnimationFrame(measure)
  }
)
</script>

<style scoped lang="scss">
.card-content {
  .content-body {
    font-size: 13.5px;
    line-height: 1.7;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;

    // 折叠态：按行数裁剪 + 底部渐隐遮罩（用 mask 而非背景色渐变，兼容任意主题背景）
    &.is-clamped {
      max-height: calc(1.7em * var(--clamp-lines));
      overflow: hidden;
      -webkit-mask-image: linear-gradient(180deg, #000 65%, transparent 100%);
      mask-image: linear-gradient(180deg, #000 65%, transparent 100%);
    }

    .is-hit {
      padding: 0 1px;
      border-radius: 3px;
      background: var(--color-primary-light);
      color: var(--color-primary-solid, var(--color-primary));
      font-weight: 500;
    }

    .content-empty {
      color: var(--text-muted);
      font-style: italic;
    }

    // 图片缩略图：限高展示，点击区域由卡片统一处理
    .content-image img {
      display: block;
      max-width: 100%;
      max-height: 180px;
      object-fit: contain;
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
    }
  }

  .content-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 0;
    border: none;
    background: none;
    font-size: 12px;
    color: var(--color-primary);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }

    :deep(.toggle-icon) {
      transition: transform 0.2s ease;

      &.is-up {
        transform: rotate(180deg);
      }
    }
  }
}
</style>
