<!--
 * 记账 - 共用页面（完整页与小窗口共用同一套排版）
 * 排版结构：el-tabs 两页
 *   ├─ Tab「记录列表」：上下结构
 *   │    上：记录列表（flex:1，内部滚动，header 带日/月/年范围筛选，与统计面板一致）
 *   │    中：今日汇总（紧贴记账条上方，记完一笔即时反馈）
 *   │    下：记账功能（可折叠横条，收起时为一条「+ 记一笔」按钮）
 *   └─ Tab「统计」：StatisticsPanel（首次切入时才渲染，避免 ECharts 在隐藏容器内初始化）
 * 注：compact 模式（小窗口）沿用同一 Tab 排版，仅收紧尺寸；并把「应用主题变量」
 *     重映射为皮肤变量（与主题对话页一致），使同一组件在小窗外壳内自动换肤。
-->
<template>
  <div class="accounting-page" :class="{ compact }">
    <el-tabs v-model="activeTab" class="ap-tabs">
      <!-- ===== Tab 1：记录列表（上：列表 / 下：记账） ===== -->
      <el-tab-pane label="记录列表" name="list">
        <div class="tab-list">
          <!-- 上：记录列表 -->
          <div class="list-card">
            <div class="list-header">
              <span class="lh-title">
                <LucideIcon name="ScrollText" :size="compact ? 14 : 16" />
                记录
              </span>
              <!-- 列表范围筛选：日 / 月 / 年（与统计面板一致的 popover + 裸面板） -->
              <div class="range-controls">
                <div class="range-nav" v-show="!showAll">
                  <el-button class="nav-btn" size="small" @click="shiftRange(-1)">
                    <LucideIcon name="ArrowLeft" :size="14" />
                  </el-button>
                  <!-- 面包屑：年 › 月 › 日，上层可点回退 -->
                  <span class="crumbs">
                    <template v-for="(c, i) in crumbs" :key="c.mode">
                      <span v-if="i > 0" class="crumb-sep">›</span>
                      <span
                        class="crumb"
                        :class="c.clickable ? 'link' : 'active'"
                        @click="c.clickable && goCrumb(c.mode, c.value)"
                      >{{ c.label }}</span>
                    </template>
                  </span>
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

                  <!-- 默认：展示所有日期记录（无范围筛选、无下钻）；点一次状态反转 -->
                  <el-button :type="showAll ? 'primary' : 'default'" size="small" @click="showAll = !showAll">默认</el-button>
                </div>
              </div>
            </div>
            <div class="list-body">
              <!-- 日模式 / 默认模式：展示全部明细（保留右键编辑/删除）；默认模式为所有日期 -->
              <RecordList
                v-if="showAll || rangeMode === 'day'"
                :records="listRecords"
                :limit="0"
                :compact="compact"
                empty-text="暂无记录，点下方「记一笔」开始"
                @edit="openEdit"
              />
              <!-- 年/月模式：聚合总览（按 月/日 分组，可点击下钻） -->
              <RecordSummaryList
                v-else
                :mode="rangeMode"
                :records="listRecords"
                :compact="compact"
                empty-text="该范围暂无记录"
                @drill="onDrill"
              />
            </div>
          </div>

          <!-- 中：今日汇总 -->
          <div class="today-bar" :class="{ compact }">
            <span class="tb-item">
              <i class="tb-dot expense" />
              今日支出
              <b class="expense">{{ money(todaySummary.expense) }}</b>
            </span>
            <span class="tb-item">
              <i class="tb-dot income" />
              今日收入
              <b class="income">{{ money(todaySummary.income) }}</b>
            </span>
          </div>

          <!-- 下：记账功能（可折叠横条） -->
          <div class="form-card" :class="{ compact, open: formOpen }">
            <button v-if="!formOpen" type="button" class="fold-bar" @click="setFormOpen(true)">
              <LucideIcon name="Plus" :size="15" />
              <span>记一笔</span>
            </button>
            <template v-else>
              <div class="form-head">
                <span class="fh-title">记一笔</span>
                <button type="button" class="fh-fold" title="收起" @click="setFormOpen(false)">
                  <LucideIcon name="ChevronDown" :size="14" />
                </button>
              </div>
              <RecordForm inline autofocus :compact="compact" @saved="onSaved" />
            </template>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== Tab 2：统计（lazy：首次切入才挂载，避免 ECharts 在隐藏容器内初始化） ===== -->
      <el-tab-pane label="统计" name="stat" lazy>
        <div class="tab-stat">
          <StatisticsPanel :compact="compact" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 编辑弹窗 -->
    <RecordEditDialog v-model="editVisible" :record="editTarget" @saved="onSaved" />

    <!-- 右上角设置：分类与关键字管理 -->
    <button type="button" class="settings-entry" :class="{ compact }" title="分类与关键字设置" @click="settingsVisible = true">
      <LucideIcon name="Settings" :size="compact ? 15 : 16" />
      <span v-if="!compact">设置</span>
    </button>
    <SettingsDrawer v-model="settingsVisible" :compact="compact" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import RecordForm from '@/components/accounting/RecordForm.vue'
