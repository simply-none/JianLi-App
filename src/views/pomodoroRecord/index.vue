<template>
  <div class="pomodoro-record">
    <div class="record-header">
      <h2 class="record-title">番茄钟记录</h2>
      <el-radio-group v-model="activeTab" size="small" class="tab-switch">
        <el-radio-button value="table">列表</el-radio-button>
        <el-radio-button value="charts">图表</el-radio-button>
      </el-radio-group>
    </div>

    <div v-show="activeTab === 'table'" class="list-view">
      <div class="date-selector">
        <span class="selector-label">选择日期</span>
        <el-date-picker 
          v-model="curDate" 
          value-format="YYYY-MM-DD" 
          type="date" 
          placeholder="选择日期"
          class="date-picker"
        ></el-date-picker>
        <div class="date-actions">
          <el-button size="small" type="danger" plain @click="deleteTodayData">删除今日数据</el-button>
          <el-button size="small" type="danger" plain @click="deleteAllDevData">删除开发数据</el-button>
        </div>
      </div>

      <div class="record-list" v-if="curDateData.length > 0">
        <div 
          v-for="(item, index) in processedData" 
          :key="index" 
          class="record-card"
        >
          <div class="card-left">
            <div class="status-dot" :style="{ background: getStatusColor(item.value) }"></div>
            <div class="timeline-line" v-if="index < curDateData.length - 1"></div>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="status-label" :style="{ color: getStatusColor(item.value) }">
                {{ item.label }}
              </span>
              <span class="duration-badge">{{ item.duration }}</span>
            </div>
            <div class="card-body">
              <span class="time-start">{{ item.startTime }}</span>
              <span class="time-separator"></span>
              <span class="time-end">{{ item.endTime }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <div class="empty-content">
          <div class="empty-circle"></div>
          <p class="empty-text">当天暂无番茄钟记录</p>
        </div>
      </div>
    </div>

    <ChartsView v-show="activeTab === 'charts'" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pomodoroStatusTable, getStore, setStore, deletePomodoroStatus } from '@/utils/common'
import moment from 'moment'
import ChartsView from './charts.vue'
import { getConfiguredIntervalMs } from './segment'

const POMODORO_TAB_KEY = 'pomodoroRecordActiveTab'
const savedTab = getStore(POMODORO_TAB_KEY)
const activeTab = ref(savedTab === 'charts' ? 'charts' : 'table')

watch(activeTab, (val) => {
  setStore(POMODORO_TAB_KEY, val)
})

const curDate = ref(moment().format('YYYY-MM-DD'))
const curDateData = ref<ObjectType[]>([])

// 重新加载当前日期的番茄钟记录（列表倒序：最新状态排在最前）
function reloadData() {
  const val = curDate.value
  if (!val) return
  window.ipcRenderer.handlePromise('new-sql:query', {
    tableName: pomodoroStatusTable,
    conditions: {
      date: val,
    }
  }).catch(() => ({ data: [] as ObjectType[] })).then(res => {
    let getData = (res as any)?.data || [] as ObjectType[]
    getData.sort((a: any, b: any) => {
      return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
    })
    curDateData.value = getData
  })
}

watch(curDate, () => {
  reloadData()
}, { immediate: true })

