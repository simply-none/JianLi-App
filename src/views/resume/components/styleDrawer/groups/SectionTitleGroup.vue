<template>
  <div class="section-title-group">
    <div class="group-caption">标题文本</div>
    <TextStyleRow label="标题" :model="model.text" @change="notify" />
    <div class="group-caption">装饰线</div>
    <LineDecorationGroup :model="model.line" @change="notify" />
  </div>
</template>

<script setup lang="ts">
import TextStyleRow from './TextStyleRow.vue'
import LineDecorationGroup from './LineDecorationGroup.vue'
import type { SectionTitleStyle } from '../../../engine/types'

/**
 * 章节标题配置组
 * 标题文本样式（字号档/字重/灰阶）+ 装饰线全套。
 * 子控件直接绑定 props.model 子对象（动态访问），变更经 change 上报。
 */
defineProps<{
  /** 标题组件配置（draft 内引用） */
  model: SectionTitleStyle
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
.section-title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.group-caption {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
</style>
