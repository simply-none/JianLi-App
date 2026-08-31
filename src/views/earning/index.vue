<template>
  <div class="earning-page">
    <!-- 顶部操作栏 -->
    <div class="page-head">
      <div class="head-left">
        <h2 class="page-title">收益看板</h2>
        <span class="page-sub">
          数据源：新浪财经
          <span class="status-dot" :class="marketOpen ? 'on' : 'off'"></span>
          {{ marketLabel }} · 更新于 {{ lastUpdatedText }}
        </span>
        <span v-if="!marketOpen" class="page-hint">已收盘，数据每日仅获取一次</span>
      </div>
      <div class="head-right">
        <label class="fallback-switch" title="新浪估值失败时回落天天基金（默认关）">
          <el-switch v-model="fallbackOn" size="small" />
          <span>估值兜底(天天)</span>
        </label>
        <button class="btn" :disabled="loadingQuotes" :title="refreshTitle" @click="onRefresh">
          <LucideIcon name="RefreshCcw" :size="15" />
          <span>{{ loadingQuotes ? '刷新中…' : '刷新' }}</span>
        </button>
        <button class="btn primary" @click="openAdd">
          <LucideIcon name="Plus" :size="15" />
          <span>添加持仓</span>
        </button>
      </div>
    </div>

    <!-- 免费接口友好提示条 -->
    <div class="api-tip">
      <LucideIcon name="Info" :size="14" />
      <span>
        数据来自新浪财经免费接口，已做缓存与限频（收盘后每日仅取一次），请勿高频刷新，避免被限流。
      </span>
    </div>

    <!-- 组合切换器 -->
    <div class="portfolio-bar">
      <div class="pf-tabs">
        <button class="pf-tab" :class="{ active: currentPortfolioId === ALL_PORTFOLIOS }" @click="selectPortfolio(ALL_PORTFOLIOS)">
          全部
        </button>
        <button
          v-for="p in portfolios"
          :key="p.id"
          class="pf-tab"
          :class="{ active: currentPortfolioId === p.id }"
          @click="selectPortfolio(p.id)"
        >
          {{ p.name }}
        </button>
      </div>
      <button class="pf-manage" @click="showManage = true">
        <LucideIcon name="Settings" :size="14" />
        <span>管理</span>
      </button>
    </div>

    <!-- 组合总览卡片 -->
    <PortfolioSummary :summary="summary" :rows="rows" />

    <!-- 顶部 Tab：二分维度（股票收益 / 组合收益） -->
    <TopTabs :tabs="tabs" v-model="active" />

    <!-- 面板区：用 v-if 切换，不用 transition out-in -->
    <div class="page-body">
      <HoldingList
        v-if="active === 'stock'"
        :rows="rows"
        :loading="loadingQuotes"
        @add="openAdd"
        @edit="openEdit"
        @remove="onRemove"
      />
      <div v-else class="combo-wrap">
        <ReturnCurveChart />
        <PeriodReturnCard />
      </div>
    </div>

    <!-- 持仓录入 / 编辑弹窗 -->
    <HoldingEditDialog
      v-model="showDialog"
      :edit="editing"
      :portfolio-id="currentPortfolioId === ALL_PORTFOLIOS ? 'default' : currentPortfolioId"
      @submit="onSubmit"
    />
    <!-- 组合管理弹窗 -->
    <PortfolioManageDialog v-model="showManage" @select="onPortfolioSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import TopTabs from '@/components/TopTabs.vue'
import PortfolioSummary from './components/PortfolioSummary.vue'
import HoldingList from './components/HoldingList.vue'
import ReturnCurveChart from './components/ReturnCurveChart.vue'
import PeriodReturnCard from './components/PeriodReturnCard.vue'
import HoldingEditDialog from './components/HoldingEditDialog.vue'
import PortfolioManageDialog from './components/PortfolioManageDialog.vue'
import { useEarningStore, ALL_PORTFOLIOS } from './store'
import type { Holding } from './types'

const store = useEarningStore()
const { rows, summary, loadingQuotes, marketOpen, lastUpdated, currentPortfolioId, portfolios } = store

const active = ref<'stock' | 'combo'>('stock')
const tabs = [
  { key: 'stock', label: '股票收益', icon: 'List' },
  { key: 'combo', label: '组合收益', icon: 'TrendingUp' },
]

