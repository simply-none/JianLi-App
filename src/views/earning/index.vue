<template>
  <div class="earning-page">
    <!-- 顶部操作栏 -->
    <div class="page-head">
      <div class="head-left">
        <h2 class="page-title">收益看板</h2>
        <span class="page-sub">数据源：新浪财经（实时行情 / 基金净值 · 免费无需 Key）</span>
      </div>
      <div class="head-right">
        <label class="fallback-switch" title="新浪估值失败时回落天天基金（默认关）">
          <el-switch v-model="fallbackOn" size="small" />
          <span>估值兜底(天天)</span>
        </label>
        <button class="btn" :disabled="loadingQuotes" @click="onRefresh">
          <LucideIcon name="RefreshCcw" :size="15" />
          <span>{{ loadingQuotes ? '刷新中…' : '刷新' }}</span>
        </button>
        <button class="btn primary" @click="openAdd">
          <LucideIcon name="Plus" :size="15" />
          <span>添加持仓</span>
        </button>
      </div>
    </div>

    <!-- 组合总览卡片 -->
    <PortfolioSummary :summary="summary" :rows="rows" />

    <!-- 顶部 Tab（单行不换行，滚轮横滚；禁用 out-in 过渡避免空白） -->
    <TopTabs :tabs="tabs" v-model="active" />

    <!-- 面板区：用 v-if 切换，不用 transition out-in -->
    <div class="page-body">
      <HoldingList
        v-if="active === 'holding'"
        :rows="rows"
        :loading="loadingQuotes"
        @add="openAdd"
        @edit="openEdit"
        @remove="onRemove"
      />
      <ReturnCurveChart v-else-if="active === 'curve'" />
      <PeriodReturnCard v-else-if="active === 'period'" />
    </div>

    <!-- 持仓录入 / 编辑弹窗 -->
    <HoldingEditDialog v-model="showDialog" :edit="editing" @submit="onSubmit" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import TopTabs from '@/components/TopTabs.vue'
import PortfolioSummary from './components/PortfolioSummary.vue'
import HoldingList from './components/HoldingList.vue'
import ReturnCurveChart from './components/ReturnCurveChart.vue'
import PeriodReturnCard from './components/PeriodReturnCard.vue'
import HoldingEditDialog from './components/HoldingEditDialog.vue'
import { useEarningStore } from './store'
import type { Holding } from './types'

const store = useEarningStore()
const { rows, summary, loadingQuotes } = store

const active = ref<'holding' | 'curve' | 'period'>('holding')
const tabs = [
  { key: 'holding', label: '持仓列表', icon: 'List' },
  { key: 'curve', label: '收益曲线', icon: 'TrendingUp' },
  { key: 'period', label: '区间收益', icon: 'History' },
]

/** 基金估值兜底开关（双向绑定到 store，切换即刷新估值） */
const fallbackOn = computed<boolean>({
  get: () => store.estimateFallback.value,
  set: (v) => store.setFallback(v),
})

const showDialog = ref(false)
const editing = ref<Holding | null>(null)

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
  store.refreshQuotes()
}

onMounted(() => {
  store.init().catch((e) => console.error('收益看板初始化失败:', e))
})
</script>

<style scoped lang="scss">
.earning-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 14px;
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

      .page-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .page-sub {
        font-size: 0.8rem;
        color: var(--text-muted);
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
  }

  .page-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}
</style>
