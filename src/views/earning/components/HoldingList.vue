<template>
  <div class="holding-list">
    <!-- 表头 -->
    <div class="list-head">
      <div class="col col-name">名称 / 代码</div>
      <div class="col col-type">类型</div>
      <div class="col col-num">现价 / 净值</div>
      <div class="col col-num">持仓市值</div>
      <div class="col col-num">成本</div>
      <div class="col col-num">累计盈亏</div>
      <div class="col col-num">当日盈亏</div>
      <div class="col col-ops">操作</div>
    </div>

    <!-- 空态 -->
    <div v-if="!rows.length" class="empty">
      <LucideIcon name="Wallet" :size="32" />
      <p>还没有持仓，点击右上角「添加持仓」开始记录</p>
      <p class="empty-sub">数据由新浪财经免费接口提供，请勿高频刷新以免被限流</p>
    </div>

    <!-- 数据行 -->
    <div v-else class="list-body">
      <div v-for="row in rows" :key="row.key" class="list-row">
        <div class="col col-name">
          <div class="name">{{ row.name || row.code }}</div>
          <div class="code">{{ row.code }} · {{ row.shares }} 份</div>
        </div>
        <div class="col col-type">
          <span class="tag" :class="row.type">{{ typeLabel(row.type) }}</span>
        </div>
        <div class="col col-num">
          <span :class="trendCls(row)">{{ priceText(row) }}</span>
          <div class="sub" v-if="row.type === 'fund' && row.snapshot?.estimatePercent != null">
            <span :class="row.snapshot.estimatePercent >= 0 ? 'up' : 'down'">
              {{ sign(row.snapshot.estimatePercent) }}{{ row.snapshot.estimatePercent.toFixed(2) }}%
            </span>
          </div>
        </div>
        <div class="col col-num">{{ money(row.marketValue) }}</div>
        <div class="col col-num">{{ money(row.cost) }}</div>
        <div class="col col-num">
          <div :class="cls(row.profit)">{{ sign(row.profit) }}{{ money(row.profit) }}</div>
          <div class="sub" :class="cls(row.profitPercent)">
            {{ sign(row.profitPercent) }}{{ row.profitPercent.toFixed(2) }}%
          </div>
        </div>
        <div class="col col-num">
          <div :class="cls(row.dayProfit)">{{ sign(row.dayProfit) }}{{ money(row.dayProfit) }}</div>
          <div class="sub" :class="cls(row.dayPercent)">
            {{ sign(row.dayPercent) }}{{ row.dayPercent.toFixed(2) }}%
          </div>
        </div>
        <div class="col col-ops">
          <button class="op-btn" title="编辑" @click="$emit('edit', row)">
            <LucideIcon name="Pencil" :size="15" />
          </button>
          <button class="op-btn danger" title="删除" @click="onRemove(row)">
            <LucideIcon name="Trash2" :size="15" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import type { HoldingRow, HoldingType } from '../types'

const props = defineProps<{ rows: HoldingRow[]; loading?: boolean }>()
const emit = defineEmits<{
  (e: 'add'): void
  (e: 'edit', row: HoldingRow): void
  (e: 'remove', key: string): void
}>()

function typeLabel(t: HoldingType): string {
  return t === 'stock' ? '股票/ETF' : '基金'
}
function money(v: number): string {
  return (Number.isFinite(v) ? v : 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
function sign(v: number): string {
  return v > 0 ? '+' : ''
}
function cls(v: number): string {
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return 'flat'
}
/** 现价 / 基金估值或净值展示 */
function priceText(row: HoldingRow): string {
  if (row.type === 'stock') return row.snapshot?.last != null ? row.snapshot.last.toFixed(2) : '-'
  const nav = row.snapshot?.estimateNav ?? row.snapshot?.nav
  return nav != null ? nav.toFixed(4) : '-'
}
/** 当日趋势色（基金用估值涨跌、股票用涨跌） */
function trendCls(row: HoldingRow): string {
  if (row.type === 'stock') return cls(row.dayProfit)
  const p = row.snapshot?.estimatePercent
  if (p == null) return 'flat'
  return cls(p)
}

async function onRemove(row: HoldingRow) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.name || row.code}」的持仓记录？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    emit('remove', row.key)
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.holding-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--bg-card);
  overflow: hidden;

  .list-head,
  .list-row {
    display: grid;
    grid-template-columns: 1.6fr 0.8fr 1fr 1fr 1fr 1.1fr 1.1fr 0.8fr;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
  }

  .list-head {
    background: var(--bg-hover, rgba(0, 0, 0, 0.03));
    font-size: 0.75rem;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-subtle);
  }

  .list-body {
    max-height: 100%;
    overflow: auto;
  }

  .list-row {
    border-bottom: 1px solid var(--border-subtle);
    font-size: 0.85rem;
    color: var(--text-primary);

    &:last-child {
      border-bottom: none;
    }
    &:hover {
      background: var(--bg-hover, rgba(0, 0, 0, 0.02));
    }
  }

  .col-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .col-name {
    .name {
      font-weight: 600;
    }
    .code {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 2px;
    }
  }

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.72rem;
    background: var(--bg-hover, rgba(0, 0, 0, 0.06));
    color: var(--text-secondary);

    &.fund {
      color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    }
  }

  .sub {
    font-size: 0.72rem;
    margin-top: 2px;
  }

  .col-ops {
    display: flex;
    gap: 6px;
    justify-content: flex-end;

    .op-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: 1px solid var(--border-subtle);
      border-radius: 7px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      &.danger:hover {
        border-color: var(--color-error);
        color: var(--color-error);
      }
    }
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 0;
    color: var(--text-muted);

    p {
      margin: 0;
      font-size: 0.85rem;
    }
    .empty-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      opacity: 0.85;
    }
  }

  // 红涨绿跌
  .up {
    color: var(--color-error);
  }
  .down {
    color: var(--color-success);
  }
  .flat {
    color: var(--text-primary);
  }
}
</style>