import RecordList from '@/components/accounting/RecordList.vue'
import RecordSummaryList from '@/components/accounting/RecordSummaryList.vue'
import RecordEditDialog from '@/components/accounting/RecordEditDialog.vue'
import StatisticsPanel from '@/components/accounting/StatisticsPanel.vue'
import SettingsDrawer from '@/components/accounting/SettingsDrawer.vue'
import LucideIcon from '@/components/LucideIcon.vue'
import useAccounting from '@/store/useAccounting'
import type { AccountingRecord } from '@/constants/accounting'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const store = useAccounting()
const { records } = storeToRefs(store)

/** 当前 Tab */
const activeTab = ref<'list' | 'stat'>('list')

// —— 记账横条折叠状态（记住上次选择，避免高频记账时每次都要展开） ——
const FORM_OPEN_KEY = 'accounting:formOpen'
const formOpen = ref(localStorage.getItem(FORM_OPEN_KEY) === '1')
function setFormOpen(v: boolean) {
  formOpen.value = v
  localStorage.setItem(FORM_OPEN_KEY, v ? '1' : '0')
}

function money(n: number) {
  return '¥' + (Number(n) || 0).toFixed(2)
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayDate = todayStr()

/** 今日收支汇总 */
const todaySummary = computed(() => {
  let income = 0
  let expense = 0
  for (const r of records.value) {
    if (r.record_date !== todayDate) continue
    if (r.type === 'income') income += Number(r.amount) || 0
    else expense += Number(r.amount) || 0
  }
  return { income, expense }
})

// —— 列表范围筛选：日 / 月 / 年（与统计面板一致） ——
const rangeMode = ref<'day' | 'month' | 'year'>('month')
const rangeDay = ref(todayStr())
const rangeMonth = ref(currentMonth())
const rangeYear = ref(String(new Date().getFullYear()))
const dayPop = ref(false)
const monthPop = ref(false)
const yearPop = ref(false)
/** 默认模式：true 展示所有日期记录（无范围筛选、无下钻）；false 走日/月/年范围筛选；状态持久化到 localStorage */
const SHOW_ALL_KEY = 'accounting:showAll'
const showAll = ref(localStorage.getItem(SHOW_ALL_KEY) === '1')
watch(showAll, (v) => localStorage.setItem(SHOW_ALL_KEY, v ? '1' : '0'))

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 当前选中范围的值（日=YYYY-MM-DD / 月=YYYY-MM / 年=YYYY） */
const rangeValue = computed(() =>
  rangeMode.value === 'day' ? rangeDay.value : rangeMode.value === 'month' ? rangeMonth.value : rangeYear.value,
)
/** 用于过滤记录的时间前缀（年需补 "-" 以正确前缀匹配 YYYY-MM-DD） */
const rangePrefix = computed(() => (rangeMode.value === 'year' ? rangeYear.value + '-' : rangeValue.value))
/** 面包屑：展示 年 › 月 › 日 路径，当前层高亮、上层可点回退 */
const crumbs = computed(() => {
  const y = rangeYear.value
  const my = rangeMonth.value
  const dy = rangeDay.value
  const mm = my ? Number(my.slice(5, 7)) : 0
  const dd = dy ? Number(dy.slice(8, 10)) : 0
  const list: { label: string; mode: 'year' | 'month' | 'day'; value: string; clickable: boolean }[] = []
  list.push({ label: `${y}年`, mode: 'year', value: y, clickable: rangeMode.value !== 'year' })
  if (rangeMode.value === 'month' || rangeMode.value === 'day') {
    list.push({ label: `${mm}月`, mode: 'month', value: my, clickable: rangeMode.value !== 'month' })
  }
  if (rangeMode.value === 'day') {
    list.push({ label: `${dd}日`, mode: 'day', value: dy, clickable: false })
  }
  return list
})
/** 点击面包屑上层：回到对应模式并定位范围 */
function goCrumb(mode: 'year' | 'month' | 'day', value: string) {
  if (mode === 'year') {
    rangeMode.value = 'year'
  } else if (mode === 'month') {
    rangeMonth.value = value
    rangeMode.value = 'month'
    monthPop.value = false
  } else {
    rangeDay.value = value
    rangeMode.value = 'day'
    dayPop.value = false
  }
}
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

/** 聚合总览行点击下钻：年→月、月→日 */
function onDrill(nextMode: 'month' | 'day', value: string) {
  if (nextMode === 'month') {
    rangeMonth.value = value
    rangeMode.value = 'month'
    monthPop.value = false
  } else {
    rangeDay.value = value
    rangeMode.value = 'day'
    dayPop.value = false
  }
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

/** 按选中范围过滤后的记录；默认模式下展示全部记录 */
const listRecords = computed(() =>
  showAll.value
    ? records.value
    : records.value.filter((r) => (r.record_date || '').startsWith(rangePrefix.value)),
)

// —— 编辑 ——
const editVisible = ref(false)
const editTarget = ref<AccountingRecord | null>(null)
function openEdit(rec: AccountingRecord) {
  editTarget.value = rec
  editVisible.value = true
}
function onSaved() {
  // store 内部已刷新缓存；此处无需额外处理
}

// —— 设置抽屉（分类与关键字管理） ——
const settingsVisible = ref(false)
</script>

<style scoped lang="scss">
.accounting-page {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  background: var(--bg-base, #f5f7fa);
  overflow: hidden;

  // 右上角设置入口
  .settings-entry {
    position: absolute;
    top: 14px;
    right: 18px;
    z-index: 6;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 8px;
    background: var(--bg-card, #fff);
    color: var(--text-secondary, #606266);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
      background: var(--bg-hover, #f5f7fa);
      color: var(--color-primary, #409eff);
    }
  }

  // ===== Tab 容器：让内容区撑满并由列表自行滚动 =====
  .ap-tabs {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    :deep(.el-tabs__header) {
      margin: 0 0 10px;
    }
    // 内容区 overflow 必须可见，否则分类 Popover（teleported=false）会被裁剪
    :deep(.el-tabs__content) {
      flex: 1;
      min-height: 0;
      overflow: visible;
    }
    :deep(.el-tab-pane) {
      height: 100%;
    }
  }

  // ===== Tab 1：上下结构 =====
  .tab-list {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  // 上：记录列表
  .list-card {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 10px;
    overflow: hidden;

    .list-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-subtle, #e4e7ed);

      .lh-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #303133);
      }

      // 日/月/年 范围选择（与统计面板一致）
      .range-controls {
        display: flex;
        align-items: center;
        gap: 8px;

        .crumbs {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 12px;
          font-variant-numeric: tabular-nums;

          .crumb {
            padding: 2px 4px;
            border-radius: 5px;
            color: var(--text-secondary, #606266);

            &.link {
              cursor: pointer;
              &:hover {
                color: var(--color-primary, #409eff);
                background: var(--bg-hover, #f0f2f5);
              }
            }
            &.active {
              color: var(--text-primary, #303133);
              font-weight: 600;
            }
          }
          .crumb-sep {
            color: var(--text-muted, #c0c4cc);
          }
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

    .list-body {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 4px 8px;
    }
  }

  // 中：今日汇总
  .today-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 0 4px;
    font-size: 12px;
    color: var(--text-muted, #999);

    .tb-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .tb-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      &.expense {
        background: #f56c6c;
      }
      &.income {
        background: #67c23a;
      }
    }
    b {
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      &.expense {
        color: #f56c6c;
      }
      &.income {
        color: #67c23a;
      }
    }

    &.compact {
      gap: 12px;
      font-size: 11px;
      b {
        font-size: 12px;
      }
    }
  }

  // 下：记账横条（可折叠）
  .form-card {
    flex-shrink: 0;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 10px;

    // 收起态：一条按钮
    .fold-bar {
      width: 100%;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: none;
      background: transparent;
      border-radius: 10px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-primary, #409eff);
      transition: background 0.18s ease;

      &:hover {
        background: var(--bg-hover, #f5f7fa);
      }
    }

    // 展开态
    &.open {
      padding: 10px 12px 12px;
    }

    .form-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      .fh-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, #303133);
      }
      .fh-fold {
        display: inline-flex;
        align-items: center;
        border: none;
        background: transparent;
        padding: 2px;
        border-radius: 6px;
        cursor: pointer;
        color: var(--text-muted, #999);

        &:hover {
          background: var(--bg-hover, #f5f7fa);
          color: var(--text-primary, #303133);
        }
      }
    }

    &.compact {
      .fold-bar {
        height: 34px;
        font-size: 13px;
      }
      &.open {
        padding: 8px 10px 10px;
      }
    }
  }

  // ===== Tab 2：统计 =====
  .tab-stat {
    height: 100%;
    overflow: auto;
  }

  // ============ compact（小窗口） ============
  &.compact {
    padding: 8px 10px;

    /* 将应用主题变量重映射为皮肤变量，使内部组件在小窗内换肤 */
    --bg-base: var(--skin-bg);
    --bg-card: color-mix(in srgb, var(--skin-bg) 88%, var(--skin-text-primary) 12%);
    --bg-hover: var(--skin-btn-hover);
    --text-primary: var(--skin-text-primary);
    --text-secondary: var(--skin-text-secondary);
    --text-muted: color-mix(in srgb, var(--skin-text-secondary) 70%, var(--skin-bg) 30%);
    --color-primary: var(--skin-dot);
    --border-subtle: var(--skin-border);

    // Tab 头在小窗内换肤 + 收紧
    .ap-tabs {
      :deep(.el-tabs__header) {
        margin: 0 0 8px;
      }
      :deep(.el-tabs__nav-wrap::after) {
        background: var(--skin-border);
      }
      :deep(.el-tabs__item) {
        height: 32px;
        line-height: 32px;
        font-size: 13px;
        padding: 0 12px;
        color: var(--skin-text-secondary);

        &.is-active {
          color: var(--skin-text-primary);
        }
      }
      :deep(.el-tabs__active-bar) {
        background: var(--skin-dot);
      }
    }

    .list-card .list-header {
      padding: 8px 10px;
      .lh-title {
        font-size: 13px;
      }
      .range-controls {
        gap: 6px;
        .crumbs {
          font-size: 11px;
        }
        .nav-btn {
          width: 24px;
        }
      }
    }

    // 小窗内设置入口微调
    .settings-entry {
      top: 10px;
      right: 10px;
      height: 26px;
      padding: 0 8px;
    }
  }
}
</style>

<!-- el-popover 内容被 teleport 到 body，scoped 样式无法命中，故用非作用域样式 -->
<style lang="scss">
// 统计/列表范围日期面板弹窗：去掉默认内边距，让 el-date-picker-panel 裸面板贴合包裹、不留白边
.range-popover.el-popover {
  padding: 0;
  border-radius: 6px;
}
</style>
