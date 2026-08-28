<template>
  <!-- 单条结果：图标 + 主副标题 + 类型标签 -->
  <div
    class="palette-item"
    :class="{ 'is-active': active }"
    @mousemove="$emit('select')"
    @click="$emit('run')"
  >
    <div class="palette-item__icon">
      <LucideIcon :name="item.icon" :size="15" />
    </div>

    <div class="palette-item__text">
      <div class="palette-item__title">{{ item.title }}</div>
      <div v-if="item.subtitle" class="palette-item__subtitle">{{ item.subtitle }}</div>
    </div>

    <span class="palette-item__type" :style="{ color: typeColor }">{{ typeLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { CommandItem } from '../types'
import { TYPE_META } from '../config/paletteConfig'

const props = defineProps<{
  item: CommandItem
  active: boolean
}>()

defineEmits<{
  (e: 'select'): void
  (e: 'run'): void
}>()

const typeLabel = computed(() => TYPE_META[props.item.type]?.label || '')
const typeColor = computed(() => TYPE_META[props.item.type]?.color || 'var(--text-muted)')
</script>

<style scoped lang="scss">
.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition: background 0.12s ease;

  &.is-active {
    background: var(--bg-hover);
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__subtitle {
    margin-top: 1px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__type {
    flex-shrink: 0;
    font-size: 11px;
    opacity: 0.85;
  }
}
</style>