/** 基金估值兜底开关（双向绑定到 store，切换即刷新估值） */
const fallbackOn = computed<boolean>({
  get: () => store.estimateFallback.value,
  set: (v) => store.setFallback(v),
})

const showDialog = ref(false)
const showManage = ref(false)
const editing = ref<Holding | null>(null)

function selectPortfolio(id: string) {
  store.setCurrentPortfolio(id)
}
function openAdd() {
  editing.value = null
  showDialog.value = true
}
function openEdit(row: Holding) {
  editing.value = row
  showDialog.value = true
}
async function onRemove(key: string) {
  await store.removeHolding(key)
}
async function onSubmit(form: Omit<Holding, 'key' | 'created_at'> & { key?: string }) {
  await store.saveHolding(form)
  showDialog.value = false
}
function onRefresh() {
  // 用户主动刷新：强制拉取（即便非交易时段）
  store.refreshQuotes(true)
}
function onPortfolioSelected() {
  // 图表组件已 watch currentPortfolioId 自动重载，这里无需额外处理
}

/** 市场状态文案 */
const marketLabel = computed(() => (marketOpen.value ? '交易中' : '已收盘'))
/** 刷新按钮动态提示：非交易时段提醒用户手动刷新仍会回源 */
const refreshTitle = computed(() =>
  marketOpen.value
    ? '刷新实时行情（交易时段每 60 秒自动刷新一次）'
    : '已收盘：数据每日仅回源一次，此按钮仍会主动请求新浪接口，请谨慎点击以免被限流',
)
/** 数据更新时间（时:分:秒） */
const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) return '—'
  const d = new Date(lastUpdated.value)
  const p = (n: number) => `${n}`.padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
})

onMounted(() => {
  store.init().catch((e) => console.error('收益看板初始化失败:', e))
  store.startPolling()
})
onUnmounted(() => {
  store.stopPolling()
})
</script>

<style scoped lang="scss">
.earning-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 12px;
  background: var(--bg-base);
  overflow: hidden;

  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;

    .head-left {
      display: flex;
      align-items: baseline;
      gap: 12px;
      flex-wrap: wrap;

      .page-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .page-sub {
        font-size: 0.8rem;
        color: var(--text-muted);
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .page-hint {
        font-size: 0.75rem;
        color: var(--text-muted);
        background: var(--bg-hover, rgba(0, 0, 0, 0.04));
        padding: 2px 8px;
        border-radius: 6px;
      }
    }

    .head-right {
      display: flex;
      align-items: center;
      gap: 10px;

      .fallback-switch {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: var(--text-secondary);
        cursor: pointer;
        user-select: none;
      }
    }
  }

  // 状态点（交易中/已收盘）
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    &.on {
      background: #16a34a;
      box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18);
    }
    &.off {
      background: var(--text-muted);
    }
  }

  // 免费接口友好提示条
  .api-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.78rem;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);

    :deep(svg) {
      color: var(--color-primary);
      flex-shrink: 0;
    }
  }

  // 组合切换器
  .portfolio-bar {
    display: flex;
    align-items: center;
    gap: 10px;

    .pf-tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      flex: 1;
      min-width: 0;

      .pf-tab {
        flex-shrink: 0;
        padding: 6px 14px;
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        background: var(--bg-card);
        color: var(--text-secondary);
        font-size: 0.82rem;
        cursor: pointer;
        white-space: nowrap;

        &:hover {
          border-color: var(--color-primary);
          color: var(--text-primary);
        }
        &.active {
          background: color-mix(in srgb, var(--color-primary) 14%, transparent);
          border-color: var(--color-primary);
          color: var(--color-primary);
          font-weight: 600;
        }
      }
    }

    .pf-manage {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 0.8rem;
      cursor: pointer;

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
    }
  }

  // 组合收益 Tab 下的两块卡片纵向排列
  .combo-wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .page-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  // 按钮（刷新 / 添加）
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn, 10px);
    background: var(--bg-card);
    color: var(--text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;

    &:hover {
      border-color: var(--color-primary);
      color: var(--text-primary);
    }
    &:disabled {
      opacity: 0.6;
      cursor: default;
    }

    &.primary {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;

      &:hover {
        filter: brightness(1.05);
      }
    }
  }
}
</style>
