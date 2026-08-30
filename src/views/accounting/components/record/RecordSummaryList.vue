<!--
 * 记账 - 记录聚合总览列表（下钻专用）
 * 用于列表 Tab 的「年 / 月」模式：
 *   - year 模式：按「月」聚合，每行展示当月收入/支出总额 + 合计，点击下钻到月
 *   - month 模式：按「日」聚合，每行展示当日收入/支出总额 + 合计，点击下钻到日
 * 聚合行无单条记录，故不含右键编辑/删除（日模式由 RecordList 展示明细并保留右键）。
 * 聚合用 computed 轻量计算，年/月最多 12/31 行，无全局监听，性能无忧。
-->
<template>
  <div class="summary-list" :class="{ compact }">
    <el-empty v-if="!rows.length" :description="emptyText" :image-size="compact ? 50 : 80" />

    <div
      v-for="row in rows"
      :key="row.key"
      class="sum-row"
      :class="{ compact }"
      @click="onDrill(row)"
    >
      <div class="sum-date">
        <span class="sd-label">{{ row.label }}</span>
      </div>
      <div class="sum-amounts">
        <span class="sa income">
          <i class="sa-dot" />
          收入 {{ money(row.income) }}
        </span>
        <span class="sa expense">
          <i class="sa-dot" />
          支出 {{ money(row.expense) }}
        </span>
        <span class="sa total" :class="row.income - row.expense >= 0 ? 'income' : 'expense'">
          合计 {{ money(row.income - row.expense) }}
        </span>
      </div>
      <LucideIcon name="ChevronRight" :size="compact ? 14 : 16" class="sum-arrow" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { AccountingRecord } from '@/constants/accounting'

const props = withDefaults(
  defineProps<{
    mode: 'year' | 'month'
    records: AccountingRecord[]
    compact?: boolean
    emptyText?: string
  }>(),
  { compact: false, emptyText: '暂无记录' },
)

// 下钻：年模式点某月 → 进入 month；月模式点某日 → 进入 day
const emit = defineEmits<{ drill: [nextMode: 'month' | 'day', value: string] }>()

interface SumRow {
  key: string
  label: string
  income: number
  expense: number
}

/** 按 mode 聚合：年→YYYY-MM 分组、月→YYYY-MM-DD 分组，算收入/支出，升序排列 */
const rows = computed<SumRow[]>(() => {
  const sliceLen = props.mode === 'year' ? 7 : 10
  const map = new Map<string, { income: number; expense: number }>()
  for (const r of props.records) {
    const key = (r.record_date || '').slice(0, sliceLen)
    if (!key) continue
    const cur = map.get(key) || { income: 0, expense: 0 }
    if (r.type === 'income') cur.income += Number(r.amount) || 0
    else cur.expense += Number(r.amount) || 0
    map.set(key, cur)
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: props.mode === 'year' ? `${Number(key.slice(5, 7))}月` : key.slice(5, 10),
      income: Number(v.income.toFixed(2)),
      expense: Number(v.expense.toFixed(2)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key)) // 1月→12月 / 01日→月末
})

function money(n: number) {
  return '¥' + (Number(n) || 0).toFixed(2)
}

function onDrill(row: SumRow) {
  emit('drill', props.mode === 'year' ? 'month' : 'day', row.key)
}
</script>

<style scoped lang="scss">
.summary-list {
  width: 100%;

  .sum-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 6px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: var(--bg-hover, #f0f2f5);
      .sum-arrow {
        color: var(--color-primary, #409eff);
      }
    }

    .sum-date {
      flex-shrink: 0;
      min-width: 56px;
      .sd-label {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #303133);
        font-variant-numeric: tabular-nums;
      }
    }

    .sum-amounts {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;

      .sa {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--text-secondary, #606266);

        .sa-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        &.income {
          color: #67c23a;
          .sa-dot {
            background: #67c23a;
          }
        }
        &.expense {
          color: #f56c6c;
          .sa-dot {
            background: #f56c6c;
          }
        }
        &.total {
          font-weight: 600;
          margin-left: auto;
        }
      }
    }

    .sum-arrow {
      flex-shrink: 0;
      color: var(--text-muted, #c0c4cc);
    }

    &.compact {
      padding: 8px 4px;
      .sum-date .sd-label {
        font-size: 13px;
      }
      .sum-amounts {
        gap: 10px;
      }
    }
  }
}
</style>
