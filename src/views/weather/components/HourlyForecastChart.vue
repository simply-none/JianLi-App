<template>
  <div ref="chartRef" class="forecast-chart"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { installPassiveScrollListeners } from '@/utils/passiveEvents'
import type { HourlyForecast } from '../types'

// ECharts 在 init 时会给容器注册非 passive 的 wheel 监听器（Chrome 警告），
// 与 habit / accounting 等模块一致做一次性全局兜底。
installPassiveScrollListeners()

/** 组件 Props */
const props = defineProps<{
  /** 逐小时预报列表（通常 24 条） */
  hourly: HourlyForecast[]
}>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

/* ---------------- 视觉常量 ----------------
 * 天气页是「动态渐变背景 + 毛玻璃卡片」，不走明暗主题 CSS 变量
 * （那套变量是为常规主题页设计的，放在渐变底上会发灰发糊），
 * 因此此处直接采用与 .hour-col / .section-title 一致的白色系色值。
 * ------------------------------------------ */
const COLOR_TEXT = 'rgba(255, 255, 255, 0.92)'
const COLOR_TEXT_SOFT = 'rgba(255, 255, 255, 0.65)'
const COLOR_TEXT_FAINT = 'rgba(255, 255, 255, 0.45)'
const COLOR_GRID = 'rgba(255, 255, 255, 0.12)'
const COLOR_TEMP = '#ffd57c'
const COLOR_PRECIP = '#9fd6ff'

/**
 * x 轴标签抽稀：24 个点全画会挤成一团
 * @param count 数据点数量
 * @returns 每隔几个点显示一个标签（至少 1）
 */
function labelInterval(count: number): number {
  if (count <= 8) return 0
  return Math.ceil(count / 8) - 1
}

/**
 * 构造 ECharts option
 * @returns ECharts 配置对象
 */
function buildOption(): echarts.EChartsOption {
  const list = props.hourly
  // 首点显示「现在」，其余只取 HH:mm（数据源已归一化，兜底防脏值）
  const times = list.map((h, i) => (i === 0 ? '现在' : h.time))
  const temps = list.map((h) => h.temperature)
  // 降水概率缺失用 0 占位（柱高为 0 即不显示，不影响折线）
  const precips = list.map((h) => h.precipProbability ?? 0)
  const hasPrecip = list.some((h) => h.precipProbability != null)

  // 温度轴上下留白，避免折线贴顶/贴底
  const minTemp = Math.min(...temps)
  const maxTemp = Math.max(...temps)
  const pad = Math.max((maxTemp - minTemp) * 0.25, 2)

  /** 降水柱是否统一显示数值：点少时显示，点多时靠 tooltip 即可 */
  const showPrecipLabel = list.length <= 12
  /** 温度折线数值标签的抽稀步长（series.label 无 interval，只能用 formatter 返回空串跳过） */
  const tempLabelStep = list.length > 14 ? 2 : 1

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
        type: 'line',
        lineStyle: { color: 'rgba(255, 255, 255, 0.35)', type: 'dashed' },
      },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number }[]
        const idx = arr?.[0]?.dataIndex ?? 0
        const hour = list[idx]
        if (!hour) return ''
        const rows = [`<div style="font-weight:600;margin-bottom:4px">${times[idx]}</div>`]
        rows.push(`<div>温度：${hour.temperature}°C</div>`)
        if (hour.precipProbability != null) {
          rows.push(`<div>降水概率：${hour.precipProbability}%</div>`)
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
      data: hasPrecip ? ['温度', '降水概率'] : ['温度'],
    },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: true,
      axisLine: { lineStyle: { color: COLOR_GRID } },
      axisTick: { show: false },
      axisLabel: {
        color: COLOR_TEXT_SOFT,
        fontSize: 11,
        interval: labelInterval(list.length),
        margin: 8,
      },
    },
    yAxis: [
      {
        type: 'value',
        min: minTemp - pad,
        max: maxTemp + pad,
        // 温度轴：只留刻度线，不显示数值（数值由折线标签直接给出）
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        show: hasPrecip,
        axisLabel: {
          show: hasPrecip,
          color: COLOR_TEXT_FAINT,
          fontSize: 10,
          formatter: '{value}%',
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: hasPrecip,
          lineStyle: { color: COLOR_GRID, type: 'dashed' },
        },
      },
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        yAxisIndex: 0,
        data: temps,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: true,
        itemStyle: { color: COLOR_TEMP, borderColor: 'rgba(255,255,255,0.9)', borderWidth: 1 },
        lineStyle: { width: 2.4, color: COLOR_TEMP, shadowBlur: 8, shadowColor: 'rgba(255,213,124,0.35)' },
        label: {
          show: true,
          position: 'top',
          color: COLOR_TEXT,
          fontSize: 11,
          fontWeight: 600,
          // 点太密时按步长抽稀，避免标签互相压叠
          formatter: (p: echarts.DefaultLabelFormatterCallbackParams) =>
            p.dataIndex % tempLabelStep === 0 ? `${p.value}°` : '',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 213, 124, 0.30)' },
            { offset: 1, color: 'rgba(255, 213, 124, 0.02)' },
          ]),
        },
        z: 3,
      },
      ...(hasPrecip
        ? [
            {
              name: '降水概率',
              type: 'bar' as const,
              yAxisIndex: 1,
              data: precips,
              barMaxWidth: 14,
              itemStyle: {
                borderRadius: [3, 3, 0, 0],
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(159, 214, 255, 0.75)' },
                  { offset: 1, color: 'rgba(159, 214, 255, 0.10)' },
                ]),
              },
              label: {
                show: showPrecipLabel,
                position: 'top' as const,
                color: COLOR_PRECIP,
                fontSize: 10,
                formatter: '{c}%',
              },
              z: 1,
            },
          ]
        : []),
    ],
  }
}

/** 渲染 / 更新图表 */
function render(): void {
  if (!props.hourly.length) {
    chart?.dispose()
    chart = null
    return
  }
  const el = chartRef.value
  // 元素不可见（如父级 v-show 折叠）时 init 会得到 0 尺寸，跳过等下次
  if (!el || el.offsetWidth === 0) return
  if (!chart) chart = echarts.init(el)
  const opt = buildOption()
  chart.setOption(opt, true)

  ro?.disconnect()
  ro = new ResizeObserver(() => chart?.resize())
  ro.observe(el)
}

/** 窗口尺寸变化 */
function handleResize(): void {
  chart?.resize()
}

onMounted(() => {
  if (props.hourly.length) nextTick(render)
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
  () => props.hourly,
  () => nextTick(render),
  { deep: true }
)
</script>

<style scoped lang="scss">
.forecast-chart {
  width: 100%;
  height: 190px;
}
</style>
