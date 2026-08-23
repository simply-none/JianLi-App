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
     <div class="row-count">共 {{ visibleRows.length }} 条标的</div>

        <el-table-v2
          v-if="rows.length"
          :columns="columns"
          :data="visibleRows"
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

    <!-- 右键上下文菜单（加入自选股 / 进入分析） -->
    <div
      v-if="menu.visible"
      class="ctx-menu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop
    >
      <div class="ctx-item" @click="menuAddToWatchlist">
        <LucideIcon name="Star" :size="14" />
        <span>加入自选股</span>
      </div>
      <div class="ctx-item" @click="menuDrill">
        <LucideIcon name="ArrowRight" :size="14" />
        <span>进入分析</span>
      </div>
    </div>

    <!-- 类型过滤浮层（点击「类型」列表头漏斗图标弹出，多选过滤标的类型） -->
    <div
      v-if="typeFilter.visible"
      class="type-filter"
      :style="{ left: typeFilter.x + 'px', top: typeFilter.y + 'px' }"
      @click.stop
    >
      <div class="tf-item tf-all" :class="{ on: !activeTypes.length }" @click="clearTypeFilter">
        全部类型
      </div>
      <div
        v-for="t in availableTypes"
        :key="t"
        class="tf-item"
        :class="{ on: activeTypes.includes(t) }"
        @click="toggleType(t)"
      >
        <span>{{ t }}</span>
        <span v-if="activeTypes.includes(t)" class="tf-check">✓</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch, h, computed } from 'vue'
import { ElTableV2, ElMessage } from 'element-plus'
import type { Column, SortState, ColumnSortParams } from 'element-plus'
import { TableV2SortOrder } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import { getExchanges, getExchangeInstruments, getQuotesBatch } from '../api'
import { useWatchlistStore } from '../watchlistStore'
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

/** 类型过滤：el-table-v2 不原生支持表头过滤，这里用自定义表头 + 浮层实现多选过滤 */
const activeTypes = ref<string[]>([]) // 空数组 = 全部类型
const typeFilter = ref<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 })

/** 当前交易所标的中出现的全部类型（去重），用于过滤浮层选项 */
const availableTypes = computed<string[]>(() => {
  const set = new Set<string>()
  for (const r of rows.value) if (r.type) set.add(r.type)
  return Array.from(set)
})

/** 在「排序后」数据基础上叠加类型过滤 */
const visibleRows = computed<Row[]>(() => {
  const base = displayRows.value
  if (!activeTypes.value.length) return base
  const set = new Set(activeTypes.value)
  return base.filter((r) => set.has(r.type))
})

function openTypeFilter(e: MouseEvent) {
  typeFilter.value = { visible: true, x: e.clientX, y: e.clientY }
}
function closeTypeFilter() {
  typeFilter.value.visible = false
}
function toggleType(t: string) {
  const arr = activeTypes.value
  const i = arr.indexOf(t)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(t)
  // 重新赋值以触发响应式刷新
  activeTypes.value = [...arr]
}
function clearTypeFilter() {
  activeTypes.value = []
}

/** 点击某一行下钻到「股票查询分析」页面（el-table-v2 通过 row-event-handlers 绑定，非 @row-click） */
const rowEventHandlers = {
  onClick: ({ rowData }: { rowData: Row }) => {
    const symbol = rowData?.symbol
    if (!symbol) return
    emit('drill', symbol)
  },
  onContextmenu: (params: any) => {
    const rowData: Row | undefined = params?.rowData
    const event: MouseEvent | undefined = params?.event
    if (!rowData?.symbol || !event) return
    event.preventDefault()
    openMenu(event, rowData)
  },
}

/** 右键上下文菜单（加入自选股 / 进入分析） */
const watchStore = useWatchlistStore()
const menu = ref<{ visible: boolean; x: number; y: number; row: Row | null }>({
  visible: false,
  x: 0,
  y: 0,
  row: null,
})

