<template>
  <div class="market-overview" ref="rootRef">
    <!-- 交易所切换 Tab（标题由交易所代码 + 标的数量组成） -->
    <el-tabs v-model="activeExchange" class="exchange-tabs" @tab-change="onExchangeChange">
      <el-tab-pane
        v-for="ex in exchanges"
        :key="ex.exchange"
        :label="`${ex.exchange} (${ex.count})`"
        :name="ex.exchange"
      />
    </el-tabs>

    <!-- 加载态 -->
    <div v-if="loadingExchanges" class="ov-loading">
      <span>正在加载交易所列表…</span>
    </div>

    <!-- 错误态 -->
    <div v-else-if="exchangeError" class="ov-error">
      <LucideIcon name="AlertCircle" :size="32" color="var(--text-muted)" />
      <p>{{ exchangeError }}</p>
    </div>

    <!-- 虚拟表格：交易所下全部股票 -->
    <div v-else class="table-wrap" :style="{ height: tableHeight + 'px' }">
     <div>{{ rows.length }}</div>

        <el-table-v2
          v-if="rows.length"
          :columns="columns"
          :data="displayRows"
          :width="tableWidth"
          :height="tableHeight"
          :row-height="44"
          :estimated-row-height="44"
          :cache="12"
          :scrollbar-always-on="true"
          :sort-state="sortState"
          @column-sort="onColumnSort"
          :row-event-handlers="rowEventHandlers"
        >
        <template #empty>
          <span class="muted">该交易所暂无标的</span>
        </template>
      </el-table-v2>

      <div v-else class="ov-loading">
        <span>{{ loadingInstruments ? '正在加载标的列表…' : '该交易所暂无标的' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch, h, computed } from 'vue'
import { ElTableV2 } from 'element-plus'
import type { Column, SortState, ColumnSortParams } from 'element-plus'
import { TableV2SortOrder } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import { getExchanges, getExchangeInstruments, getQuotesBatch } from '../api'
import type { Instrument, Quote, ExchangeInfo } from '../types'

const emit = defineEmits<{
  /** 点击某只股票下钻到「股票查询分析」 */
  (e: 'drill', symbol: string): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const tableHeight = ref(400)
const tableWidth = ref(800)

const exchanges = ref<ExchangeInfo[]>([])
const activeExchange = ref('')
const exchangeError = ref('')
const loadingExchanges = ref(true)

const loadingInstruments = ref(false)
const rows = ref<Row[]>([])

/** 排序状态：受控排序（el-table-v2 约定，键为列 key，值为 'asc' / 'desc'；空对象表示不排序） */
const sortState = ref<SortState>({})

/** 按当前排序状态对 rows 派生出排序后的展示数据 */
const displayRows = computed<Row[]>(() => {
  const entries = Object.entries(sortState.value)
  if (!entries.length) return rows.value
  const [key, order] = entries[0]
  const copy = [...rows.value]
  copy.sort((a, b) => {
    const av = (a as Record<string, unknown>)[key]
    const bv = (b as Record<string, unknown>)[key]
    // null / undefined 永远排在末尾，与排序方向无关
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return - 1
    let cmp: number
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), 'zh-CN')
    }
    return order === 'asc' ? cmp : -cmp
  })
  return copy
})

/** 列头点击排序：升序 → 降序 → 取消 三者循环 */
function onColumnSort({ key }: ColumnSortParams<Row>) {
  if (!key) return
  const cur = sortState.value[key]
  if (!cur) {
    sortState.value = { [key]: TableV2SortOrder.ASC }
  } else if (cur === TableV2SortOrder.ASC) {
    sortState.value = { [key]: TableV2SortOrder.DESC }
  } else {
    // 已降序：再次点击取消排序（恢复原始顺序）
    sortState.value = {}
  }
}

