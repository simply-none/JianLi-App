<!--
 * 股票 - 小窗口（薄壳）
 * 复用 StockSinglePanel 的 compact 模式；结构与「记账小窗口」一致：
 * 鼠标穿透控制、双击换肤、关闭按钮。窗口名为 stockMini（与路由 hash 对应）。
 * 额外点：记账靠共享 store 自带数据，而股票小窗需要「看哪只票」，
 * 故在薄壳内置一个紧凑代码输入框，并把代码持久化到 window-mode:stockMini.symbol。
-->
<template>
  <div class="stock-mini-window" @dblclick="cycleTheme">
    <div class="mouse-controls">
      <div class="mouse-left" @mousemove="disableMouseClickThroughFn"></div>
      <div class="mouse-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>

    <div class="content-area">
      <div class="mini-header">
        <span class="mini-title">股票行情</span>
        <div class="mini-actions">
          <button class="header-btn" @click.stop="cycleTheme" title="切换主题">
            <LucideIcon name="Palette" :size="14" />
          </button>
          <button class="header-btn" @click.stop="closeWindow" title="关闭">
            <LucideIcon name="X" :size="14" />
          </button>
        </div>
      </div>

      <div class="mini-query">
        <el-input
          v-model="symbolInput"
          size="small"
          placeholder="输入代码，如 600000.SH"
          clearable
          @keyup.enter="applySymbol"
        >
          <template #append>
            <el-button @click="applySymbol">查看</el-button>
          </template>
        </el-input>
      </div>

      <div class="mini-body">
        <StockSinglePanel
          v-if="symbol"
          :symbol="symbol"
          :quote="quote"
          :instrument="instrument"
          :loading-quote="loadingQuote"
          compact
        />
        <div v-else class="mini-empty">
          <LucideIcon name="Search" :size="32" color="var(--text-muted)" />
          <p>输入股票代码查看行情</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import StockSinglePanel from '@/views/stock/components/StockSinglePanel.vue'
import useWindowMode from '@/store/useWindowMode'
import { getQuotes, getInstruments } from '@/views/stock/api'
import type { Quote, Instrument } from '@/views/stock/types'

const STORE_KEY = 'window-mode:stockMini'
const WIN_NAME = 'stockMini'

const symbolInput = ref('')
const symbol = ref('')
const quote = ref<Quote | undefined>(undefined)
const instrument = ref<Instrument | undefined>(undefined)
const loadingQuote = ref(false)

const themes = [
  'coral', 'mint', 'sky', 'lavender', 'sakura',
  'amber', 'white', 'dark', 'gray', 'aurora',
]

const applyTheme = (theme: string) => {
  if (theme === 'white') {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', theme)
  }
}

const saveConfig = (key: string, value: string) => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', STORE_KEY)
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {})
    config[key] = value
    window.ipcRenderer.sendSync('set-store', STORE_KEY, config)
    window.ipcRenderer.send('sync-data-to-other-window', {
      stockMiniWindowConfig: { ...config },
    })
  } catch (e) {
    console.log('保存股票小窗配置失败:', e)
  }
}

const loadConfig = () => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', STORE_KEY)
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {})
    if (config.skin) applyTheme(config.skin)
    if (config.symbol) {
      symbolInput.value = config.symbol
      symbol.value = config.symbol
    }
  } catch (e) {
    console.log('加载股票小窗配置失败:', e)
  }
}

const cycleTheme = () => {
  const currentSkin = document.documentElement.getAttribute('data-skin') || 'white'
  const idx = themes.indexOf(currentSkin)
  const nextTheme = themes[(idx + 1) % themes.length]
  applyTheme(nextTheme)
  saveConfig('skin', nextTheme)
}

const closeWindow = () => {
  // 通过 windowMode store 关闭，保持设置页开关状态一致（会发送 close-new-window）
  useWindowMode().setShowStockMiniWindow(false)
}

const enableMouseClickThroughFn = () => {
  window.ipcRenderer.send('enable-mouse-click-through', WIN_NAME)
}
const disableMouseClickThroughFn = () => {
  window.ipcRenderer.send('disable-mouse-click-through', WIN_NAME)
}

async function loadQuote() {
  if (!symbol.value) return
  loadingQuote.value = true
  quote.value = undefined
  try {
    const list = await getQuotes(symbol.value)
    const hit = list.find((q) => q.symbol.toUpperCase() === symbol.value.toUpperCase())
    quote.value = hit || list[0]
  } catch {
    // 行情失败不影响 K 线/分析展示
    quote.value = undefined
  } finally {
    loadingQuote.value = false
  }
}

/** 并行获取标的元数据（走天级缓存，同一标的当天只回源一次） */
async function loadInstrument() {
  if (!symbol.value) return
  try {
    const list = await getInstruments(symbol.value)
    const hit = list.find((i) => i.symbol.toUpperCase() === symbol.value.toUpperCase())
    instrument.value = hit || list[0]
  } catch {
    // 元数据失败不影响行情/K线展示
    instrument.value = undefined
  }
}

function applySymbol() {
  const s = symbolInput.value.trim()
  if (!s) return
  symbol.value = s
  saveConfig('symbol', s)
  loadQuote()
  loadInstrument()
}

// 接收其它窗口同步过来的皮肤/查询配置
window.ipcRenderer.on('sync-data-to-other-window', (event: any, arg: any) => {
  if (arg && arg.stockMiniWindowConfig && arg.stockMiniWindowConfig.skin) {
    applyTheme(arg.stockMiniWindowConfig.skin)
  }
  // 主页面查询后同步过来的「上一次查询」：更新展示标的
  if (arg && arg.stockMiniWindowConfig && arg.stockMiniWindowConfig.symbol) {
    const s = String(arg.stockMiniWindowConfig.symbol).trim()
    // 与当前相同则跳过，避免自身广播/收敛回环导致的重复拉取
    if (s && s !== symbol.value) {
      symbolInput.value = s
      symbol.value = s
      loadQuote()
      loadInstrument()
    }
  }
})

onMounted(() => {
  loadConfig()
  if (symbol.value) {
    loadQuote()
    loadInstrument()
  }
})
</script>

<style lang="scss" scoped>
.stock-mini-window {
  -webkit-user-select: none;
  user-select: none;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 8px;
  background: var(--skin-bg);
  border-radius: 0.8em;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  font-size: clamp(12px, 3vmin, 16px);
  border: 1px solid var(--skin-border);

  .mouse-controls {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;

    .mouse-left,
    .mouse-right {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 8%;
      max-width: 16px;
      min-width: 8px;
      pointer-events: auto;
      cursor: default;
    }
    .mouse-left { left: 0; }
    .mouse-right { right: 0; }
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    z-index: 1;
    min-height: 0;
  }

  .mini-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 26px;
    flex-shrink: 0;
    -webkit-app-region: drag;
    cursor: default;

    .mini-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--skin-text-primary);
    }
    .mini-actions {
      display: flex;
      gap: 4px;
      -webkit-app-region: no-drag;
    }
    .header-btn {
      -webkit-app-region: no-drag;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--skin-text-secondary);
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      &:hover {
        background: var(--skin-btn-hover);
        color: var(--skin-text-primary);
      }
    }
  }

  .mini-query {
    flex-shrink: 0;
    margin: 6px 0 8px;
    -webkit-app-region: no-drag;
  }

  .mini-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .mini-empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--text-muted);
    font-size: 0.85rem;
  }
}
</style>
