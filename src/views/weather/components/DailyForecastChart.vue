<template>
  <div ref="chartRef" class="forecast-chart"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { installPassiveScrollListeners } from '@/utils/passiveEvents'
import type { ForecastDay } from '../types'

// 与 habit / accounting 模块一致：兜底 ECharts 的非 passive wheel 监听器（Chrome 警告）
installPassiveScrollListeners()

/** 组件 Props */
const props = defineProps<{
  /** 未来预报列表 */
  forecast: ForecastDay[]
}>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

/* ---------------- 视觉常量 ----------------
 * 天气页为动态渐变背景 + 毛玻璃卡片，不走明暗主题 CSS 变量；
 * 此处白色系色值与 .forecast-row / .range-bar 保持一致。
 * 温度色与列表态范围条同款渐变：低温 #7cc4f5（蓝）→ 高温 #ffd57c（暖黄）。
 * ------------------------------------------ */
const COLOR_TEXT = 'rgba(255, 255, 255, 0.92)'
const COLOR_TEXT_SOFT = 'rgba(255, 255, 255, 0.65)'
const COLOR_GRID = 'rgba(255, 255, 255, 0.12)'
const COLOR_LOW = '#7cc4f5'
const COLOR_HIGH = '#ffd57c'
/** 温差区间带（低↔高）填充色 */
const COLOR_BAND = 'rgba(124, 196, 245, 0.22)'

/**
 * 构造「温差区间带」custom series
 *
 * 在每列数据的 low ↔ high 之间画一条圆角竖条，等价于列表态的「温度范围条」，
 * 让每天的温差跨度一眼可见。宽度按类目间隙推算并设上限，避免天数少时过粗。
 * @param list 未来预报列表
 * @returns custom series 配置
 */
function buildRangeBand(list: ForecastDay[]): echarts.CustomSeriesOption {
  const count = Math.max(list.length, 1)
  return {
    name: '温差区间',
    type: 'custom',
    z: 1,
    silent: true,
    // 每项：[类目下标, 最低温, 最高温]
    data: list.map((d, i) => [i, d.low, d.high]),
    renderItem: (_params: echarts.CustomSeriesRenderItemParams, api: echarts.CustomSeriesRenderItemAPI) => {
      const idx = api.value(0) as number
      const lowPt = api.coord([idx, api.value(1)])
      const highPt = api.coord([idx, api.value(2)])
      // 网格宽度由 api 提供（coordSys 类型上只声明了 type，取不到宽高）
      const gridWidth = api.getWidth()
      const bandWidth = Math.min(gridWidth / count / 2.6, 22)
      const y = Math.min(lowPt[1], highPt[1])
      const h = Math.max(Math.abs(highPt[1] - lowPt[1]), 4)
      return {
        type: 'rect',
        shape: {
          x: lowPt[0] - bandWidth / 2,
          y,
          width: bandWidth,
          height: h,
          r: bandWidth / 2,
        },
        style: { fill: COLOR_BAND },
      }
    },
  }
}

/**
 * 构造 ECharts option
 *
 * 三条 series：
 * - `low` / `high`：双折线（低温蓝、高温暖黄）
 * - `range`：`custom` 系列，在每列 low↔high 之间画一条圆角竖条，
 *   等价于列表态的「温度范围条」，让温差跨度为一眼可见
 * @returns ECharts 配置对象
 */