/** 点击某一行下钻到「股票查询分析」页面（el-table-v2 通过 row-event-handlers 绑定，非 @row-click） */
const rowEventHandlers = {
  onClick: ({ rowData }: { rowData: Row }) => {
    const symbol = rowData?.symbol
    if (!symbol) return
    emit('drill', symbol)
  },
}

/** 已加载的交易所数据缓存（交易所列表一周缓存，单次会话内避免重复拉取） */
const loadedMap = new Map<string, Row[]>()
/** 进行中的请求（按交易所），避免并发重复回源（mount 设置 v-model 与 tab-change 可能引发双发） */
const pendingMap = new Map<string, Promise<void>>()

interface Row {
  symbol: string
  name: string
  exchange: string
  region: string
  type: string
  lastPrice: number | null
  changePercent: number | null
  volume: number | null
  amount: number | null
}

/** 涨红跌绿：中国股市约定（涨→红 / 跌→绿） */
const UP = '#e63946'
const DOWN = '#2ea043'

function fmtPrice(v: number | null): string {
  return v == null ? '-' : v.toFixed(2)
}
function fmtVolume(v: number | null): string {
  if (v == null) return '-'
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万'
  return String(v)
}
function fmtAmount(v: number | null): string {
  if (v == null) return '-'
  if (v >= 1e8) return '¥' + (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return '¥' + (v / 1e4).toFixed(2) + '万'
  return '¥' + v.toFixed(2)
}
function typeLabel(t?: string): string {
  if (!t) return '-'
  const map: Record<string, string> = {
    stock: '股票', index: '指数', etf: 'ETF', bond: '债券',
    fund: '基金', options: '期权', other: '其他',
    cn_equity: 'A股', us_equity: '美股', hk_equity: '港股',
  }
  return map[t] || t
}

/** 批量拉取实时行情并按 symbol 建索引（TickFlow 单次最多 1000，分批） */
async function loadQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const map: Record<string, Quote> = {}
  const BATCH = 1000
  for (let i = 0; i < symbols.length; i += BATCH) {
    const slice = symbols.slice(i, i + BATCH)
    try {
      const list = await getQuotesBatch(slice)
      for (const q of list) map[q.symbol] = q
    } catch {
      // 单批失败不影响其余批次与静态数据展示
    }
  }
  return map
}

function mergeQuoteInto(rowsData: Instrument[]): Row[] {
  return rowsData.map((inst) => ({
    symbol: inst.symbol,
    name: inst.name || '-',
    exchange: inst.exchange || activeExchange.value,
    region: inst.region || '-',
    type: typeLabel(inst.type || inst.ext?.type),
    lastPrice: null,
    changePercent: null,
    volume: null,
    amount: null,
  }))
}

/** 计算涨跌幅并填充行情字段 */
function applyQuotes(toRows: Row[], quotes: Record<string, Quote>) {
  for (const r of toRows) {
    const q = quotes[r.symbol]
    if (!q) continue
    r.lastPrice = q.last_price ?? null
    r.volume = q.volume ?? null
    r.amount = q.amount ?? null
    if (q.last_price != null && q.prev_close != null && q.prev_close) {
      r.changePercent = ((q.last_price - q.prev_close) / q.prev_close) * 100
    }
  }
}

async function loadExchange(exchange: string) {
  if (!exchange) return
  // 命中会话内缓存，直接复用
  if (loadedMap.has(exchange)) {
    rows.value = loadedMap.get(exchange)!
    return
  }
  // 并发去重：同一交易所正在请求中，复用同一个 Promise，避免双发
  const pending = pendingMap.get(exchange)
  if (pending) return pending
  loadingInstruments.value = true
  const task = (async () => {
    try {
      const resp = await getExchangeInstruments(exchange)
      const instruments: Instrument[] = resp?.data ?? []
      const merged = mergeQuoteInto(instruments)
      applyQuotes(merged, {})
      loadedMap.set(exchange, merged)
      rows.value = merged
    } catch (e) {
      rows.value = []
    } finally {
      loadingInstruments.value = false
      pendingMap.delete(exchange)
    }
  })()
  pendingMap.set(exchange, task)
  return task
}

