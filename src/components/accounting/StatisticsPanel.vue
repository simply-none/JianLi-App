<!--
 * 记账 - 统计面板（完整页与小窗口「统计」Tab 共用）
 * 功能：按 日/月/年 范围展示 收入/支出/结余 汇总卡片、收入分类占比饼图 + 支出分类占比饼图（左右两块）、
 *       分类收支柱状图（横坐标为全部分类含收入/支出，纵坐标为金额，金额为 0 的分类也展示）。
 * 数据来自 store.records，使用 ECharts 渲染（复用项目既有的 echarts.init + ResizeObserver 模式）。
 * 主题跟随：图表配色取自 @/utils/chartTheme（按系统主题切换），卡片/文字等 DOM 走 Element Plus 的 --el-* 变量。
 * compact 模式（小窗口，约 360px 宽）：收紧卡片间距与图表高度。
-->
<template>
  <div class="statistics-panel" :class="{ compact }">
    <!-- 统计范围：日 / 月 / 年（三个按钮，点击弹出 el-popover，内含 el-date-picker-panel 裸面板） -->
    <div class="stat-header">
      <span class="stat-title">
        <LucideIcon name="TrendingUp" :size="16" />
        统计
      </span>
      <div class="range-controls">
        <div class="range-nav">
          <el-button class="nav-btn" size="small" @click="shiftRange(-1)">
            <LucideIcon name="ArrowLeft" :size="14" />
          </el-button>
          <span class="range-label">{{ rangeLabel }}</span>
          <el-button class="nav-btn" size="small" @click="shiftRange(1)">
            <LucideIcon name="ArrowRight" :size="14" />
          </el-button>
        </div>
        <div class="range-btns">
          <el-popover v-model:visible="dayPop" placement="left" :offset="108"  trigger="click" popper-class="range-popover">
            <template #reference>
              <el-button :type="rangeMode === 'day' ? 'primary' : 'default'" size="small" @click="rangeMode = 'day'">日</el-button>
            </template>
            <el-date-picker-panel v-model="rangeDay" type="date" value-format="YYYY-MM-DD" @update:model-value="onDayPick" />
          </el-popover>

          <el-popover v-model:visible="monthPop" placement="left" :offset="108"  trigger="click" popper-class="range-popover">
            <template #reference>
              <el-button :type="rangeMode === 'month' ? 'primary' : 'default'" size="small" @click="rangeMode = 'month'">月</el-button>
            </template>
            <el-date-picker-panel v-model="rangeMonth" type="month" value-format="YYYY-MM" @update:model-value="onMonthPick" />
          </el-popover>

          <el-popover v-model:visible="yearPop" placement="left" :offset="108"  trigger="click" popper-class="range-popover">
            <template #reference>
              <el-button :type="rangeMode === 'year' ? 'primary' : 'default'" size="small" @click="rangeMode = 'year'">年</el-button>
            </template>
            <el-date-picker-panel v-model="rangeYear" type="year" value-format="YYYY" @update:model-value="onYearPick" />
          </el-popover>
        </div>
      </div>
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

    <!-- 饼图：收入分类占比 + 支出分类占比（左右两块，flex 间隔） -->
    <div class="chart-row pie-row">
      <div class="chart-block">
        <div class="chart-block-title">收入分类占比</div>
        <div ref="incomePieRef" class="chart-box pie-box"></div>
      </div>
      <div class="chart-block">
        <div class="chart-block-title">支出分类占比</div>
        <div ref="expensePieRef" class="chart-box pie-box"></div>
      </div>
    </div>

    <!-- 柱状图：分类收支（横坐标=分类含收入/支出，纵坐标=金额） -->
    <div class="chart-block">
      <div class="chart-block-title">分类收支</div>
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
import { THEME_COLORS } from '@/utils/chartTheme'
import type { AccountingRecord, AccountingType } from '@/constants/accounting'

// ECharts 非 passive 滚轮监听告警兜底（与项目其它图表一致）
installPassiveScrollListeners()

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const store = useAccounting()
const { records } = storeToRefs(store)
const { categories } = storeToRefs(store)
const { currentTheme } = storeToRefs(useThemeStore())

// ============ 统计范围：日 / 月 / 年 ============
const rangeMode = ref<'day' | 'month' | 'year'>('month')
const rangeDay = ref(todayStr())
const rangeMonth = ref(currentMonth())
const rangeYear = ref(String(new Date().getFullYear()))

/** 三个 popover 的可见态：点按钮弹出，内含 el-date-picker-panel 裸面板（无输入框外壳） */
const dayPop = ref(false)
const monthPop = ref(false)
const yearPop = ref(false)

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 当前选中范围的值（日=YYYY-MM-DD / 月=YYYY-MM / 年=YYYY） */
const rangeValue = computed(() =>
  rangeMode.value === 'day' ? rangeDay.value : rangeMode.value === 'month' ? rangeMonth.value : rangeYear.value,
)

/** 用于过滤记录的时间前缀（年需补 "-"，使 record_date 形如 YYYY-MM-DD 能被正确前缀匹配） */
const rangePrefix = computed(() => (rangeMode.value === 'year' ? rangeYear.value + '-' : rangeValue.value))

