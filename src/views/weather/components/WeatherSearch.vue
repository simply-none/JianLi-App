<template>
  <div class="weather-search">
    <!-- 搜索栏：城市输入 + 查询按钮 -->
    <div class="search-bar">
      <el-autocomplete
        v-model="query"
        :fetch-suggestions="fetchSuggestions"
        placeholder="搜索城市天气，如：上海 / 于都"
        class="search-input"
        clearable
        :trigger-on-focus="true"
        @select="handleSelect"
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <LucideIcon name="Search" :size="16" />
        </template>
        <!-- 建议项：城市全名 + 层级标签 + 所属省市区路径（重名时靠路径区分） -->
        <template #default="{ item }">
          <div class="suggestion-item">
            <span class="suggestion-name">{{ item.name }}</span>
            <span class="suggestion-level">{{ levelLabelOf(item.level) }}</span>
            <span class="suggestion-meta">{{ item.path }}</span>
          </div>
        </template>
      </el-autocomplete>
      <el-button type="primary" :loading="loading" class="btn-search" @click="handleSearch">
        查询
      </el-button>

      <!-- 缓存时效配置（查询按钮右侧下拉） -->
      <el-dropdown trigger="click" @command="handleTtlChange">
        <el-button class="btn-cache" :title="`前端缓存时效：${ttlLabel}`">
          <LucideIcon name="Timer" :size="15" />
          <span class="btn-cache-text">{{ ttlLabel }}</span>
          <LucideIcon name="ChevronDown" :size="13" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="opt in CACHE_TTL_OPTIONS"
              :key="opt.value"
              :command="opt.value"
              :class="{ 'ttl-active': opt.value === currentTtl }"
            >
              {{ opt.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 数据源设置入口 -->
      <el-button class="btn-source" title="配置天气数据源" @click="emit('openSettings')">
        <LucideIcon name="Settings" :size="15" />
        <span class="btn-source-text">数据源</span>
      </el-button>
    </div>

    <!-- 当前定位回显：消歧后告知用户「查的是哪个同名区县」，也是「记住选择」的可见凭证 -->
    <div v-if="activePath" class="active-loc">
      <LucideIcon name="MapPin" :size="13" />
      <span>{{ activePath }}</span>
      <span v-if="remembered" class="active-loc-tip">已记住</span>
    </div>

    <!-- 星标城市（永远置顶：搜索栏下方、搜索历史上方） -->
    <div v-if="starred.length > 0" class="history-section">
      <div class="history-header">
        <LucideIcon name="Star" :size="14" />
        <span>星标城市</span>
      </div>
      <div class="history-tags">
        <button
          v-for="city in starred"
          :key="'star-' + city"
          class="history-tag starred-tag"
          :title="`查询 ${city}`"
          @click="emit('searchTag', city)"
        >
          <LucideIcon name="Star" :size="13" color="#f7c948" />
          {{ city }}
          <span class="tag-close" title="取消星标" @click.stop="emit('toggleStar', city)">
            <LucideIcon name="X" :size="12" />
          </span>
        </button>
      </div>
    </div>

    <!-- 搜索历史标签 -->
    <div v-if="history.length > 0" class="history-section">
      <div class="history-header">
        <LucideIcon name="History" :size="14" />
        <span>最近查询</span>
        <button class="clear-btn" @click="emit('clearHistory')">清除</button>
      </div>
      <div class="history-tags">
        <button
          v-for="city in history"
          :key="city"
          class="history-tag"
          @click="emit('searchTag', city)"
        >
          {{ city }}
          <span class="tag-close" @click.stop="emit('removeHistory', city)">
            <LucideIcon name="X" :size="12" />
          </span>
        </button>
      </div>
    </div>

    <!-- 重名消歧：同名区县有多个时，让用户按「省 · 市 · 区县」路径挑选 -->
    <el-dialog
      :model-value="disambigVisible"
      :title="`「${props.disambiguation?.keyword ?? ''}」有多个匹配，请选择`"
      width="440px"
      append-to-body
      @update:model-value="(v: boolean) => { if (!v) emit('cancelDisambiguation') }"
    >
      <div class="disambig-list">
        <button
          v-for="item in disambigItems"
          :key="item.key"
          class="disambig-item"
          @click="handlePickCandidate(item)"
        >
          <span class="disambig-name">{{ item.name }}</span>
          <span class="disambig-level">{{ levelLabelOf(item.level) }}</span>
          <span class="disambig-path">{{ item.path }}</span>
        </button>
      </div>
      <template #footer>
        <span class="disambig-hint">选定后将记住你的选择，下次同名查询不再询问</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import { CACHE_TTL_OPTIONS, getCacheTTL, setCacheTTL } from '../constants'
import { CITY_LEVEL_LABEL, searchCityEntries } from '../cityData'
import type { CityEntry } from '../cityData'
import { rememberCityChoice } from '../cityResolver'
import type { CityCandidate } from '../cityResolver'
import type { CityRef } from '../types'

/** 组件 Props */
const props = defineProps<{
  /** 搜索历史城市列表 */
  history: string[]
  /** 星标城市列表（置顶展示） */
  starred: string[]
  /** 是否处于加载中（按钮转圈） */
  loading: boolean
  /** 当前展示城市的路径（如「吉林省 · 长春市 · 朝阳区」；无消歧信息时为空） */
  activePath?: string
  /** 当前城市是否来自「记住的选择」 */
  remembered?: boolean
  /** 重名候选（≥2 时弹出下拉让用户选择；空数组表示无需消歧） */
  disambiguation?: {
    keyword: string
    candidates: CityCandidate[]
  } | null
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 触发查询（点击查询按钮或回车）：只传城市名，由页面统一消歧 */
  (e: 'search', city: string): void
  /** 点击历史 / 星标标签：页面按名称重建 CityRef 后查询（不弹下拉） */
  (e: 'searchTag', city: string): void
  /** 携带已确定 CityRef 的查询（选中建议项 / 选定重名候选后触发，跳过消歧） */
  (e: 'searchRef', city: string, ref: CityRef): void
  /** 关闭重名候选弹窗 */
  (e: 'cancelDisambiguation'): void
  /** 切换城市星标状态 */
  (e: 'toggleStar', city: string): void
  /** 删除单条历史 */
  (e: 'removeHistory', city: string): void
  /** 清空全部历史 */
  (e: 'clearHistory'): void
  /** 打开数据源设置 */
  (e: 'openSettings'): void
}>()

/** 输入框绑定值 */
const query = ref('')

/**
 * 生成城市建议列表（数据来自主进程全国快照：省 / 地级市 / 区县）
 * ------------------------------------------------------------------
 * el-autocomplete 支持异步 fetchSuggestions：传入的 callback 稍后调用即可。
 * @param queryString 输入的关键字（空串由主进程解释为「全部省级」）
 * @param callback 建议回调
 */
async function fetchSuggestions(queryString: string, callback: (data: SuggestionItem[]) => void) {
  if (queryString.trim().length === 1) {
    // 单字查询命中面过广（如「南」），直接给空列表，避免下拉被灌满
    callback([])
    return
  }
  try {
    const entries = await searchCityEntries(queryString)
    callback(entries.map(toSuggestion))
  } catch {
    callback([])
  }
}

/** 条目 → el-autocomplete 建议项（回填展示用 name，key 由 adcode 保证唯一） */
function toSuggestion(entry: CityEntry): SuggestionItem {
  return {
    value: entry.name,
    key: `${entry.adcode}`,
    name: entry.name,
    level: entry.level,
    path: entry.path,
    ref: entry.ref,
  }
}

/** 建议项结构（el-autocomplete 自定义模板数据） */
interface SuggestionItem {
  /** 回填到输入框的展示值（城市全名；重名时相同，故不能用作 :key） */
  value: string
  /** 唯一键（adcode） */
  key: string
  /** 城市全名（展示用） */
  name: string
  /** 层级 */
  level: CityEntry['level']
  /** 展示路径（省 · 市 · 区县） */
  path: string
  /** 消歧标识 */
  ref: CityRef
}

/** 选中建议项：候选已确定，直接带 CityRef 查询（同时记住选择） */
function handleSelect(item: SuggestionItem) {
  query.value = item.name
  rememberCityChoice(item.name, item.ref.adcode as number)
  emit('searchRef', item.name, item.ref)
}

/** 点击查询按钮或回车触发查询（是否需要消歧由页面判断） */
function handleSearch() {
  const city = query.value.trim()
  if (!city) {
    ElMessage.warning('请输入城市名称')
    return
  }
  emit('search', city)
}

/** 重名候选弹窗可见性（≥2 才需要用户挑选） */
const disambigVisible = computed(() => disambigCandidates.value.length >= 2)

/**
 * 层级 → 中文标签（模板里 item 来自 el-autocomplete 插槽，类型为 any，
 * 直接 index 会触发 TS7053，故收敛到此函数内做一次窄化）
 * @param level 层级
 * @returns 标签文案
 */
function levelLabelOf(level: CityEntry['level']): string {
  return CITY_LEVEL_LABEL[level] ?? ''
}

/** 重名候选列表（props 兜底空数组） */
const disambigCandidates = computed(() => props.disambiguation?.candidates ?? [])

/** 重名候选展示项（复用建议项结构，便于同一套样式） */
const disambigItems = computed<SuggestionItem[]>(() =>
  disambigCandidates.value.map((c) => ({
    value: c.name,
    key: `${c.adcode}`,
    name: c.name,
    level: c.level === 1 ? 'capital' : c.level === 2 ? 'prefecture' : 'county',
    path: c.path,
    ref: {
      name: c.name,
      adcode: c.adcode,
      province: c.province,
      city: c.city,
      path: c.path,
      lng: c.lng,
      lat: c.lat,
    },
  }))
)

/**
 * 选定重名候选：记住选择 + 带 CityRef 查询
 * @param item 选中的候选项
 */
function handlePickCandidate(item: SuggestionItem) {
  rememberCityChoice(item.name, item.ref.adcode as number)
  query.value = item.name
  emit('searchRef', item.name, item.ref)
}

/** 当前缓存时效（ms，从配置读取） */
const currentTtl = ref(getCacheTTL())

/** 当前缓存时效展示文案（未匹配到选项时显示「自定义」） */
const ttlLabel = computed(
  () => CACHE_TTL_OPTIONS.find((opt) => opt.value === currentTtl.value)?.label ?? '自定义'
)

/**
 * 切换缓存时效配置（立即生效并持久化）
 * @param ttl 时效毫秒数
 */
function handleTtlChange(ttl: number) {
  setCacheTTL(ttl)
  currentTtl.value = ttl
  ElMessage.success(`缓存时效已设置为 ${ttlLabel.value}`)
}
</script>

<style scoped lang="scss">
.weather-search {
  margin-bottom: 20px;
}

.search-bar {
  display: flex;
  gap: 10px;
  align-items: center;

  .search-input {
    flex: 1;
    max-width: 420px;
  }

  // 缓存时效配置按钮（查询按钮右侧）
  .btn-cache {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: rgba(255, 255, 255, 0.85);

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.4);
      color: #fff;
    }

    .btn-cache-text {
      font-size: 0.75rem;
    }
  }

  // 数据源设置按钮
  .btn-source {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: rgba(255, 255, 255, 0.85);

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.4);
      color: #fff;
    }

    .btn-source-text {
      font-size: 0.75rem;
    }
  }
}

