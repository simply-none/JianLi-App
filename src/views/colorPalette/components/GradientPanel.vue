<template>
  <div class="gradient-panel">
    <!-- 类型与角度控制 -->
    <div class="controls">
      <div class="seg">
        <button :class="{ on: type === 'linear' }" @click="type = 'linear'">线性</button>
        <button :class="{ on: type === 'radial' }" @click="type = 'radial'">径向</button>
      </div>
      <label v-if="type === 'linear'" class="angle">
        <span>角度 {{ angle }}°</span>
        <input type="range" min="0" max="360" step="1" v-model.number="angle" />
      </label>
    </div>

    <!-- 实时预览 -->
    <div class="preview" :class="{ 'is-transparent': gradientHasAlpha(css) }" :style="{ '--css': css }" />

    <!-- 色标编辑 -->
    <div class="stops">
      <div class="stop" v-for="(s, i) in stops" :key="i">
        <input class="picker" type="color" v-model="s.hex" :title="`色标 ${i + 1}`" />
        <div class="stop-body">
          <span class="hex">{{ s.hex.toUpperCase() }}</span>
          <div class="alpha-row">
            <span class="a-label">α</span>
            <input
              class="a-input"
              type="range"
              min="0"
              max="100"
              step="1"
              v-model.number="s.alpha"
              :title="`色标 ${i + 1} 透明度 ${s.alpha}%`"
            />
            <span class="a-val">{{ s.alpha }}%</span>
          </div>
        </div>
        <button
          class="rm"
          :disabled="stops.length <= 2"
          title="移除色标"
          @click="removeStop(i)"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 操作 -->
    <div class="actions">
      <button class="btn" @click="addStop">
        <LucideIcon name="Plus" :size="13" /> 加色标
      </button>
      <button class="btn" @click="useBase">
        <LucideIcon name="Eyedropper" :size="13" /> 用基准色
      </button>
      <button class="btn primary" @click="copyCss">
        <LucideIcon name="Copy" :size="13" /> 复制 CSS
      </button>
    </div>

    <code class="css-out">{{ css }}</code>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { gradientHasAlpha, hexToRgba, hsvToHex, rotateHue } from '../colorMath'
import { copyText } from '../clipboard'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

/** 渐变类型：线性 / 径向 */
const type = ref<'linear' | 'radial'>('linear')
/** 线性渐变角度（度） */
const angle = ref(90)
/** 色标列表（HEX + 透明度 0-100），至少 2 个 */
const stops = ref<{ hex: string; alpha: number }[]>([
  { hex: store.baseHex, alpha: 100 },
  { hex: hsvToHex(rotateHue(store.baseHsv, 180)), alpha: 100 },
])

/** 生成的 CSS 渐变字符串（带透明度，输出 rgba） */
const css = computed(() => {
  const list = stops.value
    .map((s) => {
      const { r, g, b } = hexToRgba(s.hex)
      const a = Math.round((s.alpha / 100) * 100) / 100
      return `rgba(${r}, ${g}, ${b}, ${a})`
    })
    .join(', ')
  return type.value === 'linear'
    ? `linear-gradient(${angle.value}deg, ${list})`
    : `radial-gradient(circle, ${list})`
})

/** 追加一个随机柔和色标（不透明） */
function addStop() {
  stops.value.push({ hex: hsvToHex({ h: Math.random() * 360, s: 65, v: 70 }), alpha: 100 })
}
/** 移除色标（保留至少 2 个） */
function removeStop(i: number) {
  if (stops.value.length > 2) stops.value.splice(i, 1)
}
/** 把第一个色标设为当前基准色（含透明度） */
function useBase() {
  if (stops.value[0]) {
    stops.value[0].hex = store.baseHex
    stops.value[0].alpha = store.baseAlpha
  }
}
/** 复制生成的 CSS 渐变 */
function copyCss() {
  copyText(css.value, '渐变 CSS')
}
</script>

<style scoped lang="scss">
.gradient-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    overflow: hidden;
    button {
      padding: 5px 12px;
      border: none;
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 0.78rem;
      cursor: pointer;
      &.on {
        background: var(--color-primary-light);
        color: var(--color-primary-solid);
        font-weight: 600;
      }
    }
  }
  .angle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.74rem;
    color: var(--text-muted);
    input[type='range'] {
      width: 120px;
      accent-color: var(--color-primary);
    }
  }
}
.preview {
  height: 80px;
  border-radius: var(--radius-card);
  border: 1px solid var(--border-subtle);
  position: relative;
  /* 不透明：纯渐变渲染（参照改动前，无棋盘格，无锯齿） */
  background: var(--css);
  /* 透明：启用 SVG 棋盘格 + inset box-shadow 预览 */
  &.is-transparent {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='8' height='8' fill='%23cfcfcf'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23cfcfcf'/%3E%3Crect x='8' width='8' height='8' fill='%23f3f3f3'/%3E%3Crect y='8' width='8' height='8' fill='%23f3f3f3'/%3E%3C/svg%3E");
    background-size: 16px 16px;
    box-shadow: inset 0 0 0 9999px var(--css);
  }
}
.stops {
  display: flex;
  flex-direction: column;
  gap: 6px;
  .stop {
    display: flex;
    align-items: center;
    gap: 8px;
    .picker {
      width: 34px;
      height: 26px;
      padding: 0;
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      background: none;
      cursor: pointer;
      flex-shrink: 0;
    }
    .stop-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      .hex {
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
      }
      .alpha-row {
        display: flex;
        align-items: center;
        gap: 6px;
        .a-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-weight: 700;
        }
        .a-input {
          flex: 1;
          accent-color: var(--color-primary);
          cursor: pointer;
        }
        .a-val {
          width: 34px;
          text-align: right;
          font-size: 0.7rem;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
        }
      }
    }
    .rm {
      width: 22px;
      height: 22px;
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      background: var(--bg-card);
      color: var(--text-muted);
      cursor: pointer;
      flex-shrink: 0;
      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }
  }
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-card);
    color: var(--text-secondary);
    font-size: 0.76rem;
    cursor: pointer;
    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    &.primary {
      border-color: var(--color-primary);
      background: var(--color-primary-light);
      color: var(--color-primary-solid);
      font-weight: 600;
    }
  }
}
.css-out {
  display: block;
  padding: 8px 10px;
  font-size: 0.72rem;
  color: var(--text-muted);
  background: var(--bg-hover);
  border-radius: var(--radius-btn);
  word-break: break-all;
}
</style>
