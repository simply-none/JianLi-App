<template>
  <div ref="chartRef" class="forecast-chart"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, nextTick, ref, watch, computed } from 'vue'
import * as echarts from 'echarts'
import { installPassiveScrollListeners } from '@/utils/passiveEvents'
import { storeToRefs } from 'pinia'
import useThemeStore from '@/store/useTheme'
import { THEME_COLORS } from '@/utils/chartTheme'
import { useThemeMode } from '@/utils/themeMode'
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

/** 当前主题（用于图表配色随主题切换） */
const { currentTheme } = storeToRefs(useThemeStore())
/** 当前主题明暗档 */
const { isDark } = useThemeMode()

/** 当前主题配色（与记账 / 番茄钟图表同源，见 utils/chartTheme.ts） */
const themeColors = computed(() => THEME_COLORS[currentTheme.value] || THEME_COLORS.light)

/* ---------------- 视觉常量 ----------------
 * 天气页是「动态渐变背景 + 毛玻璃卡片」，不读 --text-primary 那套不透明实色
 * token（会盖掉渐变、发灰发糊），而是复用 chartTheme 的主题配色：
 * 网格线 / 轴标签 / 标签文字走主题色（随 26 个主题切换）；
 * 温度色保留列表态范围条的语义（低温蓝 #7cc4f5 → 高温暖黄 #ffd57c），
 * 仅按明暗档调明度：暗档用亮色保证在深底上可读，亮档压深保证在浅底上可读。
 * 全部色值都是 computed，主题或明暗变化后由 watch 触发重绘。
 * ------------------------------------------ */
/** 主文字：折线数值标签 */
const colorText = computed(() => themeColors.value.labelColor)
/** 次文字：图例、x 轴标签、最低温标签 */
const colorTextSoft = computed(() => themeColors.value.axisLabel)
/** 网格 / 分割线 */
const colorGrid = computed(() => themeColors.value.gridLine)
/** tooltip 底色 / 边框 / 文字 */
const colorTooltipBg = computed(() => themeColors.value.tooltipBg)
const colorTooltipBorder = computed(() => themeColors.value.tooltipBorder)
const colorTooltipText = computed(() => themeColors.value.tooltipText)
/** 折线点描边：暗档白色、亮档深色半透明 */
const colorInk = computed(() => (isDark.value ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.45)'))
/** 次透明中性色：tooltip 指示器 / 区间带未着色部分 */
const colorInkSoft = computed(() => (isDark.value ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'))
/** tooltip 轴指示器阴影 */
const colorAxisShadow = computed(() =>
  isDark.value ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
)
/** 高温暖黄：暗档用原亮度，亮档压深 */
const colorHigh = computed(() => (isDark.value ? '#ffd57c' : '#c9971f'))
/** 低温冷蓝：暗档用原亮度，亮档压深 */
const colorLow = computed(() => (isDark.value ? '#7cc4f5' : '#2f7fb8'))

/**
 * 把 #rgb / #rrggbb 转成带透明度的 rgba 字符串
 *
 * 区间带 / 渐变需要由语义色按透明度派生（ECharts 不支持对色值整体设 alpha），
 * 而主题色值形态不固定，可能已是 rgba()，此时原样返回不叠加透明度。
 * @param color 颜色值
 * @param alpha 目标透明度（0~1）
 * @returns rgba() 或原值
 */
function hexAlpha(color: string, alpha: number): string {
  const hex = color.trim()
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  let body = m[1]
  if (body.length === 3) body = body.replace(/./g, (c) => c + c)
  const r = parseInt(body.slice(0, 2), 16)
  const g = parseInt(body.slice(2, 4), 16)
  const b = parseInt(body.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
        style: { fill: hexAlpha(colorLow.value, 0.28) },
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
      textStyle: { color: colorTextSoft.value, fontSize: 11 },
      data: ['最高温', '最低温'],
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: colorGrid.value } },
      axisTick: { show: false },
      axisLabel: { color: colorTextSoft.value, fontSize: 11, margin: 8 },
    },
    yAxis: {
      type: 'value',
      min: minLow - pad,
      max: maxHigh + pad,
      // 数值由折线标签直接给出，坐标轴只保留极淡的分隔线作参考
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: colorGrid.value, type: 'dashed' } },
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
        itemStyle: { color: colorHigh.value, borderColor: colorInk.value, borderWidth: 1 },
        lineStyle: {
          width: 2.4,
          color: colorHigh.value,
          shadowBlur: 8,
          // ECharts 的 lineStyle 没有 shadowOpacity，透明度得从颜色本身派生
          shadowColor: hexAlpha(colorHigh.value, 0.35),
        },
        label: {
          show: true,
          position: 'top',
          color: colorText.value,
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
        itemStyle: { color: colorLow.value, borderColor: colorInk.value, borderWidth: 1 },
        lineStyle: {
          width: 2.4,
          color: colorLow.value,
          shadowBlur: 8,
          shadowColor: hexAlpha(colorLow.value, 0.35),
        },
        label: {
          show: true,
          position: 'bottom',
          color: colorTextSoft.value,
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

// 主题切换（含明暗档翻转）时重绘：配色全部来自 computed，需主动 setOption
watch([currentTheme, isDark], () => nextTick(render))
</script>

<style scoped lang="scss">
.forecast-chart {
  width: 100%;
  height: 200px;
}
</style>
