<template>
  <div class="stock-single-panel" :class="{ compact }">
    <div class="panel-header">
      <div class="header-left">
        <LucideIcon name="TrendingUp" :size="18" color="var(--color-primary)" />
        <span class="name">{{ instrument?.name || symbol }}</span>
        <span class="symbol">{{ symbol }}</span>
      </div>
      <div class="header-right">
        <button
          class="watch-btn"
          :class="{ added: isWatched }"
          :title="isWatched ? '移出自选股' : '加入自选股'"
          @click="toggleWatch"
        >
          <LucideIcon :name="isWatched ? 'Check' : 'Star'" :size="14" />
          <span>{{ isWatched ? '已加入' : '加入自选' }}</span>
        </button>
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
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { Quote, Period, Instrument } from '../types'
import { getKlines } from '../api'
import { toBars, type KlineBar } from '../klineUtils'
import { useWatchlistStore } from '../watchlistStore'
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

/* ---- 自选股：详情头部「加入自选」按钮状态与切换 ---- */
const watchStore = useWatchlistStore()
const isWatched = computed(() => watchStore.has(props.symbol))

async function toggleWatch() {
  try {
    if (isWatched.value) {
      await watchStore.remove(props.symbol)
      ElMessage.success(`已移出自选股：${props.symbol}`)
    } else {
      await watchStore.add({
        symbol: props.symbol,
        name: props.instrument?.name,
        exchange: props.instrument?.exchange,
        region: props.instrument?.region,
        type: props.instrument?.type,
      })
      ElMessage.success(`已加入自选股：${props.symbol}`)
    }
  } catch (e) {
    ElMessage.error('操作自选股失败：' + (e instanceof Error ? e.message : '未知错误'))
  }
}

onMounted(() => {
  // 确保自选股列表已加载，使按钮「是否已加入」状态准确
  if (!watchStore.loaded.value) watchStore.load().catch(() => {})
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
    justify-content: space-between;
    gap: 10px;

    .header-left,
    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .name {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .symbol {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    .q-state {
      font-size: 0.85rem;
      font-weight: 600;
      &.muted { color: var(--text-muted); font-weight: 400; }
    }

    .watch-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      background: transparent;
      color: var(--color-primary);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;

      &:hover {
        background: var(--bg-hover, rgba(0, 0, 0, 0.05));
      }

      &.added {
        color: #f5a623;
        border-color: #f5a623;
        background: rgba(245, 166, 35, 0.08);
      }
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
      .header-left,
      .header-right { gap: 8px; }
      .name { font-size: 0.95rem; }
      .symbol { font-size: 0.8rem; }
      .watch-btn { padding: 3px 8px; font-size: 0.75rem; }
      .change { font-size: 0.82rem; }
    }

    .panel-body { gap: 10px; }
  }
}
</style>
