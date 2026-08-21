<!--
 * 记账 - 统计面板（完整页与小窗口「统计」Tab 共用）
 * 功能：按月份展示 收入/支出/结余 汇总卡片、支出分类占比饼图、每日收支柱状图。
 * 数据来自 store.records，使用 ECharts 渲染（复用项目既有的 echarts.init + ResizeObserver 模式）。
 * compact 模式（小窗口，约 360px 宽）：收紧卡片间距与图表高度。
-->
<template>
  <div class="statistics-panel" :class="{ compact }">
    <!-- 月份选择 -->
    <div class="stat-header">
      <span class="stat-title">
        <LucideIcon name="TrendingUp" :size="16" />
        统计
      </span>
      <el-date-picker
        v-model="month"
        type="month"
        value-format="YYYY-MM"
        format="YYYY-MM"
        placeholder="选择月份"
        size="small"
        style="width: 130px"
      />
    </div>

    <!-- 汇总卡片 -->
    <div class="summary-cards">
      <div class="sum-card income">
        <div class="sum-label">收入</div>
        <div class="sum-value">{{ money(summary.income) }}</div>
      </div>
      <div class="sum-card expense">
        <div class="sum-label">支出</div>
        <div class="sum-value">{{ money(summary.expense) }}</div>
      </div>
      <div class="sum-card balance">
        <div class="sum-label">结余</div>
        <div class="sum-value">{{ money(summary.balance) }}</div>
      </div>
    </div>

    <!-- 饼图：分类占比 -->
    <div class="chart-block">
      <div class="chart-block-title">支出分类占比</div>
      <div ref="pieRef" class="chart-box pie-box"></div>
    </div>

    <!-- 柱状图：每日收支 -->
    <div class="chart-block">
      <div class="chart-block-title">每日收支</div>
      <div ref="barRef" class="chart-box bar-box"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import LucideIcon from '@/components/LucideIcon.vue'
import useAccounting from '@/store/useAccounting'
import useThemeStore from '@/store/useTheme'
import { installPassiveScrollListeners } from '@/utils/passiveEvents'
import type { AccountingRecord } from '@/constants/accounting'

// ECharts 非 passive 滚轮监听告警兜底（与项目其它图表一致）
installPassiveScrollListeners()

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const store = useAccounting()
const { records } = storeToRefs(store)
const { categories } = storeToRefs(store)
const { currentTheme } = storeToRefs(useThemeStore())

const month = ref(currentMonth())

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function money(n: number) {
  return '¥' + (Number(n) || 0).toFixed(2)
}

/** 当月记录 */
const monthRecords = computed(() =>
  records.value.filter((r) => r.record_date && r.record_date.startsWith(month.value)),
)

/** 汇总 */
const summary = computed(() => {
  let income = 0
  let expense = 0
  for (const r of monthRecords.value) {
    if (r.type === 'income') income += Number(r.amount) || 0
    else expense += Number(r.amount) || 0
  }
  return { income, expense, balance: income - expense }
})

/** 支出按分类汇总（饼图数据） */
const expenseByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const r of monthRecords.value) {
    if (r.type !== 'expense') continue
    map.set(r.category, (map.get(r.category) || 0) + (Number(r.amount) || 0))
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
      itemStyle: { color: catColor(name) },
    }))
    .sort((a, b) => b.value - a.value)
})

/** 每日收支（柱状图数据） */
const daily = computed(() => {
  const inc = new Map<string, number>()
  const exp = new Map<string, number>()
  for (const r of monthRecords.value) {
    const day = r.record_date.slice(5) // MM-DD
    if (r.type === 'income') inc.set(day, (inc.get(day) || 0) + (Number(r.amount) || 0))
    else exp.set(day, (exp.get(day) || 0) + (Number(r.amount) || 0))
  }
  const days = Array.from(new Set([...inc.keys(), ...exp.keys()])).sort()
  return {
    days,
    income: days.map((d) => Number((inc.get(d) || 0).toFixed(2))),
    expense: days.map((d) => Number((exp.get(d) || 0).toFixed(2))),
  }
})

function catColor(name: string) {
  return categories.value.find((c) => c.name === name)?.color || '#909399'
}

// ============ ECharts ============
const pieRef = ref<HTMLElement>()
const barRef = ref<HTMLElement>()
let pieChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null
let pieObserver: ResizeObserver | null = null
let barObserver: ResizeObserver | null = null