// 数据库操作：删除所有 mode 为 development 的记录
async function deleteAllDevData() {
  try {
    await ElMessageBox.confirm(
      '确定删除所有「开发环境（development）」的番茄钟记录吗？此操作不可恢复。',
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }
  const res = await deletePomodoroStatus({ mode: 'development' })
  if (res) {
    reloadData()
    ElMessage.success('已删除所有 development 记录')
  } else {
    ElMessage.error('删除失败')
  }
}

// 数据库操作：删除今日（当前日期）的记录
async function deleteTodayData() {
  const today = moment().format('YYYY-MM-DD')
  try {
    await ElMessageBox.confirm(
      `确定删除今日（${today}）的番茄钟记录吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }
  const res = await deletePomodoroStatus({ date: today })
  if (res) {
    reloadData()
    ElMessage.success('已删除今日记录')
  } else {
    ElMessage.error('删除失败')
  }
}

const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    work: 'var(--color-primary, #6366f1)',
    rest: '#22c55e',
    lock: '#9ca3af',
    screen: '#9ca3af', // 兼容历史记录
  }
  return colorMap[status] || '#9ca3af'
}

const processedData = computed(() => {
  const data = curDateData.value
  if (!data || data.length === 0) return []

  const dateStr = curDate.value
  const dayEnd = moment(dateStr).endOf('day')
  const now = moment()
  const isToday = dateStr === moment().format('YYYY-MM-DD')
  // 当天未结束 → 最新一条的段尾取「现在」；历史日期 → 取当天 23:59:59
  const endTime = isToday ? now : dayEnd

  // curDateData 为倒序（最新在前）。某条记录的「时间上下一条」= 数组里前一条（更早进入的反而在后）。
  // 倒序下 data[i-1] 才是时间上更晚（后创建）的那条；i===0 即最新一条，无后续 → 用 endTime。
  return data.map((item: any, index: number) => {
    const curTime = moment(item.dateTime)
    const nextInTime = index === 0 ? endTime : moment(data[index - 1].dateTime)

    // 段尾 = min(下一条创建时间, 创建时间 + 配置间隔)；lock 无固定间隔 → 不截断
    const intervalMs = getConfiguredIntervalMs(item.value)
    let segEnd = nextInTime
    if (intervalMs != null) {
      const cappedEnd = moment(curTime).add(intervalMs, 'milliseconds')
      if (cappedEnd.isBefore(nextInTime)) segEnd = cappedEnd
    }
    if (segEnd.isBefore(curTime)) segEnd = curTime // 防御：异常数据钳到起点

    const startTime = curTime.format('HH:mm:ss')
    const endTimeStr = segEnd.format('HH:mm:ss')
    const durationMs = segEnd.diff(curTime)
    const durationSec = Math.round(durationMs / 1000)

    let duration = ''
    if (durationSec < 60) {
      duration = `${durationSec}秒`
    } else if (durationSec < 3600) {
      const mins = Math.round(durationSec / 60)
      duration = `${mins}分钟`
    } else {
      const hours = Math.floor(durationSec / 3600)
      const mins = Math.round((durationSec % 3600) / 60)
      duration = hours > 0 && mins > 0
        ? `${hours}小时${mins}分钟`
        : hours > 0
          ? `${hours}小时`
          : `${mins}分钟`
    }

    return {
      ...item,
      startTime,
      endTime: endTimeStr,
      duration,
    }
  })
})
</script>

<style scoped lang="scss">
.pomodoro-record {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .record-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary, #303133);
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid transparent;
    background: linear-gradient(90deg, var(--color-primary, #6366f1), transparent) no-repeat left bottom / 100% 1px;
  }

  .tab-switch {
    margin-top: 0;
  }
}

.list-view {
  .date-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    padding: 16px 20px;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: var(--radius-card, 8px);

    .selector-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #303133);
      white-space: nowrap;
    }

    .date-picker {
      flex: 1;
      max-width: 280px;
    }

    .date-actions {
      margin-left: auto;
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
  }

  .record-list {
    position: relative;
    padding-left: 24px;
  }

  .record-card {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    padding: 20px;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: var(--radius-card, 8px);
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--color-primary, #6366f1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
    }

    .card-left {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 24px;
      flex-shrink: 0;

      .status-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
      }

      .timeline-line {
        flex: 1;
        width: 2px;
        background: var(--border-subtle, #e4e7ed);
        margin-top: 8px;
        min-height: 40px;
      }
    }

    .card-content {
      flex: 1;
      min-width: 0;

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;

        .status-label {
          font-size: 15px;
          font-weight: 600;
        }

        .duration-badge {
          padding: 4px 12px;
          background: var(--bg-hover, #f5f7fa);
          border-radius: 20px;
          font-size: 13px;
          color: var(--text-secondary, #606266);
        }
      }

      .card-body {
        display: flex;
        align-items: center;
        gap: 8px;

        .time-start,
        .time-end {
          font-size: 14px;
          color: var(--text-secondary, #606266);
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        }

        .time-separator {
          width: 24px;
          height: 1px;
          background: var(--border-subtle, #e4e7ed);
          position: relative;

          &::before {
            content: '';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 6px;
            height: 6px;
            background: var(--text-muted, #909399);
            border-radius: 50%;
          }
        }
      }
    }
  }

  .empty-state {
    display: flex;
    justify-content: center;
    padding: 60px 20px;

    .empty-content {
      text-align: center;

      .empty-circle {
        width: 64px;
        height: 64px;
        margin: 0 auto 16px;
        border-radius: 50%;
        background: var(--bg-hover, #f5f7fa);
        border: 2px dashed var(--border-subtle, #e4e7ed);
      }

      .empty-text {
        font-size: 14px;
        color: var(--text-muted, #909399);
        margin: 0;
      }
    }
  }
}
</style>