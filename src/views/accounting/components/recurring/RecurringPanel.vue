<!--
 * 记账 - 周期账单面板（完整页「周期账单」Tab 与小窗口共用）
 *
 * 功能：
 * - 列表展示全部周期账单规则：名称、金额、分类、周期文案、下次执行日、启用开关
 * - 新增 / 编辑（RecurringEditDialog）、删除（确认弹窗）
 * - 「立即检查到期」按钮：手动触发一轮自动记账（通常无需使用，引擎每 5 分钟自动跑）
 * 数据来自 useAccounting store（周期账单子模块），自动生成的记录在记录列表正常可见。
-->
<template>
  <div class="recurring-panel" :class="{ compact }">
    <!-- 头部 -->
    <div class="rp-header">
      <span class="rp-title">
        <LucideIcon name="CalendarClock" :size="16" />
        周期账单
        <span class="rp-sub">到期自动记账，适合房租 / 订阅等固定收支</span>
      </span>
      <div class="rp-actions">
        <el-button size="small" @click="runNow" :loading="running">
          <LucideIcon name="RefreshCcw" :size="13" />
          立即检查到期
        </el-button>
        <el-button size="small" type="primary" @click="openAdd">
          <LucideIcon name="Plus" :size="13" />
          新增
        </el-button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="rp-list">
      <div v-if="store.recurringItems.length === 0" class="empty-tip">
        暂无周期账单，点右上「新增」创建第一条规则（如：房租，每月 1 号，¥3000）
      </div>
      <div
        v-for="bill in store.recurringItems"
        :key="bill.id"
        class="bill-row"
        :class="{ disabled: !bill.enabled }"
      >
        <div class="br-icon" :style="{ background: catColor(bill.category) }">
          <LucideIcon :name="catIcon(bill.category)" :size="14" />
        </div>
        <div class="br-main">
          <div class="br-top">
            <span class="br-name">{{ bill.name }}</span>
            <span class="br-amount" :class="bill.type">{{ money(bill.amount) }}</span>
          </div>
          <div class="br-meta">
            <span>{{ bill.category }}</span>
            <span class="sep">·</span>
            <span>{{ cycleText(bill) }}</span>
            <span class="sep">·</span>
            <span>下次 {{ bill.next_date || '未设置' }}</span>
            <span v-if="bill.last_date" class="sep">·</span>
            <span v-if="bill.last_date">上次 {{ bill.last_date }}</span>
          </div>
        </div>
        <div class="br-actions">
          <el-switch
            :model-value="!!bill.enabled"
            size="small"
            @change="toggleBill(bill)"
          />
          <el-button class="mini-btn" size="small" text @click="openEdit(bill)">
            <LucideIcon name="Pencil" :size="13" />
          </el-button>
          <el-button class="mini-btn" size="small" text type="danger" @click="removeBill(bill)">
            <LucideIcon name="Trash2" :size="13" />
          </el-button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <RecurringEditDialog v-model="dialogVisible" :bill="editTarget" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import useAccounting from '@/store/useAccounting'
import { cycleDayLabel } from '@/store/accounting/recurringDate'
import type { AccountingRecurring } from '@/constants/accounting'
import RecurringEditDialog from './RecurringEditDialog.vue'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const store = useAccounting()

/** 金额格式化 */
function money(n: number) {
  return '¥' + (Number(n) || 0).toFixed(2)
}

/** 周期展示文案：每周一 / 每月 1 日 / 每年 01-15 */
function cycleText(bill: AccountingRecurring) {
  return cycleDayLabel(bill.cycle, bill.day)
}

/** 分类图标（未配置回退通用图标） */
function catIcon(name: string) {
  return store.categories.find((c) => c.name === name)?.icon || 'CircleEllipsis'
}

/** 分类主题色 */
function catColor(name: string) {
  return store.categories.find((c) => c.name === name)?.color || '#909399'
}

// —— 编辑弹窗 ——
const dialogVisible = ref(false)
const editTarget = ref<AccountingRecurring | null>(null)

/** 打开新增弹窗 */
function openAdd() {
  editTarget.value = null
  dialogVisible.value = true
}

/** 打开编辑弹窗 */
function openEdit(bill: AccountingRecurring) {
  editTarget.value = bill
  dialogVisible.value = true
}

/** 启用 / 停用 */
async function toggleBill(bill: AccountingRecurring) {
  const ok = await store.toggleRecurringEnabled(bill)
  if (ok) ElMessage.success(bill.enabled ? '已停用' : '已启用（过期开始日已重置为下一期）')
}

/** 删除（确认后执行；已生成的历史记录保留） */
async function removeBill(bill: AccountingRecurring) {
  if (!bill.id) return
  try {
    await ElMessageBox.confirm(`确定删除周期账单「${bill.name}」吗？已自动生成的记账记录会保留。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  const ok = await store.deleteRecurring(bill.id)
  if (ok) ElMessage.success('已删除')
}

// —— 手动触发一轮到期检查 ——
const running = ref(false)

/** 立即执行一轮自动记账 */
async function runNow() {
  running.value = true
  try {
    const generated = await store.runDueBills()
    if (generated) ElMessage.success('有到期账单已自动记账')
    else ElMessage.info('暂无到期账单')
  } finally {
    running.value = false
  }
}
</script>

<style scoped lang="scss">
.recurring-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: auto;

  .rp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    .rp-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary, #303133);

      .rp-sub {
        font-size: 11px;
        font-weight: 400;
        color: var(--el-text-color-secondary, #909399);
      }
    }

    .rp-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
  }

  .rp-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .empty-tip {
      padding: 24px 0;
      text-align: center;
      font-size: 12px;
      color: var(--el-text-color-secondary, #909399);
    }

    .bill-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--el-bg-color-overlay, #fff);
      border: 1px solid var(--el-border-color-lighter, #e4e7ed);

      &.disabled {
        opacity: 0.55;
      }

      .br-icon {
        flex-shrink: 0;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color: #fff;
      }

      .br-main {
        flex: 1;
        min-width: 0;

        .br-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;

          .br-name {
            font-size: 13px;
            font-weight: 600;
            color: var(--el-text-color-primary, #303133);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .br-amount {
            font-size: 13px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            flex-shrink: 0;

            &.expense {
              color: #f56c6c;
            }
            &.income {
              color: #67c23a;
            }
          }
        }

        .br-meta {
          margin-top: 3px;
          font-size: 11px;
          color: var(--el-text-color-secondary, #909399);
          font-variant-numeric: tabular-nums;

          .sep {
            margin: 0 4px;
          }
        }
      }

      .br-actions {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 2px;
      }
    }
  }

  .mini-btn {
    padding: 4px;
  }

  // ============ compact（小窗口） ============
  &.compact {
    gap: 8px;

    .rp-header {
      .rp-title {
        font-size: 13px;

        .rp-sub {
          display: none;
        }
      }
    }
    .bill-row {
      padding: 8px 10px;
      gap: 8px;
    }
  }
}
</style>
