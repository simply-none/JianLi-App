<template>
  <div class="value-inputs">
    <!-- 大预览 -->
    <div class="preview" :style="{ '--c': store.baseHex }">
      <span class="preview-hex" :style="{ color: textOnBg }">{{ store.baseHex }}</span>
    </div>

    <!-- HEX 输入（可编辑） -->
    <div class="field">
      <label>HEX</label>
      <div class="field-row">
        <input
          v-model="hexInput"
          class="txt"
          spellcheck="false"
          @change="applyHex"
          @keyup.enter="applyHex"
        />
        <button class="copy-btn" @click="copy(store.baseHex, 'HEX')">
          <LucideIcon name="Copy" :size="14" />
        </button>
      </div>
    </div>

    <!-- RGBA 显示 + 复制 -->
    <div class="field">
      <label>RGBA</label>
      <div class="field-row">
        <input class="txt" :value="rgbaText" readonly />
        <button class="copy-btn" @click="copy(rgbaText, 'RGBA')">
          <LucideIcon name="Copy" :size="14" />
        </button>
      </div>
    </div>

    <!-- HSLA 显示 + 复制 -->
    <div class="field">
      <label>HSLA</label>
      <div class="field-row">
        <input class="txt" :value="hslaText" readonly />
        <button class="copy-btn" @click="copy(hslaText, 'HSLA')">
          <LucideIcon name="Copy" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { hsvToRgb, parseHex, rgbToHsl, toShortHex } from '../colorMath'
import { copyText } from '../clipboard'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

const hexInput = ref(store.baseHex)
// 基准色变化时，同步输入框（不透明时缩写为 6 位，便于阅读）
watch(
  () => store.baseHex,
  (v) => {
    hexInput.value = toShortHex(v)
  },
)

const rgb = computed(() => hsvToRgb(store.baseHsv))
/** 当前透明度（0-1，保留两位） */
const alpha01 = computed(() => Math.round((store.baseAlpha / 100) * 100) / 100)
const rgbaText = computed(
  () => `rgba(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b}, ${alpha01.value})`,
)
const hsl = computed(() => rgbToHsl(rgb.value))
const hslaText = computed(
  () =>
    `hsla(${Math.round(hsl.value.h)}°, ${Math.round(hsl.value.s)}%, ${Math.round(
      hsl.value.l,
    )}%, ${alpha01.value})`,
)

// 预览文字颜色：根据背景亮度选择黑/白（忽略透明度，仅看色相深浅）
const textOnBg = computed(() => {
  const { r, g, b } = rgb.value
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#000' : '#fff'
})

function applyHex() {
  const norm = parseHex(hexInput.value)
  if (norm) {
    store.setBaseFromHex(norm)
    hexInput.value = toShortHex(norm)
  } else {
    // 非法输入回退
    hexInput.value = toShortHex(store.baseHex)
  }
}

function copy(text: string, label: string) {
  copyText(text, label)
}
</script>

<style scoped lang="scss">
.value-inputs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.preview {
  height: 64px;
  border-radius: var(--radius-card);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  position: relative;
  background-image: conic-gradient(#cfcfcf 90deg, #f3f3f3 0 180deg, #cfcfcf 0 270deg, #f3f3f3 0);
  background-size: 14px 14px;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--c);
  }
  .preview-hex {
    position: relative;
    z-index: 1;
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  label {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  .field-row {
    display: flex;
    gap: 6px;
    .txt {
      flex: 1;
      height: 32px;
      padding: 0 10px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: 0.82rem;
      font-variant-numeric: tabular-nums;
      outline: none;
      &:focus {
        border-color: var(--color-primary);
      }
    }
    .copy-btn {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      background: var(--bg-card);
      color: var(--text-secondary);
      cursor: pointer;
      &:hover {
        background: var(--bg-hover);
        color: var(--color-primary);
      }
    }
  }
}
</style>
