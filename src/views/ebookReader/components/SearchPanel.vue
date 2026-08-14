<template>
  <el-drawer
    v-model="visible"
    title="全文搜索"
    direction="ltr"
    size="360px"
    :append-to-body="false"
  >
    <div class="search-panel">
      <!-- 搜索输入行 -->
      <div class="search-bar">
        <el-input
          v-model="keyword"
          placeholder="输入关键词，跨全书检索"
          clearable
          :disabled="searching"
          @keyup.enter="onSearch"
        >
          <template #prefix>
            <LucideIcon name="Search" :size="14" />
          </template>
        </el-input>
        <el-button
          type="primary"
          size="small"
          :loading="searching"
          :disabled="!keyword.trim()"
          @click="onSearch"
        >
          搜索
        </el-button>
      </div>

      <!-- 结果统计 -->
      <div class="search-meta" v-if="searched">
        共找到 {{ results.length }} 条结果
        <span v-if="results.length >= maxResults">（已截断，前 {{ maxResults }} 条）</span>
      </div>

      <!-- 结果列表 -->
      <div class="search-list">
        <div
          v-for="(item, index) in results"
          :key="item.cfi + '-' + index"
          class="search-item"
          @click="onJump(item)"
        >
          <div class="search-excerpt">{{ item.excerpt }}</div>
          <div class="search-source">{{ sourceLabel(item.sectionHref) }}</div>
        </div>
        <div v-if="searched && results.length === 0" class="search-empty">
          {{ searching ? '搜索中…' : '未找到匹配结果' }}
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import type { EpubSearchResult } from '../types';

const props = defineProps<{
  /** 抽屉可见性（v-model） */
  modelValue: boolean;
  /** 搜索结果列表 */
  results: EpubSearchResult[];
  /** 是否正在搜索 */
  searching?: boolean;
  /** 结果上限（与 composable 一致，用于提示截断） */
  maxResults?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'search', term: string): void;
  (e: 'jump', item: EpubSearchResult): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

/** 搜索关键词（本地受控，回车或点击触发父组件搜索） */
const keyword = ref('');
/** 是否已执行过搜索（用于区分「未搜索」与「无结果」） */
const searched = ref(false);

const maxResults = computed(() => props.maxResults ?? 300);

// 抽屉关闭时重置「已搜索」标记，避免残留提示
watch(visible, (v) => {
  if (!v) searched.value = false;
});

/** 触发搜索 */
function onSearch() {
  if (!keyword.value.trim()) return;
  searched.value = true;
  emit('search', keyword.value.trim());
}

/** 点击结果：通知父组件跳转（父组件负责关闭抽屉） */
function onJump(item: EpubSearchResult) {
  emit('jump', item);
}

/** 将 spine href 转为更友好的来源名（取文件名去掉扩展名） */
function sourceLabel(href: string): string {
  if (!href) return '';
  const name = href.split('/').pop() || href;
  return name.replace(/\.[^.]+$/, '') || name;
}
</script>

<style scoped lang="scss">
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;

  .search-bar {
    display: flex;
    gap: 8px;
    padding: 0 4px 12px;
  }

  .search-meta {
    font-size: 12px;
    color: var(--text-muted);
    padding: 0 4px 10px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 8px;
  }
}

.search-list {
  flex: 1;
  overflow: auto;
  padding: 8px 0;

  .search-item {
    padding: 10px 12px;
    border-radius: var(--radius-card, 6px);
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: var(--bg-hover, var(--bg-base));
    }

    .search-excerpt {
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-primary);
      word-break: break-word;
      white-space: pre-wrap;
    }

    .search-source {
      margin-top: 4px;
      font-size: 11px;
      color: var(--text-muted);
    }
  }

  .search-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
}
</style>
