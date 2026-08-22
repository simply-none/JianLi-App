<template>
  <div class="kline-analysis-card" :class="{ compact }">
    <div class="card-header">
      <span class="card-title">
        K 线分析 · {{ instrumentName || symbol }}
        <span class="symbol-sub">{{ symbol }}</span>
      </span>
      <span v-if="dateRangeText" class="range-tag">{{ dateRangeText }}</span>
    </div>

    <div v-if="loading" class="state">周期切换中…</div>
    <template v-else>

    <div class="params">
      <el-input-number
        v-model="ampThreshold"
        :min="0"
        :max="50"
        :step="0.5"
        size="small"
        controls-position="right"
      >
        <template #prefix>振幅≥</template>
      </el-input-number>
      <el-input-number
        v-model="limitThreshold"
        :min="0"
        :max="30"
        :step="0.5"
        size="small"
        controls-position="right"
      >
        <template #prefix>涨跌停</template>
      </el-input-number>
    </div>

    <div v-if="!result" class="state">（暂无 K 线数据）</div>
    <div v-else class="result-grid">
      <div class="metric">
        <div class="m-label">交易{{ unit }}</div>
        <div class="m-value">{{ result.totalDays }}</div>
      </div>
      <div class="metric highlight">
        <div class="m-label">振幅≥{{ ampThreshold }}% {{ unit }}数</div>
        <div class="m-value warn">{{ result.ampOverCount }}</div>
      </div>
      <div class="metric">
        <div class="m-label">涨停{{ unit }}数</div>
        <div class="m-value up">{{ result.limitUpCount }}</div>
      </div>
      <div class="metric">
        <div class="m-label">跌停{{ unit }}数</div>
        <div class="m-value down">{{ result.limitDownCount }}</div>
      </div>
      <div class="metric">
        <div class="m-label">平均振幅</div>
        <div class="m-value">{{ result.avgAmplitude.toFixed(2) }}%</div>
      </div>
      <div class="metric">
        <div class="m-label">最大回撤</div>
        <div class="m-value down">{{ result.maxDrawdown.toFixed(2) }}%</div>
      </div>
      <div class="metric">
        <div class="m-label">最大单{{ unit }}涨幅</div>
        <div class="m-value up">{{ result.maxGain.toFixed(2) }}%</div>
      </div>
      <div class="metric">
        <div class="m-label">最大单{{ unit }}跌幅</div>
        <div class="m-value down">{{ result.maxLoss.toFixed(2) }}%</div>
      </div>
      <div class="metric">
        <div class="m-label">最长连涨</div>
        <div class="m-value up">{{ result.maxUpStreak }} {{ unit }}</div>
      </div>
      <div class="metric">
        <div class="m-label">最长连跌</div>
        <div class="m-value down">{{ result.maxDownStreak }} {{ unit }}</div>
      </div>
      <div class="metric">
        <div class="m-label">区间累计</div>
        <div class="m-value" :class="result.cumulativeChange >= 0 ? 'up' : 'down'">
          {{ result.cumulativeChange.toFixed(2) }}%
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Period } from '../types'
import { analyzeKline, formatKlineDate, periodUnit, type KlineBar, type KlineAnalysisResult } from '../klineUtils'

const props = defineProps<{
  symbol: string
  /** 标的名称（中文名），用于标题展示 */
  instrumentName?: string
  /** 当前周期（用于日期范围格式化） */
  period?: Period
  /** 父级统一拉取的 K 线行式数据（完整区间） */
  bars: KlineBar[]
  /** 图表当前可见区间（命中 bars 的下标，含端点）；传空/无效则视为全量 */
  visibleRange?: { start: number; end: number }
  /** 周期切换 / 数据请求中的加载态（由父级控制） */
  loading?: boolean
  /** 紧凑模式（小窗口） */
  compact?: boolean
}>()

const ampThreshold = ref(5)
const limitThreshold = ref(10)

/** 周期单位（日/周/月/年），用于指标标签自适应 */
const unit = computed(() => periodUnit(props.period || '1d'))

/** 将图表广播的可见区间收敛为有效下标（含端点），缺省回退到全量 */
const effectiveRange = computed(() => {
  const n = props.bars.length
  const vr = props.visibleRange
  if (n === 0) return { start: 0, end: -1 }
  if (!vr || vr.start < 0 || vr.end < 0 || vr.start > vr.end) {
    return { start: 0, end: n - 1 }
  }
  const start = Math.max(0, Math.min(vr.start, n - 1))
  const end = Math.max(start, Math.min(vr.end, n - 1))
  return { start, end }
})

/** 当前可见的 K 线切片（拖动区间时实时变化，不触发接口请求） */
const visibleBars = computed(() => {
  const { start, end } = effectiveRange.value
  if (start > end) return []
  return props.bars.slice(start, end + 1)
})

/** 实时分析（依赖可见切片 + 阈值，自动重算） */
const result = computed<KlineAnalysisResult | null>(() => {
  const slice = visibleBars.value
  if (!slice.length) return null
  return analyzeKline(slice, {
    ampThreshold: ampThreshold.value,
    limitUpThreshold: limitThreshold.value,
    limitDownThreshold: limitThreshold.value,
  })
})

/** 当前分析的日期范围（标题栏展示） */
const dateRangeText = computed(() => {
  const slice = visibleBars.value
  if (slice.length === 0) return ''
  const p = props.period || '1d'
  const first = formatKlineDate(slice[0].timestamp, p)
  const last = formatKlineDate(slice[slice.length - 1].timestamp, p)
  const range = first === last ? first : `${first} ~ ${last}`
  return `${range} · ${slice.length} 根`
})
</script>

<style scoped lang="scss">
.kline-analysis-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px;

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    .card-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);

      .symbol-sub {
        margin-left: 8px;
        font-size: 0.8rem;
        font-weight: 400;
        color: var(--text-muted);
      }
    }

    .range-tag {
      font-size: 0.72rem;
      font-weight: 500;
      color: var(--text-muted);
      background: var(--bg-hover);
      border-radius: 6px;
      padding: 2px 8px;
      white-space: nowrap;
    }
  }

  .params {
    display: flex;
    gap: 12px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .result-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;

    .metric {
      background: var(--bg-hover);
      border-radius: 8px;
      padding: 10px 12px;

      &.highlight {
        outline: 1px solid rgba(252, 196, 25, 0.5);
      }

      .m-label {
        font-size: 0.72rem;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .m-value {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary);
        &.up { color: #e63946; }
        &.down { color: #2ea043; }
        &.warn { color: #fcc419; }
      }
    }
  }

  .state {
    padding: 24px 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
    &.error { color: #e63946; }
  }

  &.compact {
    padding: 10px;

    .card-header {
      margin-bottom: 8px;
      .card-title { font-size: 0.85rem; }
      .range-tag { font-size: 0.68rem; padding: 1px 6px; }
    }

    .params { gap: 8px; margin-bottom: 10px; }

    .result-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;

      .metric {
        padding: 8px 10px;
        .m-value { font-size: 1rem; }
      }
    }
  }
}
</style>