/** 当前选中范围的展示文案 */
const rangeLabel = computed(() => {
  if (rangeMode.value === 'day') return rangeDay.value
  if (rangeMode.value === 'month') return rangeMonth.value
  return rangeYear.value + ' 年'
})

/** 在 popover 内选完日期：v-model 已更新对应 range 值，这里锁定模式并收起弹窗 */
function onDayPick() {
  rangeMode.value = 'day'
  dayPop.value = false
}
function onMonthPick() {
  rangeMode.value = 'month'
  monthPop.value = false
}
function onYearPick() {
  rangeMode.value = 'year'
  yearPop.value = false
}

/** 上一年/月/日 或 下一 年/月/日（按当前 rangeMode 切换；箭头按钮用） */
function shiftRange(dir: number) {
  if (rangeMode.value === 'day') {
    const [y, m, d] = rangeDay.value.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + dir)
    rangeDay.value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  } else if (rangeMode.value === 'month') {
    const [y, m] = rangeMonth.value.split('-').map(Number)
    const dt = new Date(y, m - 1 + dir, 1)
    rangeMonth.value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
  } else {
    rangeYear.value = String(Number(rangeYear.value) + dir)
  }
}

function money(n: number) {
  return '¥' + (Number(n) || 0).toFixed(2)
}

/** 当前主题配色（图表用，随系统主题切换） */
const themeColors = computed(() => THEME_COLORS[currentTheme.value] || THEME_COLORS.light)

/** 选中范围内的记录 */
const rangeRecords = computed(() =>
  records.value.filter((r) => r.record_date && r.record_date.startsWith(rangePrefix.value)),
)

/** 汇总 */
const summary = computed(() => {
  let income = 0
  let expense = 0
  for (const r of rangeRecords.value) {
    if (r.type === 'income') income += Number(r.amount) || 0
    else expense += Number(r.amount) || 0
  }
  return { income, expense, balance: income - expense }
})

/** 收入按分类汇总（饼图数据） */
const incomeByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const r of rangeRecords.value) {
    if (r.type !== 'income') continue
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

/** 支出按分类汇总（饼图数据） */
const expenseByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const r of rangeRecords.value) {
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

/** 分类收支汇总（柱状图数据）：基于全部分类配置，聚合当月金额（无记录的归 0），按金额降序 */
const byCategory = computed(() => {
  const sumMap = new Map<string, number>()
  for (const r of rangeRecords.value) {
    sumMap.set(r.category, (sumMap.get(r.category) || 0) + (Number(r.amount) || 0))
  }
  const arr: { name: string; type: AccountingType; value: number; color: string }[] = categories.value.map((c) => ({
    name: c.name,
    type: c.type,
    value: Number((sumMap.get(c.name) || 0).toFixed(2)),
    color: catColor(c.name),
  }))
  return arr.sort((a, b) => b.value - a.value)
})

function catColor(name: string) {
  return categories.value.find((c) => c.name === name)?.color || '#909399'
}

// ============ ECharts ============
const incomePieRef = ref<HTMLElement>()
const expensePieRef = ref<HTMLElement>()
const barRef = ref<HTMLElement>()
let incomePieChart: echarts.ECharts | null = null
let expensePieChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null
let incomePieObserver: ResizeObserver | null = null
let expensePieObserver: ResizeObserver | null = null
let barObserver: ResizeObserver | null = null

/** 饼图统一 option（收入/支出共用，配色随主题） */
function pieOption(data: { name: string; value: number; itemStyle: { color: string } }[]) {
  const tc = themeColors.value
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: tc.tooltipBg,
      borderColor: tc.tooltipBorder,
      textStyle: { color: tc.tooltipText },
      formatter: (p: any) => `${p.name}<br/>${money(p.value)} (${p.percent}%)`,
    },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: tc.pieBorder, borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 12, color: tc.labelColor },
        data,
      },
    ],
  }
}

function renderIncomePie() {
  if (!incomePieRef.value) return
  if (!incomePieChart) incomePieChart = echarts.init(incomePieRef.value)
  const data = incomeByCategory.value
  if (data.length === 0) {
    incomePieChart.clear()
    return
  }
  incomePieChart.setOption(pieOption(data))
}

function renderExpensePie() {
  if (!expensePieRef.value) return
  if (!expensePieChart) expensePieChart = echarts.init(expensePieRef.value)
  const data = expenseByCategory.value
  if (data.length === 0) {
    expensePieChart.clear()
    return
  }
  expensePieChart.setOption(pieOption(data))
}

