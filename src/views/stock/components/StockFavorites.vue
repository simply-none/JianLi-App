<template>
  <div class="favorites">
    <div class="fav-header">
      <span class="fav-title">常用股票</span>
      <span class="fav-sub">从本地缓存中识别你最近查询过的标的（最多 {{ MAX }} 个）</span>
      <button class="refresh-btn" :disabled="loading" @click="load">
        <LucideIcon name="RefreshCw" :size="14" />
      </button>
    </div>

    <div v-if="loading" class="fav-loading">加载中…</div>

    <div v-else-if="items.length === 0" class="fav-empty">
      暂无常用股票。去「股票查询分析」搜索或查看某个标的，它就会出现在这里。
    </div>

    <div v-else class="fav-grid">
      <button
        v-for="item in items"
        :key="item.symbol"
        class="fav-item"
        :title="`查看 ${item.symbol} 分析`"
        @click="emit('drill', item.symbol)"
      >
        <LucideIcon name="TrendingUp" :size="14" class="fav-ico" />
        <span class="fav-sym">{{ labelOf(item.symbol, item.name) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { getRecentSymbols, getInstruments } from '../api'

const emit = defineEmits<{ (e: 'drill', symbol: string): void }>()

interface FavItem {
  symbol: string
  name: string
}

const MAX = 30
const items = ref<FavItem[]>([])
const loading = ref(false)

/** 去掉交易所后缀：600000.SH -> 600000 */
function baseSymbol(symbol: string): string {
  return (symbol || '').split('.')[0] || symbol
}

/** 展示「名称 (去后缀代码)」，无名称时仅展示代码 */
function labelOf(symbol: string, name: string): string {
  const base = baseSymbol(symbol)
  return name ? `${name} (${base})` : base
}

async function load() {
  loading.value = true
  try {
    const syms = await getRecentSymbols(MAX)
    // 批量解析名称，写入 nameMap；查不到不影响，展示 fallback 代码
    const nameMap: Record<string, string> = {}
    if (syms.length) {
      try {
        const rows = await getInstruments(syms.join(','))
        for (const r of rows) if (r.symbol && r.name) nameMap[r.symbol] = r.name
      } catch {
        /* 忽略，fallback 到代码 */
      }
    }
    items.value = syms.map((s) => ({ symbol: s, name: nameMap[s] || '' }))
  } catch (e) {
    items.value = []
    console.error('读取常用股票失败:', e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.favorites {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;

  .fav-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;

    .fav-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .fav-sub {
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
    }
  }

  .fav-loading,
  .fav-empty {
    color: var(--text-muted);
    font-size: 0.88rem;
    padding: 24px 0;
    text-align: center;
  }

  .fav-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;

    .fav-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      background: var(--bg-card);
      color: var(--text-primary);
      font-size: 0.86rem;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;

      &:hover {
        border-color: var(--color-primary);
        background: var(--bg-hover, rgba(0, 0, 0, 0.04));
        transform: translateY(-1px);
      }

      .fav-ico {
        color: var(--color-primary);
      }
    }
  }
}
</style>
