<template>
  <div class="portfolio-summary">
    <div class="summary-card">
      <div class="label">总资产 (元)</div>
      <div class="value">{{ fmt(summary.totalMarketValue) }}</div>
      <div class="sub">成本 {{ fmt(summary.totalCost) }} · 持仓 {{ rows.length }}</div>
    </div>

    <div class="summary-card">
      <div class="label">总收益 (元)</div>
      <div class="value" :class="cls(summary.totalProfit)">
        {{ sign(summary.totalProfit) }}{{ fmt(summary.totalProfit) }}
      </div>
      <div class="sub" :class="cls(summary.totalProfitPercent)">
        {{ sign(summary.totalProfitPercent) }}{{ summary.totalProfitPercent.toFixed(2) }}%
      </div>
    </div>

    <div class="summary-card">
      <div class="label">当日盈亏 (元)</div>
      <div class="value" :class="cls(summary.dayProfit)">
        {{ sign(summary.dayProfit) }}{{ fmt(summary.dayProfit) }}
      </div>
      <div class="sub" :class="cls(summary.dayProfit)">今日浮动</div>
    </div>

    <div class="summary-card">
      <div class="label">总收益率</div>
      <div class="value" :class="cls(summary.totalProfitPercent)">
        {{ sign(summary.totalProfitPercent) }}{{ summary.totalProfitPercent.toFixed(2) }}%
      </div>
      <div class="sub">累计 / 成本</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HoldingRow, PortfolioSummary as Summary } from '../types'

const props = defineProps<{ summary: Summary; rows: HoldingRow[] }>()

/** 金额格式化：千分位 + 两位小数 */
function fmt(v: number): string {
  return (Number.isFinite(v) ? v : 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
/** 正负号（亏损也带 -） */
function sign(v: number): string {
  return v > 0 ? '+' : ''
}
/** 红涨绿跌：正为红(up)、负为绿(down)、零为中性 */
function cls(v: number): string {
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return 'flat'
}
</script>

<style scoped lang="scss">
.portfolio-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  .summary-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 14px 16px;

    .label {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .value {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }
    .sub {
      margin-top: 6px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  }

  // 红涨绿跌（与 A 股约定一致）
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

@media (max-width: 900px) {
  .portfolio-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
