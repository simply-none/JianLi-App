<template>
  <div class="pomodoro-charts">
    <div class="charts-header">
      <el-button
        :icon="ArrowLeft"
        circle
        @click="prevDay"
      />
      <el-date-picker
        v-model="curDate"
        value-format="YYYY-MM-DD"
        type="date"
        placeholder="选择日期"
        style="margin: 0 10px"
      />
      <el-button
        :icon="ArrowRight"
        circle
        :disabled="isToday"
        @click="nextDay"
      />
      <el-button
        :disabled="isToday"
        style="margin-left: 10px"
        @click="goToday"
      >
        今天
      </el-button>
    </div>

    <div class="charts-body">
      <div class="chart-section pie-section">
        <div class="chart-title">工作 / 休息 / 锁屏 占比</div>
        <div ref="pieChartRef" class="chart-container pie-container"></div>
        <div class="summary-row">
          <div class="summary-item">
            <span class="dot" :style="{ background: themeColors.work }"></span>
            <span class="label">工作</span>
            <span class="value">{{ workDurationStr }}</span>
          </div>
          <div class="summary-item">
            <span class="dot" :style="{ background: themeColors.rest }"></span>
            <span class="label">休息</span>
            <span class="value">{{ restDurationStr }}</span>
          </div>
          <div class="summary-item">
            <span class="dot" :style="{ background: themeColors.screen }"></span>
            <span class="label">锁屏</span>
            <span class="value">{{ screenDurationStr }}</span>
          </div>
        </div>
      </div>

      <div class="chart-section timeline-section">
        <div class="chart-title">24 小时状态时间轴</div>
        <div ref="timelineChartRef" class="chart-container timeline-container"></div>
      </div>
    </div>

    <el-empty v-if="noData" description="当天暂无番茄钟记录" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import moment from 'moment'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { getSqlData, pomodoroStatusTable, getStore } from '@/utils/common'
import { storeToRefs } from 'pinia'
import useThemeStore, { type ThemeName } from '@/store/useTheme'

const { currentTheme } = storeToRefs(useThemeStore())

// 获取配置的间隔时长（毫秒），用于截断超时段时长
function getConfiguredIntervalMs (type: string): number | null {
  if (type === 'work') {
    const gap = getStore('workTimeGap')
    const unit = getStore('workTimeGapUnit')
    if (gap != null && unit != null) return Number(gap) * Number(unit)
  } else if (type === 'rest') {
    const gap = getStore('restTimeGap')
    const unit = getStore('restTimeGapUnit')
    if (gap != null && unit != null) return Number(gap) * Number(unit)
  }
  return null
}

const curDate = ref(moment().format('YYYY-MM-DD'))
const noData = ref(false)

const isToday = computed(() => curDate.value === moment().format('YYYY-MM-DD'))

function prevDay () {
  curDate.value = moment(curDate.value).subtract(1, 'day').format('YYYY-MM-DD')
}

function nextDay () {
  if (!isToday.value) {
    curDate.value = moment(curDate.value).add(1, 'day').format('YYYY-MM-DD')
  }
}

function goToday () {
  curDate.value = moment().format('YYYY-MM-DD')
}

const pieChartRef = ref<HTMLElement>()
const timelineChartRef = ref<HTMLElement>()
let pieChart: echarts.ECharts | null = null
let timelineChart: echarts.ECharts | null = null
let pieObserver: ResizeObserver | null = null
let timelineObserver: ResizeObserver | null = null

const workDurationStr = ref('0 分钟')
const restDurationStr = ref('0 分钟')
const screenDurationStr = ref('0 分钟')

// 各主题专属图表配色方案
interface ChartThemeColors {
  work: string
  rest: string
  screen: string
  cardBg: string
  cardBorder: string
  pieBorder: string
  gridLine: string
  axisLabel: string
  labelColor: string
  tooltipBg: string
  tooltipText: string
  tooltipBorder: string
}

