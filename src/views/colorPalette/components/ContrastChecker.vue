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

    <!-- 预览（已按透明度叠白底合成后的实际观感） -->
    <div class="preview" :style="{ background: bgStyle, color: fgStyle }">
      <span class="big">Aa</span>
      <span class="small">可读文本示例 Text 123</span>
    </div>

    <!-- 透明度 -->
    <div class="alpha-row">
      <label>前景透明度</label>
      <input type="range" min="0" max="100" step="1" v-model.number="fgAlpha" @input="syncFgAlpha" />
      <span class="a-val">{{ fgAlpha }}%</span>
    </div>
    <div class="alpha-row">
      <label>背景透明度</label>
      <input type="range" min="0" max="100" step="1" v-model.number="bgAlpha" @input="syncBgAlpha" />
      <span class="a-val">{{ bgAlpha }}%</span>
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
import { compositeAlpha, contrastRatio, hexToRgba, parseHex, wcag } from '../colorMath'

const WHITE = { r: 255, g: 255, b: 255 }

const fgHex = ref('#ffffff')
const bgHex = ref('#1e293b')
/** 前景 / 背景透明度（0-100，默认不透明） */
const fgAlpha = ref(100)
const bgAlpha = ref(100)

function normFg() {
  const n = parseHex(fgHex.value)
  if (n) {
    fgHex.value = n
    fgAlpha.value = Math.round((hexToRgba(n).a) * 100)
  }
}
function normBg() {
  const n = parseHex(bgHex.value)
  if (n) {
    bgHex.value = n
    bgAlpha.value = Math.round((hexToRgba(n).a) * 100)
  }
}

/** 用户输入透明度滑块时，将当前 HEX 改写为带 alpha 的形式，保证 hex 与滑块一致 */
function syncFgAlpha() {
  fgHex.value = withAlpha(fgHex.value, fgAlpha.value)
}
function syncBgAlpha() {
  bgHex.value = withAlpha(bgHex.value, bgAlpha.value)
}
function withAlpha(hex: string, pct: number): string {
  const { r, g, b } = hexToRgba(hex)
  const a = Math.round((pct / 100) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}${a}`
}

/** 透明色按「叠白底」合成后的实际前景/背景（用于预览与对比度计算） */
const effective = computed(() => {
  const bgRgba = { ...hexToRgba(bgHex.value), a: bgAlpha.value / 100 }
  const effBg = compositeAlpha(bgRgba, WHITE)
  const fgRgba = { ...hexToRgba(fgHex.value), a: fgAlpha.value / 100 }
  const effFg = compositeAlpha(fgRgba, effBg)
  return { effBg, effFg }
})
const bgStyle = computed(() => {
  const { r, g, b } = effective.value.effBg
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
})
const fgStyle = computed(() => {
  const { r, g, b } = effective.value.effFg
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
})

const result = computed(() => {
  const { effFg, effBg } = effective.value
  return wcag(contrastRatio(effFg, effBg))
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
.alpha-row {
  display: flex;
  align-items: center;
  gap: 8px;
  label {
    width: 84px;
    flex-shrink: 0;
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  input[type='range'] {
    flex: 1;
    accent-color: var(--color-primary);
    cursor: pointer;
  }
  .a-val {
    width: 38px;
    text-align: right;
    font-size: 0.74rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
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
