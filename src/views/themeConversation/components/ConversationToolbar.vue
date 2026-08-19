<template>
  <div class="conv-toolbar">
    <!-- 搜索框：主题字段 / 对话内容字段 / 标签 -->
    <div class="search-box">
      <LucideIcon name="Search" :size="15" class="search-icon" />
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索：主题 / 对话内容 / 标签"
        @input="onSearchInput"
      />
      <button v-if="keyword" class="search-clear" @click="clearAll" title="清空搜索">
        <LucideIcon name="X" :size="13" />
      </button>
    </div>

    <!-- 标签筛选（标签分类） -->
    <el-popover placement="bottom-start" :width="240" trigger="click" v-model:visible="tagPopVisible">
      <template #reference>
        <button class="tool-btn" :class="{ active: !!activeTagFilter }">
          <LucideIcon name="Tags" :size="15" />
          <span>标签</span>
          <span v-if="activeTagFilter" class="badge">{{ tagName(activeTagFilter) }}</span>
        </button>
      </template>
      <div class="tag-filter-panel">
        <div class="tfp-head">
          <span>按标签筛选</span>
          <el-button v-if="activeTagFilter" link type="primary" size="small" @click="clearTagFilter">清除</el-button>
        </div>
        <div class="tfp-list" v-if="tags.length">
          <div
            v-for="t in tags"
            :key="t.id"
            class="tfp-item"
            :class="{ active: activeTagFilter === String(t.id) }"
            @click="pickTag(t)"
          >
            <span class="dot" :style="{ backgroundColor: t.color }"></span>
            <span class="nm">{{ t.name }}</span>
            <LucideIcon v-if="activeTagFilter === String(t.id)" name="Check" :size="14" />
          </div>
        </div>
        <div class="tfp-empty" v-else>暂无标签</div>
      </div>
    </el-popover>

    <!-- 新建对话：聚焦底部输入框 -->
    <button class="tool-btn primary" @click="$emit('new-conversation')">
      <LucideIcon name="SquarePen" :size="15" />
      <span>新建对话</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

const emit = defineEmits<{ (e: 'new-conversation'): void }>();

const {
  searchKeyword,
  activeTagFilter,
  tags,
  tagName,
  runSearch,
  clearSearch,
} = useThemeConversation();

const keyword = ref(searchKeyword.value);
const tagPopVisible = ref(false);

// 双向同步输入框与外部状态
watch(searchKeyword, (v) => { keyword.value = v; });

let timer: any = null;
function onSearchInput() {
  searchKeyword.value = keyword.value;
  clearTimeout(timer);
  timer = setTimeout(() => runSearch(), 250);
}

function pickTag(t: any) {
  activeTagFilter.value = activeTagFilter.value === String(t.id) ? '' : String(t.id);
  tagPopVisible.value = false;
  runSearch();
}

function clearTagFilter() {
  activeTagFilter.value = '';
  runSearch();
}

function clearAll() {
  keyword.value = '';
  clearSearch();
}
</script>

<style scoped lang="scss">
.conv-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.search-box {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: 36px;
    padding: 0 32px 0 34px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary-light);
    }

    &::placeholder { color: var(--text-muted); }
  }

  .search-clear {
    position: absolute;
    right: 8px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: inline-flex;
    padding: 4px;
    border-radius: 4px;

    &:hover { color: var(--text-primary); background: var(--bg-hover); }
  }
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
  }

  &.primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;

    &:hover { filter: brightness(1.05); }
  }

  .badge {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    background: rgba(255, 255, 255, 0.25);
    padding: 0 6px;
    border-radius: 8px;
    font-size: 11px;
  }
}

.tag-filter-panel {
  .tfp-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .tfp-list {
    max-height: 240px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tfp-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border-radius: 6px;
    cursor: pointer;

    &:hover { background: var(--bg-hover); }
    &.active { background: var(--color-primary-light); }

    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .nm { flex: 1; font-size: 13px; color: var(--text-primary); }
    :deep(.lucide-icon) { color: var(--color-primary); }
  }

  .tfp-empty {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }
}
</style>