function openMenu(e: MouseEvent, row: Row) {
  menu.value = { visible: true, x: e.clientX, y: e.clientY, row }
}
function closeMenu() {
  menu.value.visible = false
}
async function menuAddToWatchlist() {
  const r = menu.value.row
  if (r) {
    try {
      await watchStore.add({ symbol: r.symbol, name: r.name, exchange: r.exchange, region: r.region, type: r.type })
      ElMessage.success(`已加入自选股：${r.symbol}`)
    } catch (e) {
      ElMessage.error('加入自选股失败：' + (e instanceof Error ? e.message : '未知错误'))
    }
  }
  closeMenu()
}
function menuDrill() {
  const r = menu.value.row
  if (r) emit('drill', r.symbol)
  closeMenu()
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
function exchangeLabel(ex?: string): string {
  if (!ex) return '-'
  const map: Record<string, string> = {
    SH: '上交所', SSE: '上交所',
    SZ: '深交所', SZSE: '深交所',
    BJ: '北交所', BSE: '北交所',
    HK: '港交所', HKEX: '港交所',
    US: '美股', NASDAQ: '纳斯达克', NYSE: '纽交所',
    TW: '台交所', TSE: '台交所',
    JP: '日本', TYO: '东京证交所',
    LON: '伦交所', LSE: '伦交所',
    SG: '新加坡', SGX: '新加坡',
  }
  return map[ex] || ex
}
function regionLabel(rg?: string): string {
  if (!rg) return '-'
  const map: Record<string, string> = {
    cn: '中国', CN: '中国', china: '中国',
    us: '美国', US: '美国', usa: '美国',
    hk: '香港', HK: '香港',
    tw: '台湾', TW: '台湾',
    jp: '日本', JP: '日本',
    uk: '英国', UK: '英国',
    sg: '新加坡', SG: '新加坡',
  }
  return map[rg] || rg
}

/** 批量拉取实时行情并按 symbol 建索引（getQuotesBatch 内部已按 TickFlow 单次≤5 自动分批） */
async function loadQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const map: Record<string, Quote> = {}
  try {
    const list = await getQuotesBatch(symbols)
    for (const q of list) map[q.symbol] = q
  } catch {
    // 批量失败不影响静态数据展示
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
    cellRenderer: ({ rowData }) => h('span', exchangeLabel(rowData.exchange)),
  },
  {
    key: 'region',
    title: '地区',
    dataKey: 'region',
    width: 90,
    sortable: true,
    cellRenderer: ({ rowData }) => h('span', regionLabel(rowData.region)),
  },
  {
    key: 'type',
    title: '类型',
    dataKey: 'type',
    width: 110,
    sortable: true,
    headerCellRenderer: () => {
      const active = activeTypes.value.length > 0
      return h('div', { class: 'type-header' }, [
        h('span', { class: 'th-title' }, '类型'),
        h(
          'span',
          {
            class: 'filter-icon',
            title: active ? '按类型过滤（已筛选）' : '按类型过滤',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              e.preventDefault()
              openTypeFilter(e)
            },
          },
          h(LucideIcon, {
            name: 'Filter',
            size: 13,
            color: active ? 'var(--color-primary)' : 'var(--text-muted)',
          }),
        ),
      ])
    },
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
/** 关闭右键菜单 / 类型过滤浮层（点击页面其它位置时） */
function onWindowClick() {
  if (menu.value.visible) closeMenu()
  if (typeFilter.value.visible) closeTypeFilter()
}
onMounted(async () => {
  measure()
  ro = new ResizeObserver(measure)
  if (rootRef.value) ro.observe(rootRef.value)
  window.addEventListener('click', onWindowClick)
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
  window.removeEventListener('click', onWindowClick)
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

  .row-count {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 0 2px 6px;
  }

  /* 类型列表头的自定义渲染：标题 + 漏斗过滤图标 */
  .type-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    width: 100%;
    height: 100%;
    padding: 0 10px;
    box-sizing: border-box;

    .th-title {
      font-weight: 600;
    }
    .filter-icon {
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      line-height: 1;
    }
  }

  /* 类型过滤浮层 */
  .type-filter {
    position: fixed;
    z-index: 9999;
    min-width: 130px;
    max-height: 300px;
    overflow-y: auto;
    padding: 4px;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-subtle, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);

    .tf-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.85rem;
      color: var(--text-primary);
      cursor: pointer;
      transition: background 0.12s;

      &:hover {
        background: var(--bg-hover, rgba(0, 0, 0, 0.05));
      }
      &.on {
        color: var(--color-primary);
        font-weight: 600;
      }
      &.tf-all {
        border-bottom: 1px solid var(--border-subtle, #eee);
        border-radius: 0;
        margin-bottom: 2px;
      }
      .tf-check {
        font-size: 0.8rem;
      }
    }
  }

  /* 右键上下文菜单 */
  .ctx-menu {
    position: fixed;
    z-index: 9999;
    min-width: 140px;
    padding: 4px;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-subtle, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);

    .ctx-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 0.85rem;
      color: var(--text-primary);
      cursor: pointer;
      transition: background 0.12s;

      &:hover {
        background: var(--bg-hover, rgba(0, 0, 0, 0.05));
        color: var(--color-primary);
      }
    }
  }
}
</style>
