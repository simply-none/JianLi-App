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
 * 温度暖黄与降水浅蓝保留天气语义色相，仅按明暗档调明度。
 * 图表容器背景透明，仍由底层渐变透出。
 * 全部色值集中在 `useGlassChartColors()`，主题或明暗变化后由其响应式驱动重绘。
 * ------------------------------------------ */

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
  const c = C.value
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
  // ⚠️ 上下界取整：否则轴范围会是 21.5~37.5 这种「半度」值，
  // 几何上又正好让折线贴到网格线上（用户反馈「不直观」的一个成因）
  const axisMin = Math.floor(minTemp - pad)
  const axisMax = Math.ceil(maxTemp + pad)

  /**
   * 降水柱数值标签是否显示
   *
   * ⚠️ 阈值从 12 放宽到 16：24 小时视图下柱顶数值直接可读，
   * 减少「必须 hover 才看得到降水概率」的负担（用户反馈的「不直观」）。
   */
  const showPrecipLabel = list.length <= 16
  /** 温度折线数值标签的抽稀步长（series.label 无 interval，只能用 formatter 返回空串跳过） */
  const tempLabelStep = list.length > 14 ? 2 : 1
  /** 温度极值标注：只标一次，让「今天最热 / 最冷几点」一眼可见 */
  const maxTempIdx = temps.indexOf(maxTemp)
  const minTempIdx = temps.indexOf(minTemp)
  /** 极值标注仅在两端不重合时显示（等温直线画两个标签没有意义） */
  const tempMaxLabelEnabled = maxTempIdx !== minTempIdx

  /**
   * 构造单点「极值标注」对象（复用 computed 色值，做成函数避免重复字面量）
   *
   * 用 `markPoint` 而非改 label：极值点本来就在 label 抽稀网格上概率不高，
   * 单独标注才能保证「最高 / 最低」永远可见。
   *
   * ⚠️ **不要写 `symbol: 'none'`**（实测 ECharts SVG 渲染）：
   * `symbol:'none'` 时 label 的锚点无从计算 ⇒ **整条标注（含文字）被静默丢弃**，
   * 与是否给 `value` 无关。正确做法是让 symbol 保留但缩到 0：
   * `symbolSize: 0` + `label.show: true`，这样锚点可算、文字照画。
   * （本坑是「标注整条不出现」而非「样式不对」，排查时先怀疑 symbol。）
   * @param name 标注文案
   * @param coord 数据点下标
   * @param bg 底色
   * @returns markPoint 数据项
   */
  function tempMark(name: string, coord: number, bg: string) {
    return {
      name,
      coord: [coord, temps[coord]],
      /** 保留 symbol 但缩为 0：只留文字标签，同时保证 label 锚点可计算 */
      symbolSize: 0,
      label: {
        show: true,
        // 顶部留白有限：极值点靠近顶边时让标签落到下方，避免被裁切
        offset: [0, temps[coord] > (axisMin + axisMax) / 2 ? 22 : -14],
        formatter: name,
        color: '#2b2205',
        backgroundColor: bg,
        padding: [2, 5],
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600 as const,
      },
    }
  }

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
        type: 'line',
        lineStyle: { color: c.inkSoft, type: 'dashed' },
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
      textStyle: { color: c.textSoft, fontSize: 11 },
      data: hasPrecip ? ['温度', '降水概率'] : ['温度'],
    },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: true,
      axisLine: { lineStyle: { color: c.grid } },
      axisTick: { show: false },
      axisLabel: {
        color: c.textSoft,
        fontSize: 11,
        interval: labelInterval(list.length),
        margin: 8,
      },
    },
    yAxis: [
      {
        type: 'value',
        min: axisMin,
        max: axisMax,
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
          color: c.textFaint,
          fontSize: 10,
          formatter: '{value}%',
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: hasPrecip,
          lineStyle: { color: c.grid, type: 'dashed' },
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
        // 折点放大到 7 + 亮色填充 + 白色描边：在渐变蓝底上是「一眼可见」的关键
        symbolSize: 7,
        showSymbol: true,
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
          // 点太密时按步长抽稀，避免标签互相压叠
          formatter: (p: echarts.DefaultLabelFormatterCallbackParams) =>
            p.dataIndex % tempLabelStep === 0 ? `${p.value}°` : '',
        },
        // 面积渐变收敛到折线下方一小段，避免大面积填充把柱状降水压成背景
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexAlpha(c.high, 0.22) },
            { offset: 1, color: hexAlpha(c.high, 0) },
          ]),
        },
        // 最高 / 最低温各打一枚标签：让「几点最热」不再需要自己扫折线
        markPoint: {
          // ⚠️ 这里刻意不写 `symbol:'none'`：它会让 label 锚点算不出来、
          // 整条标注被静默丢弃（见 `tempMark` 注释）。图形改用 `symbolSize: 0` 抹掉。
          silent: true,
          data: tempMaxLabelEnabled
            ? [
                tempMark('最高', maxTempIdx, c.highPoint),
                tempMark('最低', minTempIdx, c.lowPoint),
              ]
            : [],
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
                // 渐变更「实」：降水柱原来半透明渐隐，在蓝底上几乎看不见
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: hexAlpha(c.lowPoint, 0.95) },
                  { offset: 1, color: hexAlpha(c.lowPoint, 0.35) },
                ]),
              },
              label: {
                show: showPrecipLabel,
                position: 'top' as const,
                // 与柱身取同一亮色，保证「哪根柱子对应哪个数字」不会看错
                color: c.lowPoint,
                fontSize: 10,
                fontWeight: 600 as const,
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

// 主题切换（含明暗档翻转）时重绘：配色全部来自 C，需主动 setOption
watch([currentTheme, () => C.value], () => nextTick(render))
</script>

<style scoped lang="scss">
/* 与 DailyForecastChart 统一高度，两个图表形态视觉一致 */
.forecast-chart {
  width: 100%;
  height: 200px;
}
</style>
