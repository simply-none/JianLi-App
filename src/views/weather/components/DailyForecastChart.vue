<template>
  <div ref="chartRef" class="forecast-chart"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { installPassiveScrollListeners } from '@/utils/passiveEvents'
import { storeToRefs } from 'pinia'
import useThemeStore from '@/store/useTheme'
import { useGlassChartColors } from '../composables/useGlassChartTheme'
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

/** 当前主题（用于主题切换时触发重绘） */
const { currentTheme } = storeToRefs(useThemeStore())

/** 玻璃底图表配色（白字系 + 深色 tooltip + 明暗档语义色） */
const C = useGlassChartColors()

/* ---------------- 视觉常量 ----------------
 * 天气页是「动态渐变背景 + 毛玻璃卡片」，页面底**恒为深色渐变**，故图表文字层
 * 一律走白色系（与 `--glass-text-*` 同口径），**不用 `THEME_COLORS` 的
 * `labelColor` / `axisLabel`**（那是给实色卡片的，亮档主题下是深灰 `#374151`，
 * 在渐变蓝底上会发灰发脏，用户反馈的「图表不协调」正源于此）。
 * 网格线同理改用白色低透明（替代浅灰实色）。
 * 温度色保留列表态范围条的语义（低温蓝 → 高温暖黄），仅按明暗档调明度。
 * 全部色值集中在 `useGlassChartColors()`，主题或明暗变化后由其响应式驱动重绘。
 * ------------------------------------------ */

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
  // ⚠️ 区间带必须半透明：不透明竖条会盖住两条折线，越画越难读（用户反馈点之一）
  const bandFill = C.value.bandFill
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
        style: { fill: bandFill },
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
  const c = C.value
  const list = props.forecast
  const dates = list.map((d) => d.date)
  const lows = list.map((d) => d.low)
  const highs = list.map((d) => d.high)

  const minLow = Math.min(...lows)
  const maxHigh = Math.max(...highs)
  const pad = Math.max((maxHigh - minLow) * 0.2, 2)
  // ⚠️ 上下界取整：避免 14.6~36.4 这类「半度」轴范围，几何上也让折线贴到网格线
  const axisMin = Math.floor(minLow - pad)
  const axisMax = Math.ceil(maxHigh + pad)

  /** 只有 1 天时画不了区间带（无宽度），直接退化成两个点 */
  const hasRange = list.length > 1
  /** 数值标签抽稀步长（series.label 无 interval，用 formatter 返回空串跳过） */
  const labelStep = list.length <= 10 ? 1 : Math.ceil(list.length / 8)
  /** 首日温差：只标一次，让「今日温差几度」不用自己减（数据直观性的关键补充） */
  const todaySpan = Math.round((list[0].high - list[0].low) * 10) / 10

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 320,
    grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: c.tooltipText, fontSize: 12 },
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: c.inkSoft },
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
      textStyle: { color: c.textSoft, fontSize: 11 },
      data: ['最高温', '最低温'],
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: c.grid } },
      axisTick: { show: false },
      axisLabel: { color: c.textSoft, fontSize: 11, margin: 8 },
    },
    yAxis: {
      type: 'value',
      min: axisMin,
      max: axisMax,
      // 数值由折线标签直接给出，坐标轴只保留极淡的分隔线作参考
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: c.grid, type: 'dashed' } },
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
        // 折点放大 + 亮色填充 + 白描边：在渐变蓝底上是「一眼可见」的关键
        symbolSize: 7,
        itemStyle: { color: c.highPoint, borderColor: '#fff', borderWidth: 1.5 },
        lineStyle: {
          width: 2.6,
          color: c.high,
          shadowBlur: 8,
          // ECharts 的 lineStyle 没有 shadowOpacity，透明度得从颜色本身派生
          shadowColor: hexAlpha(c.high, 0.35),
        },
        label: {
          show: true,
          position: 'top',
          color: c.text,
          fontSize: 11,
          fontWeight: 600,
          // 天数多时按步长抽稀，避免标签互相压叠
          formatter: (p: echarts.DefaultLabelFormatterCallbackParams) =>
            p.dataIndex % labelStep === 0 ? `${p.value}°` : '',
        },
        // 首日温差角标：直接给出「今天差几度」，省掉心算
        markPoint: {
          // ⚠️ 不要写 `symbol:'none'`：会让 label 锚点算不出来、整条标注被静默丢弃。
          // 用 `symbolSize: 0` 抹掉默认 pin 图形，只留文字。
          silent: true,
          data: [
            {
              name: '今日温差',
              coord: [0, list[0].low],
              symbolSize: 0,
              label: {
                show: true,
                offset: [0, -30],
                formatter: `温差 ${todaySpan}°`,
                color: '#2b2205',
                backgroundColor: c.highPoint,
                padding: [2, 5],
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600 as const,
              },
            },
          ],
        },
        z: 3,
      },
      {
        name: '最低温',
        type: 'line',
        data: lows,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: c.lowPoint, borderColor: '#fff', borderWidth: 1.5 },
        lineStyle: {
          width: 2.6,
          color: c.low,
          shadowBlur: 8,
          shadowColor: hexAlpha(c.low, 0.35),
        },
        label: {
          show: true,
          position: 'bottom',
          // 低温标签用 textSoft 而非 textFaint：标签落在区间带上方，需保证可读
          color: c.textSoft,
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

// 主题切换（含明暗档翻转）时重绘：配色全部来自 C，需主动 setOption
watch([currentTheme, () => C.value], () => nextTick(render))
</script>

<style scoped lang="scss">
.forecast-chart {
  width: 100%;
  height: 200px;
}
</style>
