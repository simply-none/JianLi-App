<template>
  <div class="stock-query-bar">
    <!-- 已暂存的标的标签（输入框上一行） -->
    <div v-if="tags.length" class="query-tags">
      <el-tag
        v-for="(tag, i) in tags"
        :key="tag + '_' + i"
        closable
        size="small"
        class="query-tag"
        :title="tag"
        @close="removeTag(i)"
      >
        {{ tagLabel(tag) }}
      </el-tag>
      <span class="tags-clear" @click="clearTags">清空</span>
    </div>

    <div class="query-input-row">
      <el-autocomplete
        v-model="inputText"
        class="query-autocomplete"
        :fetch-suggestions="fetchSuggestions"
        :debounce="200"
        clearable
        placeholder="输入股票代码 / 名称 / 简写，输入时自动匹配最多 10 条，回车加入上方标签，如：600000、贵州茅台、PG"
        @select="onSelectSuggestion"
        @keydown.enter.prevent="onEnter"
      >
        <template #default="{ item }">
          <div class="suggest-item">
            <span class="suggest-name">{{ item.name || item.symbol }}</span>
            <span class="suggest-symbol">{{ item.symbol }}</span>
          </div>
        </template>
      </el-autocomplete>
      <div class="query-actions">
        <el-button type="primary" :loading="loading" @click="onSubmit">
          <LucideIcon name="Search" :size="16" color="#fff" />
          <span style="margin-left:6px">查询</span>
        </el-button>
        <el-button @click="clearAll">清空</el-button>
      </div>
    </div>

    <div class="query-meta">
      <span class="tip">回车逐个加入标签，点「查询」统一提交</span>
      <span v-if="tags.length" class="parsed-count">
        已加入 {{ tags.length }} 个标的
      </span>
    </div>

    <div v-if="history.length" class="query-history">
      <span class="history-label">最近：</span>
      <el-tag
        v-for="item in history"
        :key="item"
        size="small"
        class="history-tag"
        :title="item"
        @click="applyHistory(item)"
      >
        {{ tagLabel(item) }}
      </el-tag>
    </div>

    <!-- 模糊匹配不上时的确认弹窗 -->
    <app-dialog
      v-model="confirmVisible"
      title="股票可能不存在"
      width="360px"
      :close-on-click-modal="false"
      append-to-body
    >
      <p class="confirm-text">
        本地数据库未匹配到「<b>{{ pendingKeyword }}</b>」，疑似该股票不存在或尚未同步。
      </p>
      <p class="confirm-sub">是否仍将其加入查询标签？</p>
      <template #footer>
        <el-button @click="onConfirmCancel">取消</el-button>
        <el-button type="primary" @click="onConfirmContinue">继续查询</el-button>
      </template>
    </app-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import { searchInstruments, getInstrumentsDb } from '../api'

const props = defineProps<{
  loading?: boolean
  /** 进入页面时回填的上一次查询（逗号分隔文本） */
  defaultText?: string
}>()

const emit = defineEmits<{
  (e: 'search', symbols: string[]): void
}>()

const HISTORY_KEY = 'stock_query_history'

const MAX_SUGGEST = 10

const inputText = ref(props.defaultText ?? '')
const tags = ref<string[]>([])
const history = ref<string[]>(loadHistory())

/** 等待用户确认的待加入关键词（模糊匹配未命中时） */
const confirmVisible = ref(false)
const pendingKeyword = ref('')
/** 用户确认继续后，统一走提交逻辑时需要带上这个关键词 */
const trimmedInput = computed(() => inputText.value.trim())

/** 弹窗「继续」标志 */
let pendingContinue = false
/** 等待确认弹窗结束的回调 */
let pendingResolve: (() => void) | null = null

/** 下拉建议项类型 */
interface SuggestItem {
  value: string
  symbol: string
  name: string
  exchange?: string
}

/** 符号 → 名称 的缓存（用于标签/历史展示「名称 (代码)」） */
const nameMap = ref<Record<string, string>>({})

/** 去掉交易所后缀：600000.SH -> 600000 */
function baseSymbol(symbol: string): string {
  return (symbol || '').split('.')[0] || symbol
}

/** 标签展示：优先「名称 (去后缀代码)」，无名称则只展示去后缀代码 */
function tagLabel(symbol: string): string {
  const name = nameMap.value[symbol]
  const base = baseSymbol(symbol)
  return name ? `${name} (${base})` : base
}

/** 批量从本地个股主表解析 symbol 名称并写入 nameMap（不请求 TickFlow，离线可用，避免累积 GET） */
async function fillNamesFromDb(symbols: string[]): Promise<void> {
  const targets = (symbols || []).filter((s) => s && !nameMap.value[s])
  if (!targets.length) return
  try {
    const rows = await getInstrumentsDb()
    const dbMap: Record<string, string> = {}
    for (const r of rows) {
      if (r.symbol && r.name) dbMap[r.symbol] = r.name
    }
    const next = { ...nameMap.value }
    let changed = false
    for (const s of targets) {
      if (dbMap[s]) {
        next[s] = dbMap[s]
        changed = true
      }
    }
    if (changed) nameMap.value = next
  } catch {
    /* 本地库读取失败：标签回退展示代码，不影响功能 */
  }
}

/**
 * 输入时实时模糊匹配（最多 MAX_SUGGEST 条），供下拉建议使用。
 * 仅在用户输入有意义的关键词时查询，避免空查询。
 */
