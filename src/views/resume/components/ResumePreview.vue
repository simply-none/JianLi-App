<template>
  <div class="resume-preview">
    <!-- 预览工具条：缩放 / 适应宽度 / 排版入口 -->
    <div class="preview-toolbar">
      <el-button text size="small" :disabled="typeof zoom === 'number' && zoom <= MIN_SCALE" @click="zoomStep(-10)">
        <LucideIcon name="ZoomOut" :size="14" />
      </el-button>
      <span class="scale-text">{{ Math.round(currentZoom * 100) }}%</span>
      <el-button text size="small" :disabled="typeof zoom === 'number' && zoom >= MAX_SCALE" @click="zoomStep(10)">
        <LucideIcon name="ZoomIn" :size="14" />
      </el-button>
      <el-button text size="small" @click="zoom = 'fit'">适应宽度</el-button>
      <el-divider direction="vertical" />
      <!-- 模块内切断开关：开启后切页允许在模块内部（条目/行/文本行）跨页 -->
      <el-button
        text
        size="small"
        :style="{ color: splitBtnColor }"
        title="开启后切页允许在模块内部切断，消除页尾大空白"
        @click="$emit('update:innerSplit', !innerSplit)"
      >
        <LucideIcon name="Scissors" :size="14" />
        <span>模块内切断</span>
      </el-button>
      <el-button text size="small" @click="$emit('open-style')">
        <LucideIcon name="SlidersHorizontal" :size="14" />
        <span>排版</span>
      </el-button>
    </div>

    <!-- A4 纸张：fit-width 自适应缩放 + 内容高度自适应 -->
    <ResumePaper :html="html" :zoom="zoom" :inner-split="innerSplit !== false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import ResumePaper from './ResumePaper.vue'

/**
 * A4 简历实时预览（工具条 + 纸张）
 * 默认按容器宽度自适应缩放（fit-width），支持 ± 手动微调与「适应宽度」重置；
 * 「排版」按钮经 open-style 事件交父组件打开排版弹窗。
 */
const props = defineProps<{
  /** 模板渲染的完整 HTML 文档字符串 */
  html: string
  /** 模块内切断开关（默认开启） */
  innerSplit?: boolean
}>()

defineEmits<{
  /** 打开排版弹窗 */
  (e: 'open-style'): void
  /** 切换模块内切断开关 */
  (e: 'update:innerSplit', value: boolean): void
}>()

/** 最小缩放比例 */
const MIN_SCALE = 0.5
/** 最大缩放比例 */
const MAX_SCALE = 1.5

/** 当前缩放：'fit' 自适应 / 数字固定倍率 */
const zoom = ref<'fit' | number>('fit')

/** 工具条展示用的百分比（fit 模式按 100% 近似展示） */
const currentZoom = computed(() => (typeof zoom.value === 'number' ? zoom.value : 1))

/** 模块内切断开关颜色：关闭=同色系淡紫（浅），开启=同色系浓紫（深），均跟随主题主色 */
const splitBtnColor = computed(() =>
  props.innerSplit
    ? 'var(--color-primary)'
    : 'color-mix(in srgb, var(--color-primary) 60%, var(--bg-card))'
)

/**
 * 步进缩放（±10%），并退出 fit 模式
 * @param delta 步长百分比
 */
function zoomStep(delta: number) {
  const base = typeof zoom.value === 'number' ? zoom.value : 1
  zoom.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(base + delta / 100).toFixed(2)))
}
</script>

<style scoped>
.resume-preview {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  overflow: hidden;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-card);
  flex-shrink: 0;
}
.scale-text {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: center;
}
.preview-toolbar :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
