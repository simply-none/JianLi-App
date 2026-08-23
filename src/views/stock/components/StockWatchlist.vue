<template>
  <div class="watchlist">
    <div class="wl-header">
      <span class="wl-title">自选股</span>
      <span class="wl-sub">你手动加入的标的（{{ watch.items.value.length }}），实时行情为批量获取</span>
      <button
        class="refresh-btn"
        :disabled="loading"
        :title="loading ? '加载中…' : '刷新实时行情'"
        @click="refresh"
      >
        <LucideIcon name="RefreshCw" :size="14" :class="{ spinning: loading }" />
      </button>
    </div>

    <div v-if="loading && rows.length === 0" class="wl-loading">加载中…</div>

    <div v-else-if="rows.length === 0" class="wl-empty">
      暂无自选股。在「股票查询分析」详情右上角，或「市场总览」右键某只股票，即可加入自选。
    </div>

    <!-- 虚拟表格：Element Plus 的 ElTableV2，仅渲染可视区行 -->
    <div v-else ref="wrapRef" class="wl-table-wrap">
      <el-table-v2
        :columns="columns"
        :data="rows"
        :width="tableWidth"
        :height="tableHeight"
        :row-height="44"
        :estimated-row-height="44"
        :cache="12"
        :scrollbar-always-on="true"
        :row-event-handlers="rowEventHandlers"
      >
        <template #empty>
          <span class="muted">暂无数据</span>
        </template>
      </el-table-v2>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, h, watch as vueWatch } from 'vue'
import { ElTableV2, ElMessage } from 'element-plus'
import type { Column } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import { getQuotesBatch } from '../api'
import type { Quote } from '../types'
import { useWatchlistStore } from '../watchlistStore'

const emit = defineEmits<{ (e: 'drill', symbol: string): void }>()

const watch = useWatchlistStore()

interface WatchRow {
  symbol: string
  name: string
  last_price?: number
  change_amount?: number
  change_pct?: number
  amplitude?: number
  volume?: number
  amount?: number
  turnover_rate?: number
}

const loading = ref(false)
/** 实时行情索引（按 symbol），与 watch.items 解耦，避免列表变动时丢失行情 */
const quoteMap = ref<Record<string, Quote>>({})

/** 列表行：由 watch.items（名称/代码）与 quoteMap（行情）派生，增删即时联动 */
const rows = computed<WatchRow[]>(() =>
  watch.items.value.map((item) => {
    const q = quoteMap.value[item.symbol]
    const ext = q?.ext
    return {
      symbol: item.symbol,
      name: item.name || baseSymbol(item.symbol),
      last_price: q?.last_price,
      change_amount: ext?.change_amount,
      change_pct: ext?.change_pct,
      amplitude: ext?.amplitude,
      volume: q?.volume,
      amount: q?.amount,
      turnover_rate: ext?.turnover_rate,
    }
  }),
)

/** 虚拟表格尺寸（随容器测量） */
const wrapRef = ref<HTMLElement | null>(null)
const tableWidth = ref(800)
const tableHeight = ref(400)
let ro: ResizeObserver | null = null

/** 涨红跌绿：中国股市约定（涨→红 / 跌→绿） */
const UP = '#e63946'
const DOWN = '#2ea043'

