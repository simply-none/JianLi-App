<template>
  <div class="kline-chart-card" :class="{ compact }">
    <div class="card-toolbar">
      <span class="card-title">
        K 线 · {{ instrumentName || symbol }}
        <span class="symbol-sub">{{ symbol }}</span>
      </span>
      <div class="toolbar-right">
        <div class="indicator-switch">
          <span class="switch-label">指标</span>
          <button
            v-for="ind in ALL_INDICATORS"
            :key="ind.key"
            type="button"
            class="ind-chip"
            :class="{ active: activeIndicators.includes(ind.key) }"
            @click="toggleIndicator(ind.key)"
          >{{ ind.label }}</button>
        </div>
        <div class="period-switch">
          <el-radio-group :model-value="period" size="small" @change="(v: any) => emit('update:period', v)">
            <el-radio-button v-for="p in periods" :key="p.value" :value="p.value">
              {{ p.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <div v-if="loading" class="chart-state">加载中…</div>
    <div v-else-if="error" class="chart-state error">{{ error }}</div>
    <div v-else ref="chartRef" class="chart-canvas" :style="{ height: chartHeight + 'px' }"></div>
  </div>
</template>

<script lang="ts">
import { ref } from 'vue'

interface IndicatorOption {
  key: 'volume' | 'macd' | 'kdj' | 'rsi' | 'boll' | 'cci' | 'wr' | 'bias'
  label: string
}

/** 可叠加在 K 线下方的指标，固定顺序 */
const ALL_INDICATORS: IndicatorOption[] = [
  { key: 'volume', label: '成交量' },
  { key: 'macd', label: 'MACD' },
  { key: 'kdj', label: 'KDJ' },
  { key: 'rsi', label: 'RSI' },
  { key: 'boll', label: 'BOLL' },
  { key: 'cci', label: 'CCI' },
  { key: 'wr', label: 'WR' },
  { key: 'bias', label: 'BIAS' },
]

const STOCK_INDICATORS_KEY = 'stock:klineIndicators'

/** 从 localStorage 读取已勾选指标（校验合法性），默认仅成交量 */
function loadActiveIndicators(): string[] {
  try {
    const raw = localStorage.getItem(STOCK_INDICATORS_KEY)
    if (!raw) return ['volume']
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return ['volume']
    const valid = arr.filter((k: string) => ALL_INDICATORS.some((i) => i.key === k))
    return valid.length ? valid : ['volume']
  } catch {
    return ['volume']
  }
}

/**
 * 全局共享的下方指标勾选（模块级单例）：所有股票共用同一份，
 * 在某只股票上勾选/取消会即时反映到全部股票的 K 线图。
 * 仅初始化一次（从 localStorage 恢复），不随组件实例重建。
 */
const activeIndicators = ref<string[]>(loadActiveIndicators())

function saveActiveIndicators() {
  try {
    localStorage.setItem(STOCK_INDICATORS_KEY, JSON.stringify(activeIndicators.value))
  } catch {
    /* 忽略：隐私模式等无法写入时不影响功能 */
  }
}

/** 切换指标并持久化（全局共享，所有股票同步生效） */
function toggleIndicator(key: string) {
  const idx = activeIndicators.value.indexOf(key)
  if (idx >= 0) {
    activeIndicators.value.splice(idx, 1)
  } else {
    activeIndicators.value.push(key)
  }
  // 重新赋值以触发 watch（数组内容变化无法被默认比较侦测）
  activeIndicators.value = [...activeIndicators.value]
  saveActiveIndicators()
}
</script>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { Period } from '../types'
import { formatKlineDate, calcMA, calcMACD, calcKDJ, calcRSI, calcBOLL, calcCCI, calcWR, calcBIAS, type KlineBar } from '../klineUtils'

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

/** 指标定义与全局勾选状态见上方模块级 <script> 单例（所有股票共享、localStorage 持久化） */

/**
 * 布局高度策略（像素固定，而非百分比均分）：
 * - 蜡烛图与每个下方指标都用「固定高度」，每新增一个指标，图表总高随之增长，
 *   子图不再被压缩。
 * - 紧凑模式（小窗口）整体收敛，但仍保持每项固定高度、总高随指标增长。
 */
const CANDLE_H = computed(() => (props.compact ? 150 : 260))
const IND_H = computed(() => (props.compact ? 84 : 120))
const LAYOUT_LEFT = 56
const LAYOUT_RIGHT = 16
const GAP = 14 // 子图之间间距
const TOP_PAD = 6 // 顶部留白
const BOTTOM_PAD = 24 // 底部留给 dataZoom 滑块
/** 图表容器总高 = 蜡烛图 + Σ每项指标 + 间距 + 上下留白 */
const chartHeight = computed(() => {
  const n = activeIndicators.value.length
  return TOP_PAD + CANDLE_H.value + (IND_H.value + GAP) * n + BOTTOM_PAD
})

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
// 监听容器尺寸变化：el-tabs 非激活页为 display:none(0 宽)，切到该 tab 时若只是 resize
// 不够（0 宽初始化会导致 dataZoom 损坏、数据挤到左侧），必须从隐藏变为可见时强制重 init。
let ro: ResizeObserver | null = null
let lastObservedWidth = 0
let lastObservedHeight = 0

function fmtDate(ts: number): string {
  return formatKlineDate(ts, props.period)
}

/** 最多保留 3 位小数（去掉末尾多余的 0，如 12.5 / 12.567 / 12） */
function fmtNum(n: unknown): string {
  const v = Number(n)
  if (n == null || n === '' || isNaN(v)) return '-'
  return parseFloat(v.toFixed(3)).toString()
}

/** 成交量：自动以万/亿为单位，最多保留 2 位小数 */
function fmtVol(n: unknown): string {
  const v = Number(n)
  if (n == null || n === '' || isNaN(v)) return '-'
  if (v >= 1e8) return parseFloat((v / 1e8).toFixed(2)) + '亿'
  if (v >= 1e4) return parseFloat((v / 1e4).toFixed(2)) + '万'
  return String(v)
}

function buildOption(): echarts.EChartsOption {
  const dates = props.bars.map((b) => fmtDate(b.timestamp))
  // 蜡烛数据：[开, 收, 低, 高]
  const candle = props.bars.map((b) => [b.open, b.close, b.low, b.high])
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

  // 按固定顺序取当前激活的下方指标
  const enabled = ALL_INDICATORS.filter((i) => activeIndicators.value.includes(i.key))
  const M = enabled.length + 1 // 含顶部蜡烛图
  const bottomIndex = M - 1 // 仅最底部网格显示 x 轴日期标签

  // ---- 动态布局（像素固定高度）：蜡烛图 + 每项指标各占固定高度，总高随指标数增长 ----
  // top/height 为数字即表示像素，固定高度保证新增指标时图表整体变高而非压扁
  const grids: any[] = [
    { left: LAYOUT_LEFT, right: LAYOUT_RIGHT, top: TOP_PAD, height: CANDLE_H.value },
  ]
  let cursor = TOP_PAD + CANDLE_H.value + GAP
  for (let i = 0; i < enabled.length; i++) {
    grids.push({ left: LAYOUT_LEFT, right: LAYOUT_RIGHT, top: cursor, height: IND_H.value })
    cursor += IND_H.value + GAP
  }

  // ---- 坐标轴 ----
  const xAxes: any[] = [
    {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: '#888' } },
      axisLabel: { color: '#888', show: bottomIndex === 0 },
    },
  ]
  const yAxes: any[] = [
    {
      scale: true,
      splitArea: { show: false },
      axisLabel: { color: '#888' },
      splitLine: { lineStyle: { color: 'rgba(136,136,136,0.15)' } },
    },
  ]
  const series: any[] = [
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
    { name: 'MA5', type: 'line', data: ma5, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
    { name: 'MA10', type: 'line', data: ma10, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' } },
    { name: 'MA20', type: 'line', data: ma20, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#8b5cf6' }, itemStyle: { color: '#8b5cf6' } },
  ]

  // ---- 为激活的每个指标生成 grid 对应的 xAxis/yAxis/series ----
  enabled.forEach((ind, i) => {
    const gi = i + 1
    xAxes.push({
      type: 'category',
      gridIndex: gi,
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: '#888' } },
      axisLabel: { color: '#888', show: bottomIndex === gi },
    })
    if (ind.key === 'volume') {
      yAxes.push({
        gridIndex: gi,
        splitNumber: 2,
        axisLabel: { color: '#888', formatter: (v: number) => (v >= 1e8 ? (v / 1e8).toFixed(1) + '亿' : (v / 1e4).toFixed(0) + '万') },
        splitLine: { show: false },
      })
      series.push({ name: '成交量', type: 'bar', xAxisIndex: gi, yAxisIndex: gi, data: volumes as unknown as number[] })
    } else if (ind.key === 'macd') {
      const { dif, dea, macd } = calcMACD(props.bars)
      const macdBar = macd.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? '#e63946' : '#2ea043' } }))
      yAxes.push({ gridIndex: gi, splitNumber: 2, axisLabel: { color: '#888' }, splitLine: { show: false } })
      series.push(
        { name: 'DIF', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: dif, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
        { name: 'DEA', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: dea, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' } },
        // MACD 以细竖线呈现（固定像素宽度，不随类目宽度变化），贴近同花顺竖线观感
        { name: 'MACD柱', type: 'bar', xAxisIndex: gi, yAxisIndex: gi, barWidth: props.compact ? 1 : 2, data: macdBar as unknown as number[] },
      )
    } else if (ind.key === 'kdj') {
      const { k, d: kd, j } = calcKDJ(props.bars)
      yAxes.push({ gridIndex: gi, scale: true, splitNumber: 3, axisLabel: { color: '#888' }, splitLine: { show: false } })
      series.push(
        { name: 'K', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: k, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
        { name: 'D', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: kd, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' } },
        { name: 'J', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: j, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#8b5cf6' }, itemStyle: { color: '#8b5cf6' } },
      )
    } else if (ind.key === 'rsi') {
      const rsi = calcRSI(props.bars)
      yAxes.push({ gridIndex: gi, min: 0, max: 100, splitNumber: 2, axisLabel: { color: '#888' }, splitLine: { show: false } })
      series.push({ name: 'RSI', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: rsi, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#06b6d4' }, itemStyle: { color: '#06b6d4' } })
    } else if (ind.key === 'boll') {
      const { mid, upper, lower } = calcBOLL(props.bars)
      yAxes.push({ gridIndex: gi, scale: true, splitNumber: 3, axisLabel: { color: '#888' }, splitLine: { show: false } })
      series.push(
        { name: 'BOLL上', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: upper, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#e63946' }, itemStyle: { color: '#e63946' } },
        { name: 'BOLL中', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: mid, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
        { name: 'BOLL下', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: lower, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#2ea043' }, itemStyle: { color: '#2ea043' } },
      )
    } else if (ind.key === 'cci') {
      const cci = calcCCI(props.bars)
      yAxes.push({ gridIndex: gi, scale: true, splitNumber: 3, axisLabel: { color: '#888' }, splitLine: { show: false } })
      series.push({ name: 'CCI', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: cci, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#06b6d4' }, itemStyle: { color: '#06b6d4' } })
    } else if (ind.key === 'wr') {
      const wr = calcWR(props.bars)
      yAxes.push({ gridIndex: gi, min: 0, max: 100, splitNumber: 2, axisLabel: { color: '#888' }, splitLine: { show: false } })
      series.push({ name: 'WR', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: wr, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#8b5cf6' }, itemStyle: { color: '#8b5cf6' } })
    } else if (ind.key === 'bias') {
      const bias = calcBIAS(props.bars)
      yAxes.push({ gridIndex: gi, scale: true, splitNumber: 3, axisLabel: { color: '#888' }, splitLine: { show: false } })
      series.push({ name: 'BIAS', type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: bias, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } })
    }
  })

  const xAxisIndexAll = Array.from({ length: M }, (_, i) => i)

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      // 小窗/紧凑模式避免 tooltip 溢出视口
      confine: true,
      // 自定义中文悬浮提示：开/收/低/高 + 成交量 + 均线 + 指标，数值最多 3 位小数
      formatter: (params: any) => {
        if (!params || !params.length) return ''
        const date = params[0].axisValue
        let html = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`
        for (const p of params) {
          const name = p.seriesName
          // 成交量/部分 series 的 data 形如 { value, itemStyle, _date }，需取出数值
          const raw = p.value && typeof p.value === 'object' && 'value' in p.value ? p.value.value : p.value
          if (name === 'K线') {
            const arr = Array.isArray(raw) ? raw : []
            const [o, c, l, h] = arr
            html += `<div>${p.marker}开: ${fmtNum(o)}　收: ${fmtNum(c)}</div>`
            html += `<div>${p.marker}低: ${fmtNum(l)}　高: ${fmtNum(h)}</div>`
          } else if (name === '成交量') {
            html += `<div>${p.marker}成交量: ${fmtVol(Number(raw))}</div>`
          } else {
            html += `<div>${p.marker}${name}: ${raw == null ? '-' : fmtNum(Number(raw))}</div>`
          }
        }
        return html
      },
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    dataZoom: [
      { type: 'inside', xAxisIndex: xAxisIndexAll, start: 60, end: 100 },
      props.compact
        ? { type: 'slider', xAxisIndex: xAxisIndexAll, show: false, start: 60, end: 100 }
        : { type: 'slider', xAxisIndex: xAxisIndexAll, bottom: 4, height: 16, start: 60, end: 100 },
    ],
    series,
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
  // 容器隐藏时（display:none）先不初始化，否则 ECharts 以 0 宽创建实例，
  // dataZoom/坐标轴布局会损坏，等 ResizeObserver 在可见时触发再 init。
  if (chartRef.value.offsetWidth === 0 || chartRef.value.offsetHeight === 0) return
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
  // el-tabs 切换 tab 时非激活页从 display:none 变为可见，容器尺寸由 0 变为实际值。
  // 此时若只是 resize，0 宽初始化导致的 dataZoom 损坏无法恢复，必须 dispose 后重新 init。
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      const w = cr.width
      const h = cr.height
      if (w === 0 || h === 0) {
        lastObservedWidth = 0
        lastObservedHeight = 0
        return
      }
      // 从隐藏(0 宽) 变为可见：旧实例是 0 宽初始化的，直接 resize 不够
      if (chart && (lastObservedWidth === 0 || lastObservedHeight === 0)) {
        chart.dispose()
        chart = null
      }
      if (!chart) {
        render()
      } else {
        chart.resize()
      }
      lastObservedWidth = w
      lastObservedHeight = h
    })
    ro.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  ro?.disconnect()
  ro = null
  lastObservedWidth = 0
  lastObservedHeight = 0
  chart?.dispose()
  chart = null
})

// 数据/周期/加载态变化后，待 canvas 挂载再渲染
watch(
  () => [props.symbol, props.period, props.loading, props.compact] as const,
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
// 下方指标勾选变化（全局共享 ref）：重建图表（grid/series 数量随之变化）
watch(activeIndicators, () => {
  if (!props.loading && props.bars.length) nextTick(render)
})
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
    gap: 12px;
    flex-wrap: wrap;

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

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .indicator-switch {
      display: flex;
      align-items: center;
      gap: 6px;

      .switch-label {
        font-size: 0.78rem;
        color: var(--text-muted);
      }

      .ind-chip {
        font-size: 0.78rem;
        line-height: 1.2;
        padding: 2px 8px;
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.15s;

        &:hover {
          border-color: var(--color-primary);
        }

        &.active {
          color: #fff;
          background: var(--color-primary);
          border-color: var(--color-primary);
        }
      }
    }
  }

  .chart-canvas {
    width: 100%;
  }

    &.compact {
      padding: 10px;

      .card-toolbar {
        margin-bottom: 8px;
        .card-title { font-size: 0.85rem; }
        .indicator-switch {
          .switch-label { font-size: 0.72rem; }
          .ind-chip { font-size: 0.72rem; padding: 1px 6px; }
        }
      }

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
