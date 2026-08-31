<template>
  <div class="skills-dots-group">
    <div class="g-row">
      <span class="g-label">圆点尺寸 {{ model.size }}px</span>
      <el-slider v-model="model.size" size="small" :min="3" :max="10" :step="0.5" class="slider" @input="notify" />
      <span class="g-label">间距 {{ model.gap }}px</span>
      <el-slider v-model="model.gap" size="small" :min="0" :max="6" :step="0.5" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">实心</span>
      <div class="ink-swatches">
        <button
          v-for="i in INK_LEVELS"
          :key="'on' + i.level"
          class="swatch"
          :class="{ 'is-active': model.onInk === i.level }"
          :style="{ background: i.color }"
          :title="i.label"
          @click="setInk('onInk', i.level)"
        />
      </div>
      <span class="g-label">空心</span>
      <div class="ink-swatches">
        <button
          v-for="i in INK_LEVELS"
          :key="'off' + i.level"
          class="swatch"
          :class="{ 'is-active': model.offInk === i.level }"
          :style="{ background: i.color }"
          :title="i.label"
          @click="setInk('offInk', i.level)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { INK_LEVELS } from '../../../engine/tokens'
import type { SkillsDotStyle } from '../../../engine/types'

/**
 * 技能熟练度圆点配置组
 * 圆点尺寸/间距/实心灰阶/空心灰阶。
 * 模板与函数统一动态访问 props.model（不缓存引用），mutate 后通知父级。
 */
const props = defineProps<{
  /** 圆点配置（draft 内引用） */
  model: SkillsDotStyle
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
 * 设置实心/空心灰阶
 * @param key onInk | offInk
 * @param level 灰阶档位
 */
function setInk(key: 'onInk' | 'offInk', level: SkillsDotStyle['onInk']) {
  props.model[key] = level
  notify()
}
</script>

<style scoped>
.skills-dots-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.g-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.g-label {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.slider {
  flex: 1;
}
.ink-swatches {
  display: flex;
  gap: 3px;
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
