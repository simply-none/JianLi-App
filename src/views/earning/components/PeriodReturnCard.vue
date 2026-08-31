<template>
  <div class="period-card">
    <div class="period-head">
      <h3 class="period-title">区间收益</h3>
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

    <!-- 组合总收益 -->
    <div class="total-box" :class="cls(total)">
      <span class="total-label">{{ portfolioName }} · {{ currentLabel }} 收益率</span>
      <span class="total-value">{{ sign(total) }}{{ total.toFixed(2) }}%</span>
    </div>

    <!-- 各持仓区间收益 -->
    <div v-if="items.length" class="items">
      <div v-for="it in items" :key="it.key" class="item">
        <div class="item-top">
          <span class="item-name">{{ it.name }}</span>
          <span class="item-pct" :class="cls(it.percent)">{{ sign(it.percent) }}{{ it.percent.toFixed(2) }}%</span>
        </div>
        <div class="bar-track">
          <div
            class="bar-fill"
            :class="cls(it.percent)"
            :style="{ width: barWidth(it.percent) + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <p v-else-if="!loading" class="empty">暂无数据，请先添加持仓</p>
    <p v-else class="empty">加载中…</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useEarningStore } from '../store'

const store = useEarningStore()

function ytdDays(): number {
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  return Math.max(1, Math.round((now.getTime() - jan1.getTime()) / 86_400_000))
}

const periodOptions = [
  { label: '近1周', days: 7 },
  { label: '近1月', days: 30 },
  { label: '近3月', days: 90 },
  { label: '近6月', days: 180 },
  { label: '近1年', days: 365 },
  { label: '今年以来', days: ytdDays() },
]

const days = ref(90)
const total = ref(0)
const items = ref<Array<{ key: string; name: string; percent: number }>>([])
const loading = ref(false)

function currentLabel(): string {
  return periodOptions.find((p) => p.days === days.value)?.label || ''
}
/** 当前组合名称（用于展示） */
const portfolioName = computed(() => {
  if (store.currentPortfolioId.value === 'all') return '全部组合'
  return store.portfolios.value.find((p) => p.id === store.currentPortfolioId.value)?.name || '组合'
})
function sign(v: number): string {
  return v > 0 ? '+' : ''
}
function cls(v: number): string {
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return 'flat'
}
/** 柱状条宽度：按最大绝对值归一（最小 4% 可见） */
function barWidth(pct: number): number {
  const max = Math.max(1, ...items.value.map((i) => Math.abs(i.percent)), Math.abs(total.value))
  return Math.max(4, (Math.abs(pct) / max) * 100)
}

async function load() {
  loading.value = true
  try {
    const r = await store.periodReturns(days.value, store.currentPortfolioId.value)
    total.value = r.total
    items.value = r.items
  } catch (e) {
    console.error('加载区间收益失败:', e)
  } finally {
    loading.value = false
  }
}

function select(d: number) {
  days.value = d
  load()
}

onMounted(() => load())
// 切换组合后重载区间收益
watch(
  () => store.currentPortfolioId.value,
  () => load(),
)
</script>

<style scoped lang="scss">
.period-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px 16px;

  .period-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 12px;

    .period-title {
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

  .total-box {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--bg-hover, rgba(0, 0, 0, 0.03));
    margin-bottom: 14px;

    .total-label {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .total-value {
      font-size: 1.5rem;
      font-weight: 700;
    }
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .item {
      .item-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;

        .item-name {
          font-size: 0.85rem;
          color: var(--text-primary);
        }
        .item-pct {
          font-size: 0.85rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
      }
      .bar-track {
        height: 8px;
        border-radius: 4px;
        background: var(--bg-hover, rgba(0, 0, 0, 0.06));
        overflow: hidden;

        .bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s;
        }
      }
    }
  }

  .empty {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    padding: 30px 0;
  }

  // 红涨绿跌
  .up {
    color: var(--color-error);
  }
  .up.bar-fill {
    background: var(--color-error);
  }
  .down {
    color: var(--color-success);
  }
  .down.bar-fill {
    background: var(--color-success);
  }
  .flat {
    color: var(--text-primary);
  }
  .flat.bar-fill {
    background: var(--text-muted);
  }
}
</style>