const THEME_COLORS: Record<ThemeName, ChartThemeColors> = {
  light: {
    work: '#6366f1',
    rest: '#22c55e',
    screen: '#9ca3af',
    cardBg: '#ffffff',
    cardBorder: '#e4e7ed',
    pieBorder: '#ffffff',
    gridLine: '#e5e7eb',
    axisLabel: '#6b7280',
    labelColor: '#374151',
    tooltipBg: '#ffffff',
    tooltipText: '#1f2937',
    tooltipBorder: '#e5e7eb',
  },
  dark: {
    work: '#7aa2f7',
    rest: '#9ece6a',
    screen: '#565f89',
    cardBg: '#24283b',
    cardBorder: '#3b4261',
    pieBorder: '#24283b',
    gridLine: '#3b4261',
    axisLabel: '#9aa5ce',
    labelColor: '#c0caf5',
    tooltipBg: '#1a1b26',
    tooltipText: '#c0caf5',
    tooltipBorder: '#3b4261',
  },
  midnight: {
    work: '#539bf5',
    rest: '#57ab5a',
    screen: '#636e7b',
    cardBg: '#22272e',
    cardBorder: '#373e47',
    pieBorder: '#22272e',
    gridLine: '#373e47',
    axisLabel: '#768390',
    labelColor: '#adbac7',
    tooltipBg: '#1c2128',
    tooltipText: '#adbac7',
    tooltipBorder: '#373e47',
  },
  nord: {
    work: '#88c0d0',
    rest: '#a3be8c',
    screen: '#4c566a',
    cardBg: '#3b4252',
    cardBorder: '#434c5e',
    pieBorder: '#3b4252',
    gridLine: '#434c5e',
    axisLabel: '#d8dee9',
    labelColor: '#eceff4',
    tooltipBg: '#2e3440',
    tooltipText: '#eceff4',
    tooltipBorder: '#434c5e',
  },
  'one-dark': {
    work: '#e06c75',
    rest: '#98c379',
    screen: '#5c6370',
    cardBg: '#3e4451',
    cardBorder: '#4b5263',
    pieBorder: '#3e4451',
    gridLine: '#4b5263',
    axisLabel: '#5c6370',
    labelColor: '#abb2bf',
    tooltipBg: '#282c34',
    tooltipText: '#abb2bf',
    tooltipBorder: '#4b5263',
  },
  dracula: {
    work: '#ff79c6',
    rest: '#50fa7b',
    screen: '#6272a4',
    cardBg: '#44475a',
    cardBorder: '#6272a4',
    pieBorder: '#44475a',
    gridLine: '#6272a4',
    axisLabel: '#bd93f9',
    labelColor: '#f8f8f2',
    tooltipBg: '#282a36',
    tooltipText: '#f8f8f2',
    tooltipBorder: '#6272a4',
  },
  'github-dark': {
    work: '#58a6ff',
    rest: '#3fb950',
    screen: '#8b949e',
    cardBg: '#21262d',
    cardBorder: '#30363d',
    pieBorder: '#21262d',
    gridLine: '#30363d',
    axisLabel: '#8b949e',
    labelColor: '#e6edf3',
    tooltipBg: '#161b22',
    tooltipText: '#e6edf3',
    tooltipBorder: '#30363d',
  },
  'tokyo-night': {
    work: '#7aa2f7',
    rest: '#9ece6a',
    screen: '#565f89',
    cardBg: '#24283b',
    cardBorder: '#3b4261',
    pieBorder: '#24283b',
    gridLine: '#3b4261',
    axisLabel: '#a9b1d6',
    labelColor: '#c0caf5',
    tooltipBg: '#1a1b26',
    tooltipText: '#c0caf5',
    tooltipBorder: '#3b4261',
  },
  solarized: {
    work: '#2aa198',
    rest: '#859900',
    screen: '#586e75',
    cardBg: '#002b36',
    cardBorder: '#465457',
    pieBorder: '#002b36',
    gridLine: '#465457',
    axisLabel: '#586e75',
    labelColor: '#839496',
    tooltipBg: '#073642',
    tooltipText: '#839496',
    tooltipBorder: '#465457',
  },
  gruvbox: {
    work: '#fb4934',
    rest: '#98971a',
    screen: '#665c54',
    cardBg: '#3c3836',
    cardBorder: '#665c54',
    pieBorder: '#3c3836',
    gridLine: '#665c54',
    axisLabel: '#a89984',
    labelColor: '#ebdbb2',
    tooltipBg: '#282828',
    tooltipText: '#ebdbb2',
    tooltipBorder: '#665c54',
  },
}

const themeColors = computed(() => THEME_COLORS[currentTheme.value] || THEME_COLORS.light)

const TYPE_LABEL_MAP: Record<string, string> = {
  work: '工作',
  rest: '休息',
  screen: '锁屏',
}

// 动态颜色 Map，随主题切换
const typeColorMap = computed<Record<string, string>>(() => ({
  work: themeColors.value.work,
  rest: themeColors.value.rest,
  screen: themeColors.value.screen,
}))

function formatDuration (minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0 && m > 0) return `${h} 小时 ${m} 分钟`
  if (h > 0) return `${h} 小时`
  return `${m} 分钟`
}

