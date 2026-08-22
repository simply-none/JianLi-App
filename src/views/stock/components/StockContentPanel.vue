<template>
  <div class="stock-content-panel">
    <!-- 单标的：顶部固定股票名 -->
    <template v-if="symbols.length === 1">
      <StockSinglePanel
        :symbol="symbols[0]"
        :quote="quoteMap[symbols[0]]"
        :instrument="instrumentMap[symbols[0]]"
        :loading-quote="loadingQuote"
      />
    </template>

    <!-- 多标的：顶部 Tab 切换 -->
    <template v-else-if="symbols.length > 1">
      <el-tabs v-model="active" class="stock-tabs">
        <el-tab-pane v-for="s in symbols" :key="s" :label="s" :name="s">
          <StockSinglePanel
            :symbol="s"
            :quote="quoteMap[s]"
            :instrument="instrumentMap[s]"
            :loading-quote="loadingQuote"
          />
        </el-tab-pane>
      </el-tabs>
    </template>

    <!-- 空态 -->
    <template v-else>
      <div class="empty-state">
        <LucideIcon name="Search" :size="40" color="var(--text-muted)" />
        <p>在下方查询栏输入股票代码开始分析</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { Quote, Instrument } from '../types'
import { getQuotes, getInstrumentsBatch } from '../api'
import StockSinglePanel from './StockSinglePanel.vue'

const props = defineProps<{
  symbols: string[]
}>()

const active = ref('')
const quoteMap = ref<Record<string, Quote>>({})
const instrumentMap = ref<Record<string, Instrument>>({})
const loadingQuote = ref(false)

async function loadQuotes() {
  if (!props.symbols.length) return
  const symbolsStr = props.symbols.join(',')
  loadingQuote.value = true
  try {
    // 实时行情与标的元数据并行获取（元数据走天级缓存，同一标的当天只回源一次）
    const [list, instruments] = await Promise.all([
      getQuotes(symbolsStr),
      getInstrumentsBatch(props.symbols),
    ])
    const qMap: Record<string, Quote> = {}
    for (const q of list) qMap[q.symbol] = q
    quoteMap.value = qMap

    const iMap: Record<string, Instrument> = {}
    for (const inst of instruments) iMap[inst.symbol] = inst
    instrumentMap.value = iMap
  } catch (err) {
    // 行情/元数据失败不影响 K 线/分析展示
    quoteMap.value = {}
    instrumentMap.value = {}
  } finally {
    loadingQuote.value = false
  }
}

watch(
  () => props.symbols.join(','),
  () => {
    active.value = props.symbols[0] || ''
    loadQuotes()
  },
  { immediate: true },
)

onMounted(() => {
  active.value = props.symbols[0] || ''
})
</script>

<style scoped lang="scss">
.stock-content-panel {
  height: 100%;
  overflow-y: auto;

  .stock-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 12px;
    }
  }

  .empty-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-muted);
    font-size: 0.95rem;
  }
}
</style>