function baseSymbol(symbol: string): string {
  return (symbol || '').split('.')[0] || symbol
}
function colorFor(v?: number): string | undefined {
  if (v == null) return undefined
  if (v > 0) return UP
  if (v < 0) return DOWN
  return undefined
}
function fmtPrice(v?: number): string {
  return v == null ? '-' : v.toFixed(2)
}
function fmtSigned(v?: number): string {
  if (v == null) return '-'
  return (v >= 0 ? '+' : '') + v.toFixed(2)
}
function fmtPct(v?: number): string {
  if (v == null) return '-'
  return (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(2) + '%'
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

/** 除「名称」「操作」外的固定列宽之和；名称列动态填充剩余宽度 */
const FIXED_W = 110 + 100 + 105 + 105 + 90 + 120 + 130 + 95 + 80 // = 935

const columns = computed<Column[]>(() => {
  const nameW = Math.max(120, tableWidth.value - FIXED_W)
  return [
    {
      key: 'symbol',
      title: '代码',
      dataKey: 'symbol',
      width: 110,
      cellRenderer: ({ rowData }) => h('span', { class: 'cell-symbol' }, rowData.symbol),
    },
    {
      key: 'name',
      title: '名称',
      dataKey: 'name',
      width: nameW,
      cellRenderer: ({ rowData }) =>
        h('span', { class: 'cell-name', title: rowData.name }, rowData.name || baseSymbol(rowData.symbol)),
    },
    {
      key: 'last_price',
      title: '现价',
      dataKey: 'last_price',
      width: 100,
      align: 'right',
      cellRenderer: ({ rowData }) =>
        h('span', { style: { color: colorFor(rowData.last_price) } }, fmtPrice(rowData.last_price)),
    },
    {
      key: 'change_amount',
      title: '涨跌额',
      dataKey: 'change_amount',
      width: 105,
      align: 'right',
      cellRenderer: ({ rowData }) =>
        h('span', { style: { color: colorFor(rowData.change_amount) } }, fmtSigned(rowData.change_amount)),
    },
    {
      key: 'change_pct',
      title: '涨跌幅',
      dataKey: 'change_pct',
      width: 105,
      align: 'right',
      cellRenderer: ({ rowData }) =>
        h('span', { style: { color: colorFor(rowData.change_pct) } }, fmtPct(rowData.change_pct)),
    },
    {
      key: 'amplitude',
      title: '振幅',
      dataKey: 'amplitude',
      width: 90,
      align: 'right',
      cellRenderer: ({ rowData }) =>
        h('span', {}, rowData.amplitude == null ? '-' : rowData.amplitude.toFixed(2) + '%'),
    },
    {
      key: 'volume',
      title: '成交量',
      dataKey: 'volume',
      width: 120,
      align: 'right',
      cellRenderer: ({ rowData }) => h('span', {}, fmtVolume(rowData.volume)),
    },
    {
      key: 'amount',
      title: '成交额',
      dataKey: 'amount',
      width: 130,
      align: 'right',
      cellRenderer: ({ rowData }) => h('span', {}, fmtAmount(rowData.amount)),
    },
    {
      key: 'turnover_rate',
      title: '换手率',
      dataKey: 'turnover_rate',
      width: 95,
      align: 'right',
      cellRenderer: ({ rowData }) =>
        h('span', {}, rowData.turnover_rate == null ? '-' : rowData.turnover_rate.toFixed(2) + '%'),
    },
    {
      key: 'op',
      title: '操作',
      dataKey: 'op',
      width: 80,
      align: 'center',
      cellRenderer: ({ rowData }) =>
        h(
          'button',
          {
            class: 'rm-btn',
            title: '移出自选股',
            // 阻止冒泡，避免触发整行下钻
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              onRemove(rowData.symbol)
            },
          },
          '移除',
        ),
    },
  ]
})

/** 点击行下钻到「股票查询分析」 */
const rowEventHandlers = {
  onClick: ({ rowData }: { rowData: WatchRow }) => {
    const symbol = rowData?.symbol
    if (!symbol) return
    emit('drill', symbol)
  },
}

/** 批量拉取实时行情并按 symbol 建索引 */
async function loadQuotes() {
  const syms = watch.items.value.map((i) => i.symbol)
  if (!syms.length) {
    quoteMap.value = {}
    return
  }
  loading.value = true
  try {
    const list = await getQuotesBatch(syms)
    const map: Record<string, Quote> = {}
    for (const q of list) map[q.symbol] = q
    quoteMap.value = map
  } catch (e) {
    ElMessage.error('批量获取实时行情失败：' + (e instanceof Error ? e.message : '未知错误'))
  } finally {
    loading.value = false
  }
}

async function refresh() {
  await watch.load()
  await loadQuotes()
}

async function onRemove(symbol: string) {
  try {
    await watch.remove(symbol)
    ElMessage.success(`已移出自选股：${symbol}`)
    // 列表已随 store 更新；顺手刷新行情索引，避免残留
    delete quoteMap.value[symbol]
    quoteMap.value = { ...quoteMap.value }
  } catch (e) {
    ElMessage.error('移出自选股失败：' + (e instanceof Error ? e.message : '未知错误'))
  }
}

function measure() {
  const el = wrapRef.value
  if (!el) return
  tableHeight.value = Math.max(200, el.clientHeight)
  tableWidth.value = Math.max(320, el.clientWidth)
}

onMounted(async () => {
  if (!watch.loaded.value) await watch.load()
  await loadQuotes()
  if (wrapRef.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(wrapRef.value)
    measure()
  }
  // 自选股列表变动（如从详情头部按钮加入）时，补充拉取行情
  vueWatch(
    () => watch.items.value.map((i) => i.symbol).join(','),
    () => loadQuotes(),
  )
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})
</script>

<style scoped lang="scss">
.watchlist {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;

  .wl-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    flex-shrink: 0;

    .wl-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .wl-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .refresh-btn {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;

      &:hover:not(:disabled) {
        background: var(--bg-hover, rgba(0, 0, 0, 0.05));
        color: var(--color-primary);
      }
      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .spinning {
        animation: wl-spin 0.8s linear infinite;
      }
    }
  }

  .wl-loading,
  .wl-empty {
    color: var(--text-muted);
    font-size: 0.88rem;
    padding: 24px 0;
    text-align: center;
  }

  .wl-table-wrap {
    flex: 1;
    min-height: 0;
  }

  .muted {
    color: var(--text-muted);
  }

  :deep(.rm-btn) {
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.78rem;
    padding: 3px 10px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;

    &:hover {
      color: #e63946;
      border-color: #e63946;
      background: rgba(230, 57, 70, 0.06);
    }
  }
}

@keyframes wl-spin {
  to { transform: rotate(360deg); }
}

.cell-symbol {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.cell-name {
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 100%;
}
</style>
