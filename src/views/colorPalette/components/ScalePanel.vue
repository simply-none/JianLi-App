<template>
  <div class="scale-panel">
    <p class="hint">基于当前基准色的色相与彩度，沿感知均匀的 OKLCH 亮度轴生成 11 档色阶（50–950），浅/深档自动收敛彩度避免溢出。</p>

    <div class="actions">
      <button class="btn" @click="addAll">
        <LucideIcon name="Plus" :size="13" /> 整组加入工作区
      </button>
      <button class="btn" @click="copyCss">
        <LucideIcon name="Braces" :size="13" /> 复制 CSS 变量
      </button>
      <button class="btn" @click="copyScss">
        <LucideIcon name="FileCode" :size="13" /> 复制 SCSS
      </button>
    </div>

    <!-- 色阶行：点击复制单色 -->
    <div class="rows">
      <div
        v-for="it in scale"
        :key="it.step"
        class="row"
        :title="`点击复制 ${it.hex.toUpperCase()}`"
        @click="copyHex(it.hex)"
      >
        <span class="bar" :style="{ background: it.hex }" />
        <span class="step">{{ it.step }}</span>
        <span class="hex">{{ it.hex.toUpperCase() }}</span>
        <LucideIcon name="Copy" :size="13" class="ic" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { generateScale, toCssVariables, toScss } from '../colorMath'
import { copyText } from '../clipboard'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

/** 由当前基准色生成的 11 档色阶（不透明） */
const scale = computed(() => generateScale(store.baseHex))

/** 复制单个色值 */
function copyHex(hex: string) {
  copyText(hex.toUpperCase(), '颜色')
}

/** 整组加入工作区（store 内部去重） */
function addAll() {
  scale.value.forEach((s) => store.addSwatch(s.hex))
}

/** 复制为 CSS 变量文本 */
function copyCss() {
  copyText(toCssVariables(scale.value.map((s) => s.hex), 'color'), '色阶 CSS')
}

/** 复制为 SCSS 变量文本 */
function copyScss() {
  copyText(toScss(scale.value.map((s) => s.hex), 'color'), '色阶 SCSS')
}
</script>

<style scoped lang="scss">
.scale-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.5;
  color: var(--text-muted);
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
  }
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 6px;
    border-radius: var(--radius-btn);
    cursor: pointer;
    transition: background 0.12s;
    &:hover {
      background: var(--bg-hover);
    }
    .bar {
      width: 100%;
      height: 26px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      flex: 1;
      min-width: 0;
    }
    .step {
      width: 34px;
      flex-shrink: 0;
      text-align: right;
      font-size: 0.74rem;
      font-weight: 700;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .hex {
      width: 78px;
      flex-shrink: 0;
      font-size: 0.74rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--text-muted);
    }
    .ic {
      color: var(--text-muted);
      flex-shrink: 0;
    }
  }
}
</style>
