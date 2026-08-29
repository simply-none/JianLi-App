<template>
  <div class="value-inputs">
    <!-- 大预览 -->
    <div class="preview" :style="{ background: store.baseHex }">
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

    <!-- RGB 显示 + 复制 -->
    <div class="field">
      <label>RGB</label>
      <div class="field-row">
        <input class="txt" :value="rgbText" readonly />
        <button class="copy-btn" @click="copy(rgbText, 'RGB')">
          <LucideIcon name="Copy" :size="14" />
        </button>
      </div>
    </div>

    <!-- HSL 显示 + 复制 -->
    <div class="field">
      <label>HSL</label>
      <div class="field-row">
        <input class="txt" :value="hslText" readonly />
        <button class="copy-btn" @click="copy(hslText, 'HSL')">
          <LucideIcon name="Copy" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { hsvToRgb, parseHex, rgbToHsl } from '../colorMath'
import { copyText } from '../clipboard'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

const hexInput = ref(store.baseHex)
// 基准色变化时，同步输入框（除非正在编辑，简单起见总是同步）
watch(
  () => store.baseHex,
  (v) => {
    hexInput.value = v
  },
)

const rgb = computed(() => hsvToRgb(store.baseHsv))
const rgbText = computed(() => `${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b}`)
const hsl = computed(() => rgbToHsl(rgb.value))
const hslText = computed(
  () => `${Math.round(hsl.value.h)}°, ${Math.round(hsl.value.s)}%, ${Math.round(hsl.value.l)}%`,
)

// 预览文字颜色：根据背景亮度选择黑/白
const textOnBg = computed(() => {
  const { r, g, b } = rgb.value
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#000' : '#fff'
})

function applyHex() {
  const norm = parseHex(hexInput.value)
  if (norm) {
    store.setBaseFromHex(norm)
    hexInput.value = norm
  } else {
    // 非法输入回退
    hexInput.value = store.baseHex
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
  .preview-hex {
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
