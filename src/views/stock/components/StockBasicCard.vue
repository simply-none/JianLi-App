<template>
  <div v-if="quote || instrument" class="stock-basic-card" :class="{ compact }">
    <div class="card-header">
      <div class="title-block">
        <span class="symbol">{{ quote?.symbol || instrument?.symbol }}</span>
        <span v-if="instrument?.name" class="name">{{ instrument.name }}</span>
      </div>
      <span
        v-if="changePercent !== null"
        class="change"
        :class="changePercent >= 0 ? 'up' : 'down'"
      >
        {{ changePercent >= 0 ? '▲' : '▼' }} {{ Math.abs(changePercent).toFixed(2) }}%
      </span>
    </div>

    <div class="price-row">
      <div class="price-block">
        <div class="label">最新价</div>
        <div class="value" :class="changePercent !== null && changePercent >= 0 ? 'up' : 'down'">
          {{ fmt(quote?.last_price) }}
        </div>
      </div>
      <div class="price-block">
        <div class="label">昨收</div>
        <div class="value">{{ fmt(quote?.prev_close) }}</div>
      </div>
    </div>

    <div class="grid">
      <div class="item">
        <div class="label">今开</div>
        <div class="value">{{ fmt(quote?.open) }}</div>
      </div>
      <div class="item">
        <div class="label">最高</div>
        <div class="value">{{ fmt(quote?.high) }}</div>
      </div>
      <div class="item">
        <div class="label">最低</div>
        <div class="value">{{ fmt(quote?.low) }}</div>
      </div>
      <div class="item">
        <div class="label">成交量</div>
        <div class="value">{{ fmtVolume(quote?.volume) }}</div>
      </div>
      <div class="item">
        <div class="label">成交额</div>
        <div class="value">{{ fmtAmount(quote?.amount) }}</div>
      </div>
      <div class="item">
        <div class="label">交易所</div>
        <div class="value">{{ instrument?.exchange || quote?.region || '-' }}</div>
      </div>
      <div class="item">
        <div class="label">类型</div>
        <div class="value">{{ typeLabel }}</div>
      </div>
      <div class="item">
        <div class="label">上市日期</div>
        <div class="value">{{ instrument?.ext?.listing_date || '-' }}</div>
      </div>
    </div>
  </div>
  <div v-else class="stock-basic-card empty" :class="{ compact }">
    <span class="muted">暂无行情与标的信息</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Quote, Instrument } from '../types'

const props = defineProps<{ quote?: Quote; instrument?: Instrument; compact?: boolean }>()

const changePercent = computed<number | null>(() => {
  const q = props.quote
  if (!q || q.last_price == null || q.prev_close == null || !q.prev_close) return null
  return ((q.last_price - q.prev_close) / q.prev_close) * 100
})

/** 标的类型中文标签（顶层 type 与 ext.type 互补） */
const typeLabel = computed<string>(() => {
  const t = props.instrument?.type || props.instrument?.ext?.type
  if (!t) return '-'
  const map: Record<string, string> = {
    stock: '股票',
    index: '指数',
    etf: 'ETF',
    cn_equity: 'A股',
    us_equity: '美股',
    hk_equity: '港股',
  }
  return map[t] || t
})

function fmt(v?: number): string {
  return v == null ? '-' : v.toFixed(2)
}

function fmtVolume(v?: number): string {
  if (v == null) return '-'
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万'
  return String(v)
}

function fmtAmount(v?: number): string {
  if (v == null) return '-'
  if (v >= 1e8) return '¥' + (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return '¥' + (v / 1e4).toFixed(2) + '万'
  return '¥' + v.toFixed(2)
}
</script>

<style scoped lang="scss">
.stock-basic-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    .symbol {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .title-block {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;

      .name {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .change {
      font-size: 0.9rem;
      font-weight: 600;

      &.up { color: #e63946; }
      &.down { color: #2ea043; }
    }
  }

  .price-row {
    display: flex;
    gap: 24px;
    margin-bottom: 14px;

    .price-block {
      .label {
        font-size: 0.72rem;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .value {
        font-size: 1.6rem;
        font-weight: 700;
        &.up { color: #e63946; }
        &.down { color: #2ea043; }
      }
    }
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;

    .item {
      .label {
        font-size: 0.72rem;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .value {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-primary);
      }
    }
  }

  &.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  &.compact {
    padding: 10px;

    .card-header {
      margin-bottom: 8px;
      .symbol { font-size: 0.9rem; }
      .title-block .name { font-size: 0.75rem; }
      .change { font-size: 0.8rem; }
    }

    .price-row {
      gap: 16px;
      margin-bottom: 10px;
      .price-block .value { font-size: 1.25rem; }
    }

    .grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      .item .value { font-size: 0.85rem; }
    }

    &.empty { min-height: 80px; font-size: 0.8rem; }
  }
}
</style>
