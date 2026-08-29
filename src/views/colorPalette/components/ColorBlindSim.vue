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
            :class="{ 'is-transparent': parseAlpha(c) < 1 }"
            :style="{ '--c': c }"
            :title="c"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { hexToRgba, parseAlpha, rgbaToHex, simulateColorBlind } from '../colorMath'
import { COLOR_BLIND_META, type ColorBlindType } from '../types'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

// 模拟源：优先工作区，其次当前配色方案
const source = computed(() =>
  store.swatches.length ? store.swatches : store.harmonyColors,
)

/** 色盲模拟仅作用于 RGB，透明度原样保留 */
function sim(hex: string, type: ColorBlindType): string {
  const rgba = hexToRgba(hex)
  return rgbaToHex({ ...simulateColorBlind(rgba, type), a: rgba.a })
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
          position: relative;
          /* 不透明：纯色渲染（参照改动前，无棋盘格，无锯齿） */
          background: var(--c);
          /* 透明：启用 SVG 棋盘格 + inset box-shadow 预览 */
          &.is-transparent {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='8' height='8' fill='%23cfcfcf'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23cfcfcf'/%3E%3Crect x='8' width='8' height='8' fill='%23f3f3f3'/%3E%3Crect y='8' width='8' height='8' fill='%23f3f3f3'/%3E%3C/svg%3E");
            background-size: 16px 16px;
            box-shadow: inset 0 0 0 9999px var(--c);
          }
        }
      }
}
</style>
