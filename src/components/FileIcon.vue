<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  type: string
  size?: number
}>()

const extMap: Record<string, string> = {
  image: 'IMG',
  video: 'VIDEO',
  audio: 'AUDIO',
  text: 'TXT',
  pdf: 'PDF',
  font: 'FONT',
  archive: 'ZIP',
  document: 'DOC',
}

const extText = computed(() => extMap[props.type] || 'FILE')

const colorMap: Record<string, { bg: string; border: string; text: string, name?: string }> = {
  image: { bg: '#f0f9ff', border: '#3b82f6', text: '#3b82f6' },
  video: { bg: '#fef2f2', border: '#ef4444', text: '#ef4444', name: 'SquarePlay' },
  audio: { bg: '#f5f3ff', border: '#8b5cf6', text: '#8b5cf6', name: 'Headset' },
  text: { bg: '#f0fdf4', border: '#22c55e', text: '#22c55e', name: 'FileText' },
  pdf: { bg: '#fef2f2', border: '#ef4444', text: '#ef4444', name: 'FileText' },
  font: { bg: '#fffbeb', border: '#f59e0b', text: '#f59e0b', name: 'FileType' },
  archive: { bg: '#ecfeff', border: '#06b6d4', text: '#06b6d4', name: 'Package2' },
  document: { bg: '#eff6ff', border: '#3b82f6', text: '#3b82f6', name: 'ScrollText' },
}

const colors = computed(() => colorMap[props.type] || { bg: '#f3f4f6', border: '#6b7280', text: '#6b7280' })
</script>

<template>
  <LucideIcon v-if="colors.name" :name="colors.name" :color="colors.text" :size="size" />
  <div
    v-else
    class="file-icon"
    :style="{
      width: `${size || 32}px`,
      height: `${size || 32}px`,
    }"
  >
    <div
      class="file-icon-body"
      :style="{
        background: colors.bg,
        borderColor: colors.border,
      }"
    >
      <span class="file-icon-corner" :style="{ background: colors.border }" />
      <span
        class="file-icon-text"
        :style="{ color: colors.text }"
      >
        {{ extText }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-icon-body {
  position: relative;
  width: 85%;
  height: 85%;
  border-radius: 4px;
  border: 1.5px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.file-icon-corner {
  position: absolute;
  right: 0;
  top: 0;
  width: 25%;
  height: 25%;
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}

.file-icon-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
  z-index: 1;
}
</style>
