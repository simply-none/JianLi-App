<template>
  <div class="kline-chart-card" :class="{ compact }">
    <div class="card-toolbar">
      <span class="card-title">
        K 线 · {{ instrumentName || symbol }}
        <span class="symbol-sub">{{ symbol }}</span>
      </span>
      <div class="period-switch">
        <el-radio-group :model-value="period" size="small" @change="(v: any) => emit('update:period', v)">
          <el-radio-button v-for="p in periods" :key="p.value" :value="p.value">
            {{ p.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div v-if="loading" class="chart-state">加载中…</div>
    <div v-else-if="error" class="chart-state error">{{ error }}</div>
    <div v-else ref="chartRef" class="chart-canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { Period } from '../types'
import { formatKlineDate, calcMA, type KlineBar } from '../klineUtils'

const props = defineProps<{
  symbol: string
  /** 标的名称（中文名），用于标题展示 */
  instrumentName?: string
  /** 当前周期（由父级统一管理） */
  period: Period
  /** 父级统一拉取的 K 线行式数据 */
  bars: KlineBar[]
  /** 加载态（父级 控制） */
  loading: boolean
  /** 错误文案（父级控制） */
  error: string
  /** 紧凑模式（小窗口） */
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:period', p: Period): void
  /** 当前可见区间（命中 bars 的下标，含端点） */
  (e: 'visible-range', r: { start: number; end: number }): void
}>()

interface PeriodOption {
  label: string
  value: Period
}

const periods: PeriodOption[] = [
  { label: '日K', value: '1d' },
  { label: '周K', value: '1w' },
  { label: '月K', value: '1M' },
  { label: '年K', value: '1Y' },
]

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

function fmtDate(ts: number): string {
  return formatKlineDate(ts, props.period)
}

function buildOption(): echarts.EChartsOption {
  const dates = props.bars.map((b) => fmtDate(b.timestamp))
  // 蜡烛数据：[开, 收, 低, 高]
  const candle = props.bars.map((b) => [b.open, b.close, b.low, b.high])
  const closes = props.bars.map((b) => b.close)
  const volumes = props.bars.map((b, i) => ({
    value: b.volume,
    itemStyle: {
        color: b.close >= b.open ? '#e63946' : '#2ea043',
    },
    _date: dates[i],
  }))
  // 均线（按根数自适应，日K=交易日、月K=交易月，自然随周期区分）
  const ma5 = calcMA(props.bars, 5)
  const ma10 = calcMA(props.bars, 10)
  const ma20 = calcMA(props.bars, 20)

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    grid: [
      { left: 56, right: 16, top: 16, height: '58%' },
      { left: 56, right: 16, top: '72%', height: '20%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        boundaryGap: true,
        axisLine: { lineStyle: { color: '#888' } },
        axisLabel: { color: '#888' },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: dates,
        boundaryGap: true,
        axisLine: { lineStyle: { color: '#888' } },
        axisLabel: { show: false },
      },
    ],
    yAxis: [
      {
        scale: true,
        splitArea: { show: false },
        axisLabel: { color: '#888' },
        splitLine: { lineStyle: { color: 'rgba(136,136,136,0.15)' } },
      },
      {
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { color: '#888', formatter: (v: number) => (v >= 1e8 ? (v / 1e8).toFixed(1) + '亿' : (v / 1e4).toFixed(0) + '万') },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 60, end: 100 },
      props.compact
        ? { type: 'slider', xAxisIndex: [0, 1], show: false, start: 60, end: 100 }
        : { type: 'slider', xAxisIndex: [0, 1], bottom: 4, height: 16, start: 60, end: 100 },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: candle,
        itemStyle: {
          color: '#e63946', // 涨：红
          color0: '#2ea043', // 跌：绿
          borderColor: '#e63946',
          borderColor0: '#2ea043',
        },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes as unknown as number[],
      },
      {
        name: 'MA5',
        type: 'line',
        data: ma5,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: 'MA10',
        type: 'line',
        data: ma10,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' },
      },
      {
        name: 'MA20',
        type: 'line',
        data: ma20,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, color: '#8b5cf6' },
        itemStyle: { color: '#8b5cf6' },
      },
    ],
  }
}

/** 由当前 dataZoom 百分比反推可见的 bars 下标区间（含端点） */
function getVisibleRange(): { start: number; end: number } {
  const n = props.bars.length
  if (!chart || n === 0) return { start: 0, end: Math.max(0, n - 1) }
  const opt = chart.getOption() as any
  const dz = (opt.dataZoom && opt.dataZoom[0]) || {}
  const startPct = typeof dz.start === 'number' ? dz.start : 0
  const endPct = typeof dz.end === 'number' ? dz.end : 100
  const last = n - 1
  const start = Math.round((startPct / 100) * last)
  const end = Math.round((endPct / 100) * last)
  return {
    start: Math.max(0, Math.min(start, last)),
    end: Math.max(0, Math.min(end, last)),
  }
}

function emitRange() {
  emit('visible-range', getVisibleRange())
}

function onDataZoom() {
  // 拖动/缩放区间时，实时把可见范围广播给分析卡片（不触发接口请求）
  emitRange()
}

function render() {
  if (!chartRef.value) {
    console.warn('[K线] chartRef 为空，canvas 未挂载')
    return
  }
  if (!props.bars.length) return
  // 周期切换 / 重新挂载后，canvas 已被 v-if 卸载再重建，旧实例指向脱离 DOM 的容器，
  // 必须 dispose 后再 init，否则 echarts 抛 "already initialized on the dom"。
  if (chart) {
    chart.dispose()
    chart = null
  }
  chart = echarts.init(chartRef.value)
  const opt = buildOption()
  console.log(
    '[K线] 渲染：容器',
    chartRef.value.offsetWidth + 'x' + chartRef.value.offsetHeight,
    '日期', (opt.xAxis as any)[0].data.length,
    '蜡烛', (opt.series as any)[0].data.length,
  )
  chart.setOption(opt, true)
  // 复用事件监听（setOption 不触发 datazoom，这里手动绑定 + 初次广播）
  chart.off('datazoom', onDataZoom)
  chart.on('datazoom', onDataZoom)
  emitRange()
}

function resize() {
  chart?.resize()
}

onMounted(() => {
  if (!props.loading && props.bars.length) nextTick(render)
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})

// 数据/周期/加载态变化后，待 canvas 挂载再渲染
watch(
  () => [props.symbol, props.period, props.loading] as const,
  () => {
    if (!props.loading && props.bars.length) nextTick(render)
  },
)
watch(
  () => props.bars,
  () => {
    if (!props.loading && props.bars.length) nextTick(render)
  },
)
</script>

<style scoped lang="scss">
.kline-chart-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px;
  display: flex;
  flex-direction: column;

  .card-toolbar {
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
  }

  .chart-canvas {
    width: 100%;
    height: 360px;
  }

  &.compact {
    padding: 10px;

    .card-toolbar {
      margin-bottom: 8px;
      .card-title { font-size: 0.85rem; }
    }

    .chart-canvas { height: 200px; }
    .chart-state { height: 200px; font-size: 0.8rem; }
  }

  .chart-state {
    height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 0.9rem;

    &.error {
      color: #e63946;
    }
  }
}
</style>