async function fetchSuggestions(
  query: string,
  cb: (items: SuggestItem[]) => void,
): Promise<void> {
  const kw = (query || '').trim()
  if (!kw) {
    cb([])
    return
  }
  try {
    const rows = await searchInstruments(kw, MAX_SUGGEST)
    const items: SuggestItem[] = rows.map((r) => ({
      value: r.symbol,
      symbol: r.symbol,
      name: r.name || r.symbol,
      exchange: r.exchange,
    }))
    cb(items)
  } catch {
    cb([])
  }
}

/**
 * 用户从下拉建议中点选（或回车选中）某条候选：直接加入标签并清空输入。
 */
let justSelected = false
function onSelectSuggestion(item: SuggestItem) {
  if (item.symbol && item.name) nameMap.value[item.symbol] = item.name
  pushTag(item.symbol)
  inputText.value = ''
  justSelected = true
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(symbols: string[]) {
  const merged = [...symbols, ...history.value.filter((h) => !symbols.includes(h))]
  history.value = merged.slice(0, 10)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
}

/** 将单个查询词加入标签（去重） */
function pushTag(symbol: string) {
  const s = symbol.trim()
  if (!s) return
  if (!tags.value.includes(s)) tags.value.push(s)
}

function removeTag(i: number) {
  tags.value.splice(i, 1)
}

function clearTags() {
  tags.value = []
}

/** 把输入框当前内容解析为若干词 */
function parseInput(text: string): string[] {
  return text
    .split(/[\s,，]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 弹窗等待用户决策：返回 true=继续加入，false=取消 */
function waitConfirm(): Promise<boolean> {
  confirmVisible.value = true
  return new Promise<boolean>((resolve) => {
    pendingResolve = () => {
      resolve(pendingContinue)
    }
  })
}

/**
 * 回车：把当前输入逐条加入标签。
 * 先做本地模糊匹配：命中则加入匹配到的标准代码；未命中的统一弹窗确认一次。
 */
async function onEnter() {
  // 若刚从下拉选中了某条候选，输入已被清空，跳过本次回车解析
  if (justSelected) {
    justSelected = false
    return
  }
  const words = parseInput(inputText.value)
  if (!words.length) {
    ElMessage.warning('请输入股票代码 / 名称 / 简写')
    return
  }
  const missed: string[] = []
  for (const word of words) {
    const matched = await searchInstruments(word)
    if (matched.length) {
      // 优先精确匹配，否则取第一个候选的标准代码
      const exact = matched.find((m) => m.symbol.toLowerCase() === word.toLowerCase())
      const hit = exact || matched[0]
      if (hit.symbol && hit.name) nameMap.value[hit.symbol] = hit.name
      pushTag(hit.symbol)
    } else {
      missed.push(word)
    }
  }
  inputText.value = ''

  // 未命中的词统一弹一次确认：继续则全部加入标签
  if (missed.length) {
    pendingKeyword.value = missed.length === 1 ? missed[0] : missed.join('、')
    const ok = await waitConfirm()
    if (ok) missed.forEach(pushTag)
  }
}

function onConfirmContinue() {
  pendingContinue = true
  confirmVisible.value = false
  pendingResolve?.()
  pendingResolve = null
}

function onConfirmCancel() {
  pendingContinue = false
  confirmVisible.value = false
  pendingResolve?.()
  pendingResolve = null
}

/** 查询按钮：把输入框残留内容并入标签，再统一提交全部标签 */
function onSubmit() {
  // 输入框里还没回车的残留文本，直接并入标签（不重复弹窗）
  for (const w of parseInput(inputText.value)) pushTag(w)
  inputText.value = ''
  if (!tags.value.length) {
    ElMessage.warning('请先加入至少一个标的')
    return
  }
  const symbols = [...tags.value]
  saveHistory(symbols)
  emit('search', symbols)
}

function clearAll() {
  inputText.value = ''
  clearTags()
}

function applyHistory(item: string) {
  inputText.value = item
  onSubmit()
}

/** 初始化：对 localStorage 里的历史 symbol 从本地库批量解析名称（不发接口） */
onMounted(() => {
  if (history.value.length) fillNamesFromDb(history.value)
})
</script>

<style scoped lang="scss">
.stock-query-bar {
  padding: 12px 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-subtle);
  border-radius: 0 0 var(--radius-card) var(--radius-card);

  .query-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;

    .query-tag {
      font-size: 0.8rem;
    }

    .tags-clear {
      font-size: 0.78rem;
      color: var(--text-muted);
      cursor: pointer;

      &:hover {
        color: var(--color-primary);
      }
    }
  }

  .query-input-row {
    display: flex;
    gap: 12px;
    align-items: stretch;

    .query-autocomplete {
      flex: 1;

      :deep(.el-input) {
        width: 100%;
      }
    }

    .query-actions {
      display: flex;
      flex-direction: row;
      gap: 8px;
      align-items: center;
    }
  }

  /* 下拉建议项（代码 + 名称 + 交易所） */
  .suggest-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;

    .suggest-name {
      font-weight: 500;
      color: var(--text-strong, #1f2329);
    }

    .suggest-symbol {
      font-family: ui-monospace, monospace;
      font-size: 0.82rem;
      color: var(--text-muted, #86909c);
    }

    .suggest-exchange {
      margin-left: auto;
      font-size: 0.72rem;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--bg-base, #f2f3f5);
      color: var(--text-muted, #86909c);
    }
  }

  .query-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
    font-size: 0.78rem;
    color: var(--text-muted);

    .parsed-count {
      color: var(--color-primary);
    }
  }

  .query-history {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;

    .history-label {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .history-tag {
      cursor: pointer;
    }
  }

  .confirm-text {
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .confirm-sub {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
}
</style>
