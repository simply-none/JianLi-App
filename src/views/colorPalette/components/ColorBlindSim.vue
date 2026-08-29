<template>
  <div class="cb-sim">
    <p class="tip">基于当前工作区（或配色方案）模拟不同类型色觉缺陷下的观感</p>
    <div class="rows">
      <div class="row" v-for="row in rows" :key="row.label">
        <span class="row-label">{{ row.label }}</span>
        <div class="cells">
          <div
            v-for="(c, i) in row.colors"
            :key="i"
            class="cell"
            :style="{ background: c }"
            :title="c"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { hexToRgb, rgbToHex, simulateColorBlind } from '../colorMath'
import { COLOR_BLIND_META, type ColorBlindType } from '../types'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

// 模拟源：优先工作区，其次当前配色方案
const source = computed(() =>
  store.swatches.length ? store.swatches : store.harmonyColors,
)

function sim(hex: string, type: ColorBlindType): string {
  return rgbToHex(simulateColorBlind(hexToRgb(hex), type))
}

const rows = computed(() => {
  const base = source.value
  return [
    { label: '正常', colors: base },
    ...(Object.keys(COLOR_BLIND_META) as ColorBlindType[]).map((t) => ({
      label: COLOR_BLIND_META[t].label,
      colors: base.map((c) => sim(c, t)),
    })),
  ]
})
</script>

<style scoped lang="scss">
.cb-sim {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tip {
  margin: 0;
  font-size: 0.74rem;
  color: var(--text-muted);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  .row-label {
    width: 116px;
    flex-shrink: 0;
    font-size: 0.72rem;
    color: var(--text-secondary);
  }
  .cells {
    flex: 1;
    display: flex;
    gap: 4px;
    .cell {
      flex: 1;
      height: 32px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
    }
  }
}
</style>