// 当前定位回显（消歧结果 / 记住的选择）
.active-loc {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);

  .active-loc-tip {
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 0.68rem;
    color: #1b2a1e;
    background: rgba(160, 235, 180, 0.85);
  }
}

// 建议项：城市名 + 层级标签 + 所属省市区路径（autocomplete 下拉内）
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.6;

  .suggestion-name {
    font-size: 0.85rem;
    color: #303133;
    flex-shrink: 0;
  }

  // 层级标签（省会 / 地级市 / 区县）
  .suggestion-level {
    flex-shrink: 0;
    font-size: 0.68rem;
    line-height: 1.4;
    padding: 1px 5px;
    border-radius: 4px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  // 路径（省 · 市 · 区县）：重名时靠它区分，超长省略
  .suggestion-meta {
    font-size: 0.72rem;
    color: #909399;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 重名消歧弹窗内候选列表
.disambig-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.disambig-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .disambig-name {
    font-size: 0.9rem;
    color: var(--el-text-color-primary);
    flex-shrink: 0;
  }

  .disambig-level {
    flex-shrink: 0;
    font-size: 0.68rem;
    line-height: 1.4;
    padding: 1px 5px;
    border-radius: 4px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .disambig-path {
    font-size: 0.78rem;
    color: var(--el-text-color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.disambig-hint {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

// 缓存时效下拉当前选中项高亮
:global(.el-dropdown-menu__item.ttl-active) {
  color: var(--el-color-primary);
  font-weight: 600;
  background-color: var(--el-color-primary-light-9);
}

.history-section {
  margin-top: 14px;

  // 星标城市标签（金色高亮，区别于普通历史标签）
  .starred-tag {
    border-color: rgba(247, 201, 72, 0.45);
    background: rgba(247, 201, 72, 0.12);

    &:hover {
      background: rgba(247, 201, 72, 0.22);
      border-color: rgba(247, 201, 72, 0.65);
    }
  }

  .history-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.75);
    margin-bottom: 8px;

    .clear-btn {
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      padding: 2px 6px;
      border-radius: 6px;
      transition: all 0.2s;

      &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
      }
    }
  }

  .history-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .history-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
      }

      .tag-close {
        display: inline-flex;
        align-items: center;
        opacity: 0.55;
        border-radius: 50%;
        transition: opacity 0.2s;

        &:hover {
          opacity: 1;
        }
      }
    }
  }
}
</style>