async function onExchangeChange(name: string | number) {
  activeExchange.value = String(name)
  await loadExchange(activeExchange.value)
}

/** el-table-v2 列定义（涨红跌绿） */
const columns = computed<Column[]>(() => [
  {
    key: 'symbol',
    title: '代码',
    dataKey: 'symbol',
    width: 130,
    sortable: true,
    cellRenderer: ({ rowData }) => h('span', { class: 'cell-symbol' }, rowData.symbol),
  },
  {
    key: 'name',
    title: '名称',
    dataKey: 'name',
    width: 160,
    sortable: true,
    cellRenderer: ({ rowData }) => h('span', { class: 'cell-name', title: rowData.name }, rowData.name),
  },
  {
    key: 'exchange',
    title: '交易所',
    dataKey: 'exchange',
    width: 90,
    sortable: true,
  },
  {
    key: 'region',
    title: '地区',
    dataKey: 'region',
    width: 90,
    sortable: true,
  },
  {
    key: 'type',
    title: '类型',
    dataKey: 'type',
    width: 110,
    sortable: true,
  },
  {
    key: 'lastPrice',
    title: '最新价',
    dataKey: 'lastPrice',
    width: 110,
    sortable: true,
    cellRenderer: ({ rowData }) => {
      const v = rowData.lastPrice
      const up = v != null && rowData.changePercent != null && rowData.changePercent >= 0
      const down = v != null && rowData.changePercent != null && rowData.changePercent < 0
      const color = up ? UP : down ? DOWN : undefined
      return h('span', { style: { color } }, fmtPrice(v))
    },
  },
  {
    key: 'changePercent',
    title: '涨跌幅',
    dataKey: 'changePercent',
    width: 110,
    sortable: true,
    cellRenderer: ({ rowData }) => {
      const v = rowData.changePercent
      if (v == null) return h('span', { class: 'muted' }, '-')
      const color = v >= 0 ? UP : DOWN
      return h(
        'span',
        { style: { color } },
        `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(2)}%`,
      )
    },
  },
  {
    key: 'volume',
    title: '成交量',
    dataKey: 'volume',
    width: 120,
    sortable: true,
    cellRenderer: ({ rowData }) => h('span', {}, fmtVolume(rowData.volume)),
  },
  {
    key: 'amount',
    title: '成交额',
    dataKey: 'amount',
    width: 130,
    sortable: true,
    cellRenderer: ({ rowData }) => h('span', {}, fmtAmount(rowData.amount)),
  },
])

function measure() {
  const el = rootRef.value
  if (!el) return
  const tabsH = 48
  tableHeight.value = Math.max(200, el.clientHeight - tabsH)
  tableWidth.value = Math.max(320, el.clientWidth)
}

let ro: ResizeObserver | null = null
onMounted(async () => {
  measure()
  ro = new ResizeObserver(measure)
  if (rootRef.value) ro.observe(rootRef.value)
  try {
    const list = await getExchanges()
    exchanges.value = list || []
    if (exchanges.value.length) {
      activeExchange.value = exchanges.value[0].exchange
      await loadExchange(activeExchange.value)
    }
  } catch (e) {
    exchangeError.value = (e as { message?: string })?.message || '获取交易所列表失败'
  } finally {
    loadingExchanges.value = false
  }
})

onUnmounted(() => {
  if (ro) ro.disconnect()
})
</script>

<style scoped lang="scss">
.market-overview {
  height: 100%;
  display: flex;
  flex-direction: column;

  .exchange-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 8px;
    }
  }

  .table-wrap {
    flex: 1;
    min-height: 0;
  }

  .ov-loading,
  .ov-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .muted {
    color: var(--text-muted);
  }

  .cell-symbol {
    font-weight: 600;
    color: var(--text-primary);
  }
  .cell-name {
    color: var(--text-secondary, var(--text-primary));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
