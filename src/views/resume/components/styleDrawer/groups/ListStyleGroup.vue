<template>
  <div class="list-style-group">
    <div class="g-row">
      <span class="g-label">符号</span>
      <el-radio-group v-model="model.marker" size="small" @change="notify">
        <el-radio-button value="dot">圆点</el-radio-button>
        <el-radio-button value="dash">短横</el-radio-button>
        <el-radio-button value="number">数字</el-radio-button>
        <el-radio-button value="none">无</el-radio-button>
      </el-radio-group>
      <span class="g-label">缩进 {{ model.indent }}px</span>
      <el-slider v-model="model.indent" size="small" :min="0" :max="24" :step="1" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">条目间距 {{ model.itemGap }}px</span>
      <el-slider v-model="model.itemGap" size="small" :min="0" :max="10" :step="1" class="slider" @input="notify" />
      <div class="ink-swatches" title="符号颜色">
        <button
          v-for="i in INK_LEVELS"
          :key="i.level"
          class="swatch"
          :class="{ 'is-active': model.markerInk === i.level }"
          :style="{ background: i.color }"
          :title="i.label"
          @click="setMarkerInk(i.level)"
        />
      </div>
    </div>
    <TextStyleRow label="列表文本" :model="model.text" @change="notify" />
  </div>
</template>

<script setup lang="ts">
import { INK_LEVELS } from '../../../engine/tokens'
import TextStyleRow from './TextStyleRow.vue'
import type { ListStyle } from '../../../engine/types'

/**
 * 列表配置组
 * 符号形态（圆点/短横/数字/无）+ 符号颜色/缩进/条目间距 + 文本样式。
 * 模板与函数统一动态访问 props.model（不缓存引用），mutate 后通知父级。
 */
const props = defineProps<{
  /** 列表配置（draft 内引用） */
  model: ListStyle
}>()

const emit = defineEmits<{
  /** 配置变更通知 */
  (e: 'change'): void
}>()

/** 通知父级配置变更 */
function notify() {
  emit('change')
}

/**
 * 设置符号灰阶
 * @param level 灰阶档位
 */
function setMarkerInk(level: ListStyle['markerInk']) {
  props.model.markerInk = level
  notify()
}
</script>

<style scoped>
.list-style-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.g-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.g-label {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.slider {
  flex: 1;
  min-width: 70px;
}
.ink-swatches {
  display: flex;
  gap: 3px;
  margin-left: auto;
}
.swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  padding: 0;
}
.swatch.is-active {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
</style>
