<template>
  <div class="page-style-group">
    <div class="g-row">
      <span class="g-label">正文字号 {{ model.fontSize }}pt</span>
      <el-slider v-model="model.fontSize" size="small" :min="8" :max="12" :step="0.5" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">行高 {{ model.lineHeight }}</span>
      <el-slider v-model="model.lineHeight" size="small" :min="1.2" :max="1.8" :step="0.05" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">字体</span>
      <el-radio-group v-model="model.fontFamily" size="small" @change="notify">
        <el-radio-button value="sans">无衬线</el-radio-button>
        <el-radio-button value="serif">衬线</el-radio-button>
      </el-radio-group>
    </div>
    <div class="g-row">
      <span class="g-label">左右边距 {{ model.paddingX }}mm</span>
      <el-slider v-model="model.paddingX" size="small" :min="8" :max="20" :step="1" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">上下边距 {{ model.paddingY }}mm</span>
      <el-slider v-model="model.paddingY" size="small" :min="8" :max="20" :step="1" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">模块间距 {{ model.sectionGap }}px</span>
      <el-slider v-model="model.sectionGap" size="small" :min="4" :max="28" :step="1" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">条目间距 {{ model.entryGap }}px</span>
      <el-slider v-model="model.entryGap" size="small" :min="0" :max="20" :step="1" class="slider" @input="notify" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PageStyle } from '../../../engine/types'

/**
 * 页面全局配置组
 * 正文字号/行高/字体/边距/模块间距/条目间距。
 * 模板与控件直接绑定 props.model（动态访问，父级替换引用也能保持响应式），
 * mutate 后经 change 通知父级重渲染。
 */
defineProps<{
  /** 页面全局配置（draft 内引用） */
  model: PageStyle
}>()

const emit = defineEmits<{
  /** 配置变更通知 */
  (e: 'change'): void
}>()

/** 通知父级配置变更 */
function notify() {
  emit('change')
}
</script>

<style scoped>
.page-style-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.g-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.g-label {
  font-size: 12px;
  color: var(--skin-text-secondary, #666);
  width: 110px;
  flex-shrink: 0;
}
.slider {
  flex: 1;
}
</style>
