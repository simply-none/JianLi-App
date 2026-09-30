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
 * 温度暖黄与降水浅蓝保留天气语义色相，仅按明暗档调明度
 * （暗档用亮色保证在深底上可读，亮档压深保证在浅底上可读）。
 * 图表容器背景透明，仍由底层渐变透出。
 * 全部色值都是 computed，主题或明暗变化后由 watch 触发重绘。
 * ------------------------------------------ */
/** 主文字：折线数值标签 */
const colorText = computed(() => themeColors.value.labelColor)
/** 次文字：图例、x 轴标签 */
const colorTextSoft = computed(() => themeColors.value.axisLabel)
/** 弱文字：次坐标轴标签 */
const colorTextFaint = computed(() => themeColors.value.axisLabel)
/** 网格 / 分割线 */
const colorGrid = computed(() => themeColors.value.gridLine)
/** tooltip 底色与文字 */
const colorTooltipBg = computed(() => themeColors.value.tooltipBg)
const colorTooltipBorder = computed(() => themeColors.value.tooltipBorder)
const colorTooltipText = computed(() => themeColors.value.tooltipText)
/** 温度暖黄：暗档用亮暖黄，亮档压深以在浅底上可读 */
const colorTemp = computed(() => (isDark.value ? '#ffd57c' : '#c9971f'))
/** 降水冷蓝：同上 */
const colorPrecip = computed(() => (isDark.value ? '#9fd6ff' : '#3d8fc4'))
/** 折线点描边 / tooltip 竖线：暗档白色、亮档深色半透明 */
const colorInk = computed(() => (isDark.value ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.45)'))
const colorInkSoft = computed(() => (isDark.value ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'))

/**
 * 把 #rgb / #rrggbb 转成带透明度的 rgba 字符串
 *
 * 渐变色需要由语义色按透明度派生（ECharts 不支持对 colors 数组整体设 alpha），
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
      backgroundColor: colorTooltipBg.value,
      borderColor: colorTooltipBorder.value,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: colorTooltipText.value, fontSize: 12 },
      axisPointer: {
        type: 'line',
        lineStyle: { color: colorInkSoft.value, type: 'dashed' },
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
      textStyle: { color: colorTextSoft.value, fontSize: 11 },
      data: hasPrecip ? ['温度', '降水概率'] : ['温度'],
    },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: true,
      axisLine: { lineStyle: { color: colorGrid.value } },
      axisTick: { show: false },
      axisLabel: {
        color: colorTextSoft.value,
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
          color: colorTextFaint.value,
          fontSize: 10,
          formatter: '{value}%',
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: hasPrecip,
          lineStyle: { color: colorGrid.value, type: 'dashed' },
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
        itemStyle: { color: colorTemp.value, borderColor: colorInk.value, borderWidth: 1 },
        lineStyle: {
          width: 2.4,
          color: colorTemp.value,
          shadowBlur: 8,
          // ECharts 的 lineStyle 没有 shadowOpacity，透明度得从颜色本身派生
          shadowColor: hexAlpha(colorTemp.value, 0.35),
        },
        label: {
          show: true,
          position: 'top',
          color: colorText.value,
          fontSize: 11,
          fontWeight: 600,
          // 点太密时按步长抽稀，避免标签互相压叠
          formatter: (p: echarts.DefaultLabelFormatterCallbackParams) =>
            p.dataIndex % tempLabelStep === 0 ? `${p.value}°` : '',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexAlpha(colorTemp.value, 0.3) },
            { offset: 1, color: hexAlpha(colorTemp.value, 0.02) },
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
                  { offset: 0, color: hexAlpha(colorPrecip.value, 0.75) },
                  { offset: 1, color: hexAlpha(colorPrecip.value, 0.1) },
                ]),
              },
              label: {
                show: showPrecipLabel,
                position: 'top' as const,
                color: colorPrecip.value,
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

// 主题切换（含明暗档翻转）时重绘：配色全部来自 computed，需主动 setOption
watch([currentTheme, isDark], () => nextTick(render))
</script>

<style scoped lang="scss">
.forecast-chart {
  width: 100%;
  height: 190px;
}
</style>
