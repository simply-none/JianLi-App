<template>
  <div class="separator-group">
    <span class="g-label">{{ label }}</span>
    <el-radio-group v-model="model.type" size="small" @change="notify">
      <el-radio-button value="space">空格</el-radio-button>
      <el-radio-button value="dot">间隔点</el-radio-button>
      <el-radio-button value="bar">竖线</el-radio-button>
      <el-radio-button value="slash">斜杠</el-radio-button>
      <el-radio-button value="none">紧贴</el-radio-button>
    </el-radio-group>
    <el-slider
      v-model="model.gap"
      size="small"
      :min="0"
      :max="12"
      class="slider"
      title="两侧间距"
      @input="notify"
    />
    <div class="ink-swatches" title="分隔符颜色">
      <button
        v-for="i in INK_LEVELS"
        :key="i.level"
        class="swatch"
        :class="{ 'is-active': model.ink === i.level }"
        :style="{ background: i.color }"
        :title="i.label"
        @click="setInk(i.level)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { INK_LEVELS } from '../../../engine/tokens'
import type { SeparatorStyle } from '../../../engine/types'

/**
 * 分隔符配置组
 * 类型（空格/间隔点/竖线/斜杠/紧贴）+ 间距 + 颜色。
 * 模板与函数统一动态访问 props.model（不缓存引用），mutate 后通知父级。
 */
const props = defineProps<{
  /** 配置标签（如「字段分隔」「联系方式分隔」） */
  label: string
  /** 分隔符配置（draft 内引用） */
  model: SeparatorStyle
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
 * 设置分隔符灰阶
 * @param level 灰阶档位
 */
function setInk(level: SeparatorStyle['ink']) {
  props.model.ink = level
  notify()
}
</script>

<style scoped>
.separator-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.g-label {
  font-size: 12px;
  color: var(--skin-text-secondary, #666);
  flex-shrink: 0;
  width: 74px;
}
.slider {
  width: 90px;
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
  border: 1px solid rgba(0, 0, 0, 0.12);
  cursor: pointer;
  padding: 0;
}
.swatch.is-active {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}
</style>
