<template>
  <div class="export-panel">
    <div class="toolbar">
      <div class="seg">
        <button
          v-for="f in formats"
          :key="f.key"
          class="seg-btn"
          :class="{ 'is-active': format === f.key }"
          @click="format = f.key"
        >
          {{ f.label }}
        </button>
      </div>
      <button class="copy-btn" :disabled="!store.swatches.length" @click="copyOut">
        <LucideIcon name="Copy" :size="14" />
        复制
      </button>
    </div>

    <textarea class="out" readonly :value="output" :placeholder="placeholder" />

    <p v-if="!store.swatches.length" class="warn">工作区为空，先收集颜色再导出</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { toCssVariables, toJson, toScss } from '../colorMath'
import { copyText } from '../clipboard'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

type Fmt = 'css' | 'scss' | 'json'
const formats: { key: Fmt; label: string }[] = [
  { key: 'css', label: 'CSS 变量' },
  { key: 'scss', label: 'SCSS' },
  { key: 'json', label: 'JSON' },
]
const format = ref<Fmt>('css')

const output = computed(() => {
  if (!store.swatches.length) return ''
  if (format.value === 'css') return toCssVariables(store.swatches)
  if (format.value === 'scss') return toScss(store.swatches)
  return toJson(store.swatches)
})

const placeholder = computed(() =>
  format.value === 'css'
    ? ':root {\n  --color-1: #xxxxxx;\n}'
    : format.value === 'scss'
      ? '$color-1: #xxxxxx;'
      : '{ "name": "palette", "colors": [...] }',
)

function copyOut() {
  copyText(output.value, '导出文本')
}
</script>

<style scoped lang="scss">
.export-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  .seg {
    display: flex;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    overflow: hidden;
    .seg-btn {
      padding: 5px 10px;
      border: none;
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 0.76rem;
      cursor: pointer;
      border-right: 1px solid var(--border-subtle);
      &:last-child {
        border-right: none;
      }
      &.is-active {
        background: var(--color-primary-light);
        color: var(--color-primary-solid);
        font-weight: 600;
      }
    }
  }
  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-btn);
    background: var(--color-primary-light);
    color: var(--color-primary-solid);
    font-size: 0.76rem;
    cursor: pointer;
    &:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
}
.out {
  width: 100%;
  min-height: 150px;
  resize: vertical;
  padding: 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.76rem;
  line-height: 1.5;
  outline: none;
  &:focus {
    border-color: var(--color-primary);
  }
}
.warn {
  margin: 0;
  font-size: 0.74rem;
  color: var(--color-warning);
}
</style>