/** 分类收支柱状图：横坐标=分类（含收入/支出），纵坐标=金额，按分类主题色着色 */
function renderBar() {
  if (!barRef.value) return
  if (!barChart) barChart = echarts.init(barRef.value)
  const arr = byCategory.value
  if (arr.length === 0) {
    barChart.clear()
    return
  }
  const tc = themeColors.value
  const incTotal = arr.filter((c) => c.type === 'income').reduce((s, c) => s + c.value, 0)
  const expTotal = arr.filter((c) => c.type === 'expense').reduce((s, c) => s + c.value, 0)
  barChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: tc.tooltipBg,
      borderColor: tc.tooltipBorder,
      textStyle: { color: tc.tooltipText },
      formatter: (ps: any) => {
        const d = ps[0].data
        const total = d._type === 'income' ? incTotal : expTotal
        const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'
        const tag = d._type === 'income' ? '收入' : '支出'
        return `${d._name}（${tag}）<br/>${money(d.value)}（占${tag} ${pct}%）`
      },
    },
    grid: { left: 50, right: 16, top: 24, bottom: 64 },
    xAxis: {
      type: 'category',
      data: arr.map((c) => c.name),
      axisLabel: { color: tc.axisLabel, fontSize: 10, interval: 0, rotate: 38 },
      axisLine: { lineStyle: { color: tc.axisLabel } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: tc.axisLabel, fontSize: 10 },
      splitLine: { lineStyle: { color: tc.gridLine } },
    },
    series: [
      {
        type: 'bar',
        barWidth: '58%',
        data: arr.map((c) => ({
          value: c.value,
          _name: c.name,
          _type: c.type,
          itemStyle: { color: c.color, borderRadius: [3, 3, 0, 0] },
        })),
        label: {
          show: true,
          position: 'top',
          color: tc.labelColor,
          fontSize: 10,
          formatter: (p: any) => (p.value > 0 ? money(p.value) : ''),
        },
      },
    ],
  })
}

function setupObservers() {
  if (incomePieRef.value) {
    incomePieObserver = new ResizeObserver(() => incomePieChart?.resize())
    incomePieObserver.observe(incomePieRef.value)
  }
  if (expensePieRef.value) {
    expensePieObserver = new ResizeObserver(() => expensePieChart?.resize())
    expensePieObserver.observe(expensePieRef.value)
  }
  if (barRef.value) {
    barObserver = new ResizeObserver(() => barChart?.resize())
    barObserver.observe(barRef.value)
  }
}

watch([rangeMode, rangeDay, rangeMonth, rangeYear, records, currentTheme], async () => {
  await nextTick()
  renderIncomePie()
  renderExpensePie()
  renderBar()
})

onMounted(() => {
  setupObservers()
  nextTick(() => {
    renderIncomePie()
    renderExpensePie()
    renderBar()
  })
})

onBeforeUnmount(() => {
  incomePieObserver?.disconnect()
  expensePieObserver?.disconnect()
  barObserver?.disconnect()
  incomePieChart?.dispose()
  expensePieChart?.dispose()
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
      color: var(--el-text-color-primary, #303133);
    }

    .range-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;

      .range-label {
        font-size: 12px;
        color: var(--el-text-color-secondary, #909399);
        font-variant-numeric: tabular-nums;
      }
      // 上一/下一范围箭头（夹在 range-label 两侧）
      .range-nav {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .nav-btn {
        width: 26px;
        padding: 0;
      }
      .range-btns {
        display: flex;
        align-items: center;
        gap: 6px;
      }
    }
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;

    .sum-card {
      padding: 12px;
      border-radius: 10px;
      background: var(--el-bg-color-overlay, #fff);
      border: 1px solid var(--el-border-color-lighter, #e4e7ed);

      .sum-label {
        font-size: 12px;
        color: var(--el-text-color-secondary, #909399);
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
        color: var(--el-text-color-primary, #303133);
      }
    }
  }

  // 饼图两块并排（收入/支出分类占比）
  .chart-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .chart-block {
    flex: 1 1 0;
    min-width: 0;
    background: var(--el-bg-color-overlay, #fff);
    border: 1px solid var(--el-border-color-lighter, #e4e7ed);
    border-radius: 10px;
    padding: 10px 12px;

    .chart-block-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary, #303133);
      margin-bottom: 6px;
    }
    .chart-box {
      width: 100%;
    }
    .pie-box {
      height: 220px;
    }
    .bar-box {
      height: 260px;
    }
  }

  // ============ compact（小窗口「统计」Tab） ============
  &.compact {
    gap: 10px;

    .stat-header .stat-title {
      font-size: 13px;
    }

    .range-controls {
      gap: 6px;

      .range-label {
        font-size: 11px;
      }
      .nav-btn {
        width: 24px;
      }
      .range-btns .el-button {
        padding: 5px 9px;
      }
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

    .chart-row {
      gap: 8px;
    }

    .chart-block {
      padding: 8px 10px;

      .chart-block-title {
        font-size: 12px;
      }
      .pie-box {
        height: 160px;
      }
      .bar-box {
        height: 200px;
      }
    }
  }
}
</style>

<!-- el-popover 内容被 teleport 到 body，scoped 样式无法命中，故用非作用域样式 -->
<style lang="scss">
// 统计范围日期面板弹窗：去掉默认内边距，让 el-date-picker-panel 裸面板贴合包裹、不留白边
.range-popover.el-popover {
  padding: 0;
  border-radius: 6px;
}
</style>
