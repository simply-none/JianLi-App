<template>
  <div class="text-style-row" :class="{ 'is-hidden': !model.visible }">
    <span class="row-label" :title="label">{{ label }}</span>
    <el-tooltip :content="model.visible ? '隐藏该字段' : '显示该字段'" placement="top">
      <button class="mini-btn" @click="toggleVisible">
        <LucideIcon :name="model.visible ? 'Eye' : 'EyeOff'" :size="13" />
      </button>
    </el-tooltip>
    <el-select v-model="model.size" class="sel sel-size" size="small" title="字号档位" @change="notify">
      <el-option v-for="s in SIZE_STEPS" :key="s.key" :value="s.key" :label="s.label" />
    </el-select>
    <el-select v-model="model.weight" class="sel sel-weight" size="small" title="字重" @change="notify">
      <el-option :value="400" label="常规" />
      <el-option :value="500" label="中等" />
      <el-option :value="600" label="半粗" />
      <el-option :value="700" label="加粗" />
    </el-select>
    <div class="ink-swatches" title="灰阶">
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
import LucideIcon from '@/components/LucideIcon.vue'
import { INK_LEVELS, SIZE_STEPS } from '../../../engine/tokens'
import type { TextStyle } from '../../../engine/types'

/**
 * 原子字段调试行（排版 UI 最小单元）
 * 一行调试一个字段：显隐 + 字号档 + 字重 + 灰阶色板。
 * 直接 mutate 传入的样式对象（reactive draft 子树），并通知父级重渲染。
 */
const props = defineProps<{
  /** 字段显示名 */
  label: string
  /** 字段样式对象（draft 内引用，直接修改） */
  model: TextStyle
}>()

const emit = defineEmits<{
  /** 样式变更通知 */
  (e: 'change'): void
}>()

/** 切换字段显隐 */
function toggleVisible() {
  props.model.visible = !props.model.visible
  emit('change')
}

/** 通知父级样式变更（select 等控件用） */
function notify() {
  emit('change')
}

/**
 * 设置灰阶档位并通知
 * @param level 灰阶档位
 */
function setInk(level: TextStyle['ink']) {
  props.model.ink = level
  emit('change')
}
</script>

<style scoped>
.text-style-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}
.text-style-row.is-hidden .row-label {
  opacity: 0.45;
}
.row-label {
  width: 58px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  padding: 3px;
  border-radius: 4px;
  display: inline-flex;
  flex-shrink: 0;
}
.mini-btn:hover {
  background: var(--bg-hover);
}
.sel {
  flex-shrink: 0;
}
.sel-size {
  width: 72px;
}
.sel-weight {
  width: 76px;
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