function processSegments (data: any[]) {
  if (!data || data.length === 0) return []

  const sorted = [...data].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  )

  const dateStr = curDate.value
  const dayStart = moment(dateStr).startOf('day')
  const dayEnd = moment(dateStr).endOf('day')
  const now = moment()
  const isToday = dateStr === moment().format('YYYY-MM-DD')
  const endTime = isToday ? now : dayEnd

  const segments: { type: string; start: Date; end: Date; label: string }[] = []

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]
    const curTime = moment(cur.dateTime)
    const nextTime = i + 1 < sorted.length ? moment(sorted[i + 1].dateTime) : endTime

    const segStart = curTime.isBefore(dayStart) ? dayStart.toDate() : curTime.toDate()

    // 计算该段结束时间：取 nextTime 与 dayEnd 中较小者
    let segEndMoment = nextTime.isAfter(dayEnd) ? dayEnd : nextTime

    // 若配置了该类型的间隔时长，且实际时长超过间隔，则截断到间隔时长
    // 避免因隔天/应用关闭导致时段无限延伸
    const intervalMs = getConfiguredIntervalMs(cur.value)
    if (intervalMs != null) {
      const cappedEnd = moment(curTime).add(intervalMs, 'milliseconds')
      if (segEndMoment.isAfter(cappedEnd)) {
        segEndMoment = cappedEnd
      }
    }

    const segEnd = segEndMoment.toDate()

    if (segStart >= segEnd) continue

    segments.push({
      type: cur.value,
      start: segStart,
      end: segEnd,
      label: cur.label,
    })
  }

  return segments
}

function calcDurations (segments: { type: string; start: Date; end: Date }[]) {
  let workMin = 0
  let restMin = 0
  let screenMin = 0
  segments.forEach((seg) => {
    const diff = (seg.end.getTime() - seg.start.getTime()) / 1000 / 60
    if (seg.type === 'work') workMin += diff
    else if (seg.type === 'rest') restMin += diff
    else if (seg.type === 'screen') screenMin += diff
  })
  return { workMin, restMin, screenMin }
}

function renderPieChart (workMin: number, restMin: number, screenMin: number) {
  if (!pieChartRef.value) return
  if (!pieChart) {
    pieChart = echarts.init(pieChartRef.value)
  }

  const total = workMin + restMin
  if (total === 0) {
    pieChart.clear()
    // pieChart.setOption({
    //   title: {
    //     text: '暂无数据',
    //     left: 'center',
    //     top: 'center',
    //     textStyle: { color: '#999', fontSize: 14, fontWeight: 'normal' },
    //   },
    // })
    return
  }

  const tc = themeColors.value
  const pieData = [
    { value: Math.round(workMin), name: '工作', durationStr: formatDuration(workMin), itemStyle: { color: tc.work } },
    { value: Math.round(restMin), name: '休息', durationStr: formatDuration(restMin), itemStyle: { color: tc.rest } },
    { value: Math.round(screenMin), name: '锁屏', durationStr: formatDuration(screenMin), itemStyle: { color: tc.screen } },
  ].filter(d => d.value > 0)

  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: tc.tooltipBg,
      borderColor: tc.tooltipBorder,
      textStyle: { color: tc.tooltipText },
      formatter: (params: any) => {
        return `${params.name}<br/>时长：${params.data.durationStr}<br/>占比：${params.percent}%`
      },
    },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: tc.pieBorder,
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 13,
          color: tc.labelColor,
        },
        data: pieData,
      },
    ],
  })
}

