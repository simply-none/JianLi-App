<template>
  <div class="line-deco-group">
    <div class="g-row">
      <el-checkbox v-model="model.enabled" size="small" @change="notify">启用装饰线</el-checkbox>
      <el-radio-group v-model="model.position" size="small" :disabled="!model.enabled" @change="notify">
        <el-radio-button value="after">右侧延伸</el-radio-button>
        <el-radio-button value="below">下方</el-radio-button>
      </el-radio-group>
    </div>
    <div class="g-row">
      <span class="g-label">类型</span>
      <el-select v-model="model.kind" size="small" :disabled="!model.enabled" class="sel" @change="notify">
        <el-option value="solid" label="直线" />
        <el-option value="segment" label="线段" />
        <el-option value="dashed" label="虚线" />
        <el-option value="dotted" label="虚点" />
      </el-select>
      <el-checkbox
        v-model="model.taper"
        size="small"
        :disabled="!model.enabled || model.kind === 'dashed' || model.kind === 'dotted'"
        @change="notify"
      >
        渐细
      </el-checkbox>
    </div>
    <div class="g-row">
      <span class="g-label">长度</span>
      <el-radio-group v-model="model.lengthMode" size="small" :disabled="!model.enabled" @change="notify">
        <el-radio-button value="full">通栏</el-radio-button>
        <el-radio-button value="short">短线</el-radio-button>
      </el-radio-group>
      <span class="g-label">粗细 {{ model.thickness }}px</span>
      <el-slider v-model="model.thickness" size="small" :min="0.5" :max="3" :step="0.5" :disabled="!model.enabled" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">间距 {{ model.gap }}px</span>
      <el-slider v-model="model.gap" size="small" :min="2" :max="20" :disabled="!model.enabled" class="slider" @input="notify" />
      <div class="ink-swatches" title="线条颜色">
        <button
          v-for="i in INK_LEVELS"
          :key="i.level"
          class="swatch"
          :class="{ 'is-active': model.ink === i.level }"
          :style="{ background: i.color }"
          :title="i.label"
          :disabled="!model.enabled"
          @click="setInk(i.level)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { INK_LEVELS } from '../../../engine/tokens'
import type { LineDecoration } from '../../../engine/types'

/**
 * 装饰线配置组
 * 位置/类型（直线·线段·虚线·虚点）/渐细/粗细/长度/间距/颜色。
 * 模板与函数统一动态访问 props.model（不缓存引用），mutate 后通知父级。
 */
const props = defineProps<{
  /** 装饰线配置（draft 内引用） */
  model: LineDecoration
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
 * 设置线条灰阶
 * @param level 灰阶档位
 */
function setInk(level: LineDecoration['ink']) {
  props.model.ink = level
  notify()
}
</script>

<style scoped>
.line-deco-group {
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
.sel {
  width: 90px;
}
.slider {
  flex: 1;
  min-width: 80px;
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
.swatch:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
