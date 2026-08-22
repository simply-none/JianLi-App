<template>
  <div class="stock-page">
    <!-- 未配置 API Key：整个页面只展示输入 Key 的功能 -->
    <ApiKeySetup v-if="keyStatus === 'missing'" @done="onKeySaved" />

    <!-- 加载中：正在检查 Key 配置 -->
    <div v-else-if="keyStatus === 'loading'" class="page-loading">
      <span>正在检查 TickFlow API Key 配置…</span>
    </div>

    <!-- 已配置：完整页面（上 Tab / 中内容区 / 下查询栏） -->
    <template v-else>
      <div class="page-tabs">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="股票查询分析" name="analyze" />
          <el-tab-pane label="市场总览" name="market" />
          <el-tab-pane label="常用" name="favorites" />
        </el-tabs>
        <button class="reconfig-btn" title="股票设置" @click="showSettings = true">
          <LucideIcon name="Settings" :size="16" />
        </button>
      </div>

      <StockSettings v-model="showSettings" />

      <div class="page-content">
        <StockContentPanel v-if="activeTab === 'analyze'" :symbols="symbols" />
        <MarketOverview
          v-else-if="activeTab === 'market'"
          @drill="onDrillFromMarket"
        />
        <StockFavorites
          v-else-if="activeTab === 'favorites'"
          @drill="onDrillFromMarket"
        />
      </div>

      <!-- 从「市场总览」下钻到个股分析后的返回提示（仅在分析 Tab 且来自总览时显示） -->
      <div v-if="activeTab === 'analyze' && drilledFromMarket" class="back-bar">
        <button class="back-btn" @click="activeTab = 'market'">
          <LucideIcon name="ArrowLeft" :size="14" /> 返回市场总览
        </button>
        <span class="back-hint">正在查看：{{ symbols[0] }}</span>
      </div>

      <StockQueryBar :loading="querying" :default-text="lastQueryText" @search="onSearch" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import StockQueryBar from './components/StockQueryBar.vue'
import StockContentPanel from './components/StockContentPanel.vue'
import MarketOverview from './components/MarketOverview.vue'
import ApiKeySetup from './components/ApiKeySetup.vue'
import StockSettings from './components/StockSettings.vue'
import StockFavorites from './components/StockFavorites.vue'
import { getApiKey } from './api'
import { getStore, setStore, send } from '@/utils/common'

type KeyStatus = 'loading' | 'missing' | 'ready'

/** 持久化上一次查询的存储键 */
const LAST_QUERY_KEY = 'stock:lastQuery'

/** 进入页面时恢复上一次查询的标的（同步读取，setup 阶段即可就绪） */
const saved = getStore(LAST_QUERY_KEY)
const initialSymbols =
  saved && Array.isArray((saved as { symbols?: unknown }).symbols)
    ? ((saved as { symbols: string[] }).symbols)
    : []

const activeTab = ref('analyze')
const symbols = ref<string[]>(initialSymbols)
const lastQueryText = ref(initialSymbols.join(', '))
const querying = ref(false)
/** 是否从「市场总览」下钻而来（用于展示返回栏） */
const drilledFromMarket = ref(false)

const keyStatus = ref<KeyStatus>('loading')
/** 股票设置对话框可见性（右上角「设置」按钮） */
const showSettings = ref(false)

/** 保存成功后：关闭弹窗并进入/刷新页面 */
function onKeySaved() {
  keyStatus.value = 'ready'
}

onMounted(async () => {
  try {
    const key = await getApiKey()
    keyStatus.value = key ? 'ready' : 'missing'
  } catch {
    // 读取失败视为未配置，展示输入界面
    keyStatus.value = 'missing'
  }
})

/** 保存成功后：关闭弹窗并进入/刷新页面 */
function onSearch(list: string[]) {
  querying.value = true
  // 内容区数据由各卡片自行拉取；这里仅更新标的列表
  symbols.value = list
  lastQueryText.value = list.join(', ')
  drilledFromMarket.value = false
  // 持久化上一次查询，下次进入默认展示
  setStore(LAST_QUERY_KEY, { symbols:  list })
  // 同步上一次查询给股票小窗口（持久化 + 实时推送）
  syncLastQueryToMini(list)
  // 短暂标记以便 UX 反馈（实际加载在各卡片内完成）
  setTimeout(() => (querying.value = false), 300)
}

/** 从「市场总览」点击某只股票下钻：切换到分析 Tab 并展示该标的 */
function onDrillFromMarket(symbol: string) {
  symbols.value = [symbol]
  drilledFromMarket.value = true
  activeTab.value = 'analyze'
}

/**
 * 把上一次查询同步给股票小窗口：
 * 1) 持久化到小窗口配置（window-mode:stockMini.symbol），下次打开/重载即生效；
 * 2) 若小窗口已打开，实时推送使其立即切换展示。
 * 小窗口为单标的展示，故取批量查询中的第一个代码同步。
 */
function syncLastQueryToMini(symbols: string[]) {
  const first = (symbols[0] || '').trim()
  if (!first) return

  // 1) 持久化（仅值变化时写库，减少无意义写入）
  try {
    const raw = getStore('window-mode:stockMini')
    const cfg = raw && typeof raw === 'string' ? JSON.parse(raw) : (raw || {})
    if (cfg.symbol !== first) {
      cfg.symbol = first
      setStore('window-mode:stockMini', cfg)
    }
  } catch (e) {
    console.warn('同步上一次查询到小窗口配置失败:', e)
  }

  // 2) 实时推送给已打开的小窗口（主进程只转发给非发送方窗口，无自回环）
  send('sync-data-to-other-window', { stockMiniWindowConfig: { symbol: first } })
}
</script>

<style scoped lang="scss">
.stock-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  border-radius: var(--radius-card);
  overflow: hidden;

  .page-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .page-tabs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px 0;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-subtle);

    :deep(.el-tabs__header) {
      margin-bottom: 0;
      flex: 1;
    }

    .reconfig-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      margin-bottom: 8px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--bg-hover, rgba(0, 0, 0, 0.05));
        color: var(--color-primary);
      }
    }
  }

  .page-content {
    flex: 1;
    min-height: 0;
    padding: 16px;
    overflow: hidden;
  }

  .back-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: var(--bg-card);
    border-top: 1px solid var(--border-subtle);

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      background: transparent;
      color: var(--color-primary);
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: var(--bg-hover, rgba(0, 0, 0, 0.05));
      }
    }

    .back-hint {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
  }
}
</style>
