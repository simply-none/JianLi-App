<template>
  <div class="contrast-checker">
    <div class="pickers">
      <div class="picker">
        <label>前景</label>
        <input type="color" v-model="fgHex" class="color-input" />
        <input v-model="fgHex" class="hex-input" spellcheck="false" @change="normFg" />
      </div>
      <div class="picker">
        <label>背景</label>
        <input type="color" v-model="bgHex" class="color-input" />
        <input v-model="bgHex" class="hex-input" spellcheck="false" @change="normBg" />
      </div>
    </div>

    <!-- 预览 -->
    <div class="preview" :style="{ background: bgHex, color: fgHex }">
      <span class="big">Aa</span>
      <span class="small">可读文本示例 Text 123</span>
    </div>

    <!-- 对比度数值 -->
    <div class="ratio">
      <span class="num">{{ result.ratio.toFixed(2) }}</span>
      <span class="suffix">: 1</span>
    </div>

    <!-- 等级徽章 -->
    <div class="badges">
      <span class="badge" :class="result.AA ? 'pass' : 'fail'">AA 普通 {{ result.AA ? '✓' : '✕' }}</span>
      <span class="badge" :class="result.AALarge ? 'pass' : 'fail'">AA 大字 {{ result.AALarge ? '✓' : '✕' }}</span>
      <span class="badge" :class="result.AAA ? 'pass' : 'fail'">AAA 普通 {{ result.AAA ? '✓' : '✕' }}</span>
      <span class="badge" :class="result.AAALarge ? 'pass' : 'fail'">AAA 大字 {{ result.AAALarge ? '✓' : '✕' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { contrastRatio, hexToRgb, parseHex, wcag } from '../colorMath'

const fgHex = ref('#ffffff')
const bgHex = ref('#1e293b')

function normFg() {
  const n = parseHex(fgHex.value)
  if (n) fgHex.value = n
}
function normBg() {
  const n = parseHex(bgHex.value)
  if (n) bgHex.value = n
}

const result = computed(() => {
  const fg = hexToRgb(fgHex.value)
  const bg = hexToRgb(bgHex.value)
  return wcag(contrastRatio(fg, bg))
})
</script>

<style scoped lang="scss">
.contrast-checker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pickers {
  display: flex;
  gap: 10px;
  .picker {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    label {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-weight: 600;
    }
    .color-input {
      width: 100%;
      height: 32px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      background: var(--bg-card);
      cursor: pointer;
      padding: 2px;
    }
    .hex-input {
      height: 30px;
      padding: 0 8px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: 0.78rem;
      text-transform: uppercase;
      outline: none;
      &:focus {
        border-color: var(--color-primary);
      }
    }
  }
}
.preview {
  border-radius: var(--radius-card);
  border: 1px solid var(--border-subtle);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  .big {
    font-size: 1.8rem;
    font-weight: 800;
    line-height: 1;
  }
  .small {
    font-size: 0.85rem;
  }
}
.ratio {
  text-align: center;
  .num {
    font-size: 1.7rem;
    font-weight: 800;
    color: var(--text-primary);
  }
  .suffix {
    font-size: 0.9rem;
    color: var(--text-muted);
  }
}
.badges {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  .badge {
    text-align: center;
    padding: 5px;
    border-radius: var(--radius-btn);
    font-size: 0.74rem;
    font-weight: 600;
    &.pass {
      background: color-mix(in srgb, var(--color-success) 16%, transparent);
      color: var(--color-success);
    }
    &.fail {
      background: color-mix(in srgb, var(--color-error) 14%, transparent);
      color: var(--color-error);
    }
  }
}
</style>