function buildOption(): echarts.EChartsOption {
  const list = props.forecast
  const dates = list.map((d) => d.date)
  const lows = list.map((d) => d.low)
  const highs = list.map((d) => d.high)

  const minLow = Math.min(...lows)
  const maxHigh = Math.max(...highs)
  const pad = Math.max((maxHigh - minLow) * 0.2, 2)

  /** 只有 1 天时画不了区间带（无宽度），直接退化成两个点 */
  const hasRange = list.length > 1
  /** 数值标签抽稀步长（series.label 无 interval，用 formatter 返回空串跳过） */
  const labelStep = list.length <= 10 ? 1 : Math.ceil(list.length / 8)

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 320,
    grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: 'rgba(20, 26, 40, 0.88)',
      borderColor: 'rgba(255, 255, 255, 0.18)',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: 'rgba(255, 255, 255, 0.08)' },
      },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number }[]
        const idx = arr?.[0]?.dataIndex ?? 0
        const day = list[idx]
        if (!day) return ''
        const rows = [`<div style="font-weight:600;margin-bottom:4px">${day.date}</div>`]
        if (day.description) rows.push(`<div>${day.description}</div>`)
        rows.push(`<div>最高：${day.high}°C　最低：${day.low}°C</div>`)
        if (day.windDirection || day.windPower) {
          rows.push(`<div>风：${day.windDirection || '--'} ${day.windPower || ''}</div>`)
        }
        return rows.join('')
      },
    },
    legend: {
      show: true,
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12,
      icon: 'roundRect',
      textStyle: { color: COLOR_TEXT_SOFT, fontSize: 11 },
      data: ['最高温', '最低温'],
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: COLOR_GRID } },
      axisTick: { show: false },
      axisLabel: { color: COLOR_TEXT_SOFT, fontSize: 11, margin: 8 },
    },
    yAxis: {
      type: 'value',
      min: minLow - pad,
      max: maxHigh + pad,
      // 数值由折线标签直接给出，坐标轴只保留极淡的分隔线作参考
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: COLOR_GRID, type: 'dashed' } },
    },
    series: [
      // 温差区间带：在 low / high 之间画圆角竖条（等价于列表态的范围条）
      ...(hasRange ? [buildRangeBand(list)] : []),
      {
        name: '最高温',
        type: 'line',
        data: highs,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: COLOR_HIGH, borderColor: 'rgba(255,255,255,0.9)', borderWidth: 1 },
        lineStyle: { width: 2.4, color: COLOR_HIGH, shadowBlur: 8, shadowColor: 'rgba(255,213,124,0.35)' },
        label: {
          show: true,
          position: 'top',
          color: COLOR_TEXT,
          fontSize: 11,
          fontWeight: 600,
          // 天数多时按步长抽稀，避免标签互相压叠
          formatter: (p: echarts.DefaultLabelFormatterCallbackParams) =>
            p.dataIndex % labelStep === 0 ? `${p.value}°` : '',
        },
        z: 3,
      },
      {
        name: '最低温',
        type: 'line',
        data: lows,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: COLOR_LOW, borderColor: 'rgba(255,255,255,0.9)', borderWidth: 1 },
        lineStyle: { width: 2.4, color: COLOR_LOW, shadowBlur: 8, shadowColor: 'rgba(124,196,245,0.35)' },
        label: {
          show: true,
          position: 'bottom',
          color: COLOR_TEXT_SOFT,
          fontSize: 11,
          formatter: (p: echarts.DefaultLabelFormatterCallbackParams) =>
            p.dataIndex % labelStep === 0 ? `${p.value}°` : '',
        },
        z: 3,
      },
    ],
  }
}

/** 渲染 / 更新图表 */
function render(): void {
  if (!props.forecast.length) {
    chart?.dispose()
    chart = null
    return
  }
  const el = chartRef.value
  // 容器不可见（宽度 0）时 init 会得到空画布，跳过等下次触发
  if (!el || el.offsetWidth === 0) return
  if (!chart) chart = echarts.init(el)
  chart.setOption(buildOption(), true)

  ro?.disconnect()
  ro = new ResizeObserver(() => chart?.resize())
  ro.observe(el)
}

/** 窗口尺寸变化 */
function handleResize(): void {
  chart?.resize()
}

onMounted(() => {
  if (props.forecast.length) nextTick(render)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  ro?.disconnect()
  ro = null
  chart?.dispose()
  chart = null
})

watch(
  () => props.forecast,
  () => nextTick(render),
  { deep: true }
)
</script>

<style scoped lang="scss">
.forecast-chart {
  width: 100%;
  height: 200px;
}
</style>
