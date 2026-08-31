<template>
  <div class="curve-card">
    <div class="curve-head">
      <h3 class="curve-title">组合收益曲线</h3>
      <div class="periods">
        <button
          v-for="p in periodOptions"
          :key="p.days"
          class="period-btn"
          :class="{ active: days === p.days }"
          @click="select(p.days)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div ref="chartRef" class="chart"></div>

    <p v-if="!loading && !dates.length" class="empty">暂无数据，请先在「持仓列表」添加标的并刷新行情</p>
    <p v-else-if="loading" class="empty">加载中…</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { useEarningStore } from '../store'

const store = useEarningStore()

/** 当年 1 月 1 日距今天数（用于「今年以来」） */
function ytdDays(): number {
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  return Math.max(1, Math.round((now.getTime() - jan1.getTime()) / 86_400_000))
}

const periodOptions = [
  { label: '近1月', days: 30 },
  { label: '近3月', days: 90 },
  { label: '近6月', days: 180 },
  { label: '近1年', days: 365 },
  { label: '今年以来', days: ytdDays() },
  { label: '全部', days: 3650 },
]

const days = ref(180)
const dates = ref<string[]>([])
const returns = ref<number[]>([])
const loading = ref(false)

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

async function load() {
  loading.value = true
  try {
    const r = await store.portfolioCurve(days.value)
    dates.value = r.dates
    returns.value = r.returns
    await nextTick()
    render()
  } catch (e) {
    console.error('加载收益曲线失败:', e)
  } finally {
    loading.value = false
  }
}

function select(d: number) {
  days.value = d
  load()
}

function themeColor(varName: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

function render() {
  if (!chartRef.value) return
  // 容器隐藏（0 宽）时不初始化，避免布局损坏
  if (chartRef.value.offsetWidth === 0 || chartRef.value.offsetHeight === 0) return
  if (chart) {
    chart.dispose()
    chart = null
  }
  chart = echarts.init(chartRef.value)
  const primary = themeColor('--color-primary', '#6366f1')
  chart.setOption(
    {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        confine: true,
        valueFormatter: (v: number) => `${Number(v).toFixed(2)}%`,
      },
      grid: { left: 52, right: 18, top: 18, bottom: 28 },
      xAxis: {
        type: 'category',
        data: dates.value,
        boundaryGap: false,
        axisLabel: { color: '#888', fontSize: 11 },
        axisLine: { lineStyle: { color: '#ccc' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#888', formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(136,136,136,0.12)' } },
      },
      series: [
        {
          name: '区间收益率',
          type: 'line',
          data: returns.value,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: primary },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: primary + '55' },
              { offset: 1, color: primary + '05' },
            ]),
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: 0 }],
            lineStyle: { color: '#999', type: 'dashed' },
            label: { show: false },
          },
        },
      ],
    },
    true,
  )
}

function resize() {
  chart?.resize()
}

onMounted(() => {
  load()
  window.addEventListener('resize', resize)
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      if (chartRef.value && chartRef.value.offsetWidth > 0) resize()
    })
    ro.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  ro?.disconnect()
  ro = null
  chart?.dispose()
  chart = null
})

// 持仓变化后刷新曲线
watch(
  () => store.holdings.value.length,
  () => load(),
)
</script>

<style scoped lang="scss">
.curve-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px 16px;

  .curve-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;

    .curve-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .periods {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;

      .period-btn {
        padding: 5px 12px;
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        background: transparent;
        color: var(--text-secondary);
        font-size: 0.8rem;
        cursor: pointer;

        &:hover {
          border-color: var(--color-primary);
          color: var(--text-primary);
        }
        &.active {
          background: color-mix(in srgb, var(--color-primary) 14%, transparent);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
      }
    }
  }

  .chart {
    width: 100%;
    height: 320px;
  }

  .empty {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    padding: 40px 0;
  }
}
</style>
