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
        <!-- 建议项：城市名 + 省份/层级标签 -->
        <template #default="{ item }">
          <div class="suggestion-item">
            <span class="suggestion-name">{{ item.name }}</span>
            <span class="suggestion-meta">{{ item.province }} · {{ item.levelLabel }}</span>
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
          @click="emit('search', city)"
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
          @click="emit('search', city)"
        >
          {{ city }}
          <span class="tag-close" @click.stop="emit('removeHistory', city)">
            <LucideIcon name="X" :size="12" />
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import { CACHE_TTL_OPTIONS, getCacheTTL, setCacheTTL } from '../constants'
import { CITY_LEVEL_LABEL, searchCityEntries } from '../cityData'

/** 组件 Props */
defineProps<{
  /** 搜索历史城市列表 */
  history: string[]
  /** 星标城市列表（置顶展示） */
  starred: string[]
  /** 是否处于加载中（按钮转圈） */
  loading: boolean
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 触发查询（点击查询按钮或回车） */
  (e: 'search', city: string): void
  /** 切换城市星标状态 */
  (e: 'toggleStar', city: string): void
  /** 删除单条历史 */
  (e: 'removeHistory', city: string): void
  /** 清空全部历史 */
  (e: 'clearHistory'): void
}>()

/** 输入框绑定值 */
const query = ref('')

/**
 * 生成城市建议列表（基于城市映射数据：省会/地级市/县级城市）
 * @param queryString 输入的关键字（为空时返回省会列表）
 * @param callback 建议回调
 */
function fetchSuggestions(queryString: string, callback: (data: SuggestionItem[]) => void) {
  const entries = searchCityEntries(queryString)
  callback(
    entries.map((entry) => ({
      value: entry.searchName,
      name: entry.name,
      province: entry.province,
      levelLabel: CITY_LEVEL_LABEL[entry.level],
    }))
  )
}

/** 建议项结构（el-autocomplete 自定义模板数据） */
interface SuggestionItem {
  /** 实际查询词（县级自动拼省份简称） */
  value: string
  /** 城市名（展示用） */
  name: string
  /** 所属省份 */
  province: string
  /** 层级中文标签 */
  levelLabel: string
}

/** 选中建议项后立即查询 */
function handleSelect(item: SuggestionItem) {
  emit('search', item.value)
}

/** 点击查询按钮或回车触发查询 */
function handleSearch() {
  const city = query.value.trim()
  if (!city) {
    ElMessage.warning('请输入城市名称')
    return
  }
  emit('search', city)
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
}

// 建议项：城市名 + 省份/层级标签（autocomplete 下拉内）
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  line-height: 1.6;

  .suggestion-name {
    font-size: 0.85rem;
    color: #303133;
  }

  .suggestion-meta {
    font-size: 0.72rem;
    color: #909399;
  }
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