const isDark = computed(() => currentTheme.value && currentTheme.value !== 'light')
const axisColor = computed(() => (isDark.value ? '#a9a9a9' : '#909399'))
const labelColor = computed(() => (isDark.value ? '#e5e5e5' : '#303133'))

function renderPie() {
  if (!pieRef.value) return
  if (!pieChart) pieChart = echarts.init(pieRef.value)
  const data = expenseByCategory.value
  if (data.length === 0) {
    pieChart.clear()
    return
  }
  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}<br/>${money(p.value)} (${p.percent}%)`,
    },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: isDark.value ? '#1f1f1f' : '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 12, color: labelColor.value },
        data,
      },
    ],
  })
}

function renderBar() {
  if (!barRef.value) return
  if (!barChart) barChart = echarts.init(barRef.value)
  const d = daily.value
  if (d.days.length === 0) {
    barChart.clear()
    return
  }
  barChart.setOption({
    tooltip: { trigger: 'axis', formatter: (ps: any) => {
      let s = ps[0].axisValue + '<br/>'
      ps.forEach((p: any) => { s += `${p.seriesName}: ${money(p.value)}<br/>` })
      return s
    } },
    legend: { data: ['收入', '支出'], textStyle: { color: labelColor.value }, top: 0 },
    grid: { left: 50, right: 14, top: 30, bottom: 24 },
    xAxis: {
      type: 'category',
      data: d.days,
      axisLabel: { color: axisColor.value, fontSize: 10 },
      axisLine: { lineStyle: { color: axisColor.value } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: axisColor.value, fontSize: 10 },
      splitLine: { lineStyle: { color: isDark.value ? '#333' : '#eee' } },
    },
    series: [
      { name: '收入', type: 'bar', data: d.income, itemStyle: { color: '#67c23a', borderRadius: [3, 3, 0, 0] } },
      { name: '支出', type: 'bar', data: d.expense, itemStyle: { color: '#f56c6c', borderRadius: [3, 3, 0, 0] } },
    ],
  })
}

function setupObservers() {
  if (pieRef.value) {
    pieObserver = new ResizeObserver(() => pieChart?.resize())
    pieObserver.observe(pieRef.value)
  }
  if (barRef.value) {
    barObserver = new ResizeObserver(() => barChart?.resize())
    barObserver.observe(barRef.value)
  }
}

watch([month, records, currentTheme], async () => {
  await nextTick()
  renderPie()
  renderBar()
})

onMounted(() => {
  setupObservers()
  nextTick(() => {
    renderPie()
    renderBar()
  })
})

onBeforeUnmount(() => {
  pieObserver?.disconnect()
  barObserver?.disconnect()
  pieChart?.dispose()
  barChart?.dispose()
})

</script>

<style scoped lang="scss">
.statistics-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;

  .stat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .stat-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary, #303133);
    }
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;

    .sum-card {
      padding: 12px;
      border-radius: 10px;
      background: var(--bg-card, #fff);
      border: 1px solid var(--border-subtle, #e4e7ed);

      .sum-label {
        font-size: 12px;
        color: var(--text-muted, #999);
      }
      .sum-value {
        font-size: 18px;
        font-weight: 700;
        margin-top: 4px;
        font-variant-numeric: tabular-nums;
      }
      &.income .sum-value {
        color: #67c23a;
      }
      &.expense .sum-value {
        color: #f56c6c;
      }
      &.balance .sum-value {
        color: var(--text-primary, #303133);
      }
    }
  }

  .chart-block {
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 10px;
    padding: 10px 12px;

    .chart-block-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary, #606266);
      margin-bottom: 6px;
    }
    .chart-box {
      width: 100%;
    }
    .pie-box {
      height: 240px;
    }
    .bar-box {
      height: 220px;
    }
  }

  // ============ compact（小窗口「统计」Tab） ============
  &.compact {
    gap: 10px;

    .stat-header .stat-title {
      font-size: 13px;
    }

    .summary-cards {
      gap: 6px;

      .sum-card {
        padding: 8px;

        .sum-label {
          font-size: 11px;
        }
        .sum-value {
          font-size: 15px;
        }
      }
    }

    .chart-block {
      padding: 8px 10px;

      .chart-block-title {
        font-size: 12px;
      }
      .pie-box {
        height: 180px;
      }
      .bar-box {
        height: 170px;
      }
    }
  }
}
</style>