function renderTimelineChart (segments: { type: string; start: Date; end: Date; label: string }[]) {
  if (!timelineChartRef.value) return
  if (!timelineChart) {
    timelineChart = echarts.init(timelineChartRef.value)
  }

  if (segments.length === 0) {
    timelineChart.clear()
    // timelineChart.setOption({
    //   title: {
    //     text: '暂无数据',
    //     left: 'center',
    //     top: 'center',
    //     textStyle: { color: '#999', fontSize: 14, fontWeight: 'normal' },
    //   },
    // })
    return
  }

  const tc = themeColors.value
  const data = segments.map((seg) => ({
    value: [0, seg.start.getTime(), seg.end.getTime(), seg.type],
    itemStyle: {
      color: typeColorMap.value[seg.type] || tc.screen,
      borderRadius: 3,
    },
    name: seg.label,
  }))

  timelineChart.setOption({
    tooltip: {
      backgroundColor: tc.tooltipBg,
      borderColor: tc.tooltipBorder,
      textStyle: { color: tc.tooltipText },
      formatter: (params: any) => {
        const start = moment(params.value[1]).format('HH:mm:ss')
        const end = moment(params.value[2]).format('HH:mm:ss')
        const durMin = (params.value[2] - params.value[1]) / 1000 / 60
        const type = TYPE_LABEL_MAP[params.value[3]] || params.value[3]
        return `${type}<br/>${start} - ${end}<br/>时长：${formatDuration(durMin)}`
      },
    },
    grid: {
      left: 60,
      right: 30,
      top: 20,
      bottom: 70,
    },
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 0,
        start: 37.5,
        end: 75,
        height: 20,
        bottom: 10,
        borderColor: '#d9d9d9',
        fillerColor: 'rgba(64,158,255,0.15)',
        handleStyle: { color: '#409EFF' },
        textStyle: { fontSize: 11 },
        labelFormatter: (val: number) => moment(val).format('HH:mm'),
      },
      {
        type: 'inside',
        xAxisIndex: 0,
        start: 37.5,
        end: 75,
      },
    ],
    xAxis: {
      type: 'time',
      min: moment(curDate.value).startOf('day').valueOf(),
      max: moment(curDate.value).endOf('day').valueOf(),
      splitLine: {
        show: true,
        lineStyle: { type: 'dashed', color: tc.gridLine },
      },
      axisLabel: {
        formatter: (val: number) => moment(val).format('HH:mm'),
        color: tc.axisLabel,
      },
    },
    yAxis: {
      type: 'category',
      data: ['状态'],
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'custom',
        renderItem: (_params: any, api: any) => {
          const catIdx = api.value(0)
          const startTime = api.coord([api.value(1), catIdx])
          const endTime = api.coord([api.value(2), catIdx])
          // 动态计算方块高度：取y轴类别带宽度的60%，随容器高度自适应
          const bandHeight = api.size([0, 1])[1]
          const barHeight = Math.max(bandHeight * 0.6, 20)
          const start = startTime[0]
          const end = endTime[0]
          const width = Math.max(end - start, 2)

          return {
            type: 'rect',
            shape: {
              x: start,
              y: startTime[1] - barHeight / 2,
              width: width,
              height: barHeight,
              r: 3,
            },
            style: {
              ...api.style(),
              fill: api.visual('color'),
            },
            styleEmphasis: {
              stroke: '#333',
              lineWidth: 2,
            },
          }
        },
        encode: {
          x: [1, 2],
          y: 0,
        },
        data: data,
      },
    ],
  })
}

function setupObservers () {
  if (pieChartRef.value) {
    pieObserver = new ResizeObserver(() => {
      pieChart?.resize()
    })
    pieObserver.observe(pieChartRef.value)
  }
  if (timelineChartRef.value) {
    timelineObserver = new ResizeObserver(() => {
      timelineChart?.resize()
    })
    timelineObserver.observe(timelineChartRef.value)
  }
}

function handleResize () {
  pieChart?.resize()
  timelineChart?.resize()
}

watch(currentTheme, async () => {
  await nextTick()
  // 主题切换时重新渲染图表（应用新配色）
  if (lastWorkMin !== null) {
    renderPieChart(lastWorkMin, lastRestMin, lastScreenMin)
    renderTimelineChart(lastSegments)
  }
})

// 缓存最后一次渲染数据，用于主题切换时重绘
let lastWorkMin: number | null = null
let lastRestMin = 0
let lastScreenMin = 0
let lastSegments: any[] = []

async function loadData () {
  const val = curDate.value
  if (!val) return

  const res = await getSqlData({
    tableName: pomodoroStatusTable,
    conditions: { date: val },
  })

  const getData = res?.data || []
  noData.value = getData.length === 0

  if (getData.length === 0) {
    workDurationStr.value = '0 分钟'
    restDurationStr.value = '0 分钟'
    screenDurationStr.value = '0 分钟'
    renderPieChart(0, 0, 0)
    renderTimelineChart([])
    return
  }

  const segments = processSegments(getData)
  const { workMin, restMin, screenMin } = calcDurations(segments)

  // 缓存渲染数据
  lastWorkMin = workMin
  lastRestMin = restMin
  lastScreenMin = screenMin
  lastSegments = segments

  workDurationStr.value = formatDuration(workMin)
  restDurationStr.value = formatDuration(restMin)
  screenDurationStr.value = formatDuration(screenMin)

  await nextTick()
  renderPieChart(workMin, restMin, screenMin)
  renderTimelineChart(segments)
}

watch(curDate, () => {
  loadData()
}, { immediate: true })

onMounted(() => {
  setupObservers()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  pieObserver?.disconnect()
  timelineObserver?.disconnect()
  window.removeEventListener('resize', handleResize)
  pieChart?.dispose()
  timelineChart?.dispose()
})
</script>

<style scoped lang="scss">
.pomodoro-charts {
  padding: 12px 0;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

.charts-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.charts-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chart-section {
  background: var(--el-bg-color-overlay, #fff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
  padding: 16px;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary, #303133);
}

.chart-container {
  width: 100%;
}

.pie-container {
  height: 260px;
}

.timeline-container {
  height: 200px;
}

.summary-row {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 8px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .label {
    color: var(--el-text-color-regular, #606266);
  }

  .value {
    font-weight: 600;
    color: var(--el-text-color-primary, #303133);
  }
}
</style>
