<template>
  <div class="stock-single-panel" :class="{ compact }">
    <div class="panel-header">
      <LucideIcon name="TrendingUp" :size="18" color="var(--color-primary)" />
      <span class="symbol">{{ symbol }}</span>
      <span v-if="loadingQuote" class="q-state">行情加载中…</span>
      <span v-else-if="!quote" class="q-state muted">（无实时行情）</span>
      <span
        v-else-if="changePercent !== null"
        class="change"
        :class="changePercent >= 0 ? 'up' : 'down'"
      >
        {{ quote.last_price?.toFixed(2) }}
        {{ changePercent >= 0 ? '▲' : '▼' }} {{ Math.abs(changePercent).toFixed(2) }}%
      </span>
    </div>

    <div class="panel-body">
      <StockBasicCard :quote="quote" :instrument="instrument" :compact="compact" />
      <KlineChartCard
        :symbol="symbol"
        :instrument-name="instrument?.name"
        :period="period"
        :bars="bars"
        :loading="loadingKline"
        :error="klineError"
        :compact="compact"
        @update:period="(p: Period) => (period = p)"
        @visible-range="onVisibleRange"
      />
      <KlineAnalysisCard
        :symbol="symbol"
        :instrument-name="instrument?.name"
        :period="period"
        :bars="bars"
        :visible-range="visibleRange"
        :loading="loadingKline"
        :compact="compact"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Quote, Period, Instrument } from '../types'
import { getKlines } from '../api'
import { toBars, type KlineBar } from '../klineUtils'
import StockBasicCard from './StockBasicCard.vue'
import KlineChartCard from './KlineChartCard.vue'
import KlineAnalysisCard from './KlineAnalysisCard.vue'

const props = defineProps<{
  symbol: string
  quote?: Quote
  /** 标的元数据（名称/交易所/类型等），由上层并行获取后传入 */
  instrument?: Instrument
  loadingQuote?: boolean
  /** 紧凑模式（小窗口） */
  compact?: boolean
}>()

const changePercent = computed(() => {
  const q = props.quote
  if (!q || q.last_price == null || q.prev_close == null || !q.prev_close) return null
  return ((q.last_price - q.prev_close) / q.prev_close) * 100
})

/* ---- K 线单一数据源：本面板统一拉取，图表/分析共享，避免重复请求 ---- */
const period = ref<Period>('1d')
const bars = ref<KlineBar[]>([])
const loadingKline = ref(false)
const klineError = ref('')
// 图表当前可见区间（命中 bars 的下标，含端点）；-1 表示尚未由图表广播
const visibleRange = ref<{ start: number; end: number }>({ start: -1, end: -1 })

async function loadKline() {
  if (!props.symbol) return
  loadingKline.value = true
  klineError.value = ''
  try {
    const k = await getKlines({ symbol: props.symbol, period: period.value, count: 300 })
    bars.value = toBars(k)
    if (!bars.value.length) klineError.value = '暂无 K 线数据'
  } catch (e) {
    klineError.value = (e as Error).message || 'K 线加载失败'
  } finally {
    loadingKline.value = false
  }
}

watch(
  () => props.symbol,
  (next, prev) => {
    // 标的切换（新查询）时，无论单次还是批量，K 线坐标图都重置为日 K
    if (next !== prev) period.value = '1d'
    loadKline()
  },
  { immediate: true },
)

// 周期自身变化（用户点击年/月/周/日 radio）才走这里，不触发标的重置
watch(
  () => period.value,
  (p, prev) => {
    if (p !== prev) loadKline()
  },
)
function onVisibleRange(r: { start: number; end: number }) {
  visibleRange.value = r
}
</script>

<style scoped lang="scss">
.stock-single-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;

    .symbol {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .q-state {
      font-size: 0.85rem;
      font-weight: 600;
      &.muted { color: var(--text-muted); font-weight: 400; }
    }

    .change {
      font-size: 0.9rem;
      font-weight: 600;
      &.up { color: #e63946; }
      &.down { color: #2ea043; }
    }
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &.compact {
    gap: 10px;

    .panel-header {
      gap: 8px;
      .symbol { font-size: 0.95rem; }
      .change { font-size: 0.82rem; }
    }

    .panel-body { gap: 10px; }
  }
}
</style>
