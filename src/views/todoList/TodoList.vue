<!--
  待办卡片网格（卡片视图容器）
  - 从 useTodo store 读取已过滤/已分组的待办（groups）
  - groupBy 不为 none 时按「状态 / 截止日期」分区展示
  - 子任务/折叠/密度等优化在 TodoCard 内完成
-->
<template>
  <el-scrollbar ref="scrollbarRef" class="todo-list" @scroll="onScroll">
    <div v-if="!loading && flatList.length === 0" class="empty-state">
      <el-empty description="暂无待办事项，点击右上角新建吧" />
    </div>

    <!-- 分区分组 -->
    <template v-if="groupBy !== 'none'">
      <section v-for="g in visibleGroups" :key="g.key" class="todo-group">
        <div class="group-header">
          <span class="group-label">{{ g.label }}</span>
          <span class="group-count">{{ g.items.length }}</span>
        </div>
        <div class="todo-grid">
          <TodoCard
            v-for="todo in g.items"
            :key="todo.key"
            :todo="todo"
            :tags="tags"
            :focus-key="focusKey"
            @view="emit('view', $event)"
            @edit="emit('edit', $event)"
            @delete="emit('delete', $event)"
            @status-change="emit('status-change', $event)"
            @record="emit('record', $event)"
            @view-parent="emit('view-parent', $event)"
            @focus="emit('focus', $event)"
          />
        </div>
      </section>
    </template>

    <!-- 不分區 -->
    <div v-else class="todo-grid">
      <TodoCard
        v-for="todo in visibleFlat"
        :key="todo.key"
        :todo="todo"
        :tags="tags"
        :focus-key="focusKey"
        @view="emit('view', $event)"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
        @status-change="emit('status-change', $event)"
        @record="emit('record', $event)"
        @view-parent="emit('view-parent', $event)"
        @focus="emit('focus', $event)"
      />
    </div>

    <!-- B3 分批加载提示 -->
    <div v-if="hasMore" class="load-more-hint">下滑加载更多（已显示 {{ Math.min(renderLimit, flatList.length) }} / {{ flatList.length }}）</div>

    <div v-if="loading && flatList.length > 0" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">加载中...</span>
    </div>
  </el-scrollbar>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TodoItem, Tag } from './types';
import { useTodoStore } from '@/store/useTodo';
import TodoCard from './components/TodoCard.vue';

const props = defineProps<{
  tags: Tag[];
  /** 当前番茄钟专注关联的待办 key（E3 透传给卡片） */
  focusKey?: string;
}>();

const emit = defineEmits<{
  (e: 'view', todo: TodoItem): void;
  (e: 'edit', todo: TodoItem): void;
  (e: 'delete', todo: TodoItem): void;
  (e: 'status-change', todo: TodoItem): void;
  (e: 'record', todo: TodoItem): void;
  (e: 'view-parent', todo: TodoItem): void;
  (e: 'focus', todo: TodoItem): void;
}>();

const store = useTodoStore();

const groups = computed(() => store.groups);
const groupBy = computed(() => store.groupBy);
const loading = computed(() => store.loading);
// 不分區时用于空态判断的扁平列表
const flatList = computed(() => store.filteredTodos);

// ===== B3 分批渲染：卡片网格无虚拟列表，待办多时 DOM 全量挂载会卡 =====
const BATCH_SIZE = 60;
const renderLimit = ref(BATCH_SIZE);
const scrollbarRef = ref<any>(null);

// 数据口径变化时重置分批（编辑单条不改变数量/筛选，不触发重置）
watch(
  () => [
    store.groupBy,
    flatList.value.length,
    store.keyword,
    store.dueFilter,
    store.todayFocus,
    store.statusFilter,
    store.tagFilters.length,
    store.showCompleted,
    store.showTemplates,
  ],
  () => {
    renderLimit.value = BATCH_SIZE;
  },
);

/** 分批后的分组：累计条数不超过 renderLimit，滚动触底追加 */
const visibleGroups = computed(() => {
  let budget = renderLimit.value;
  const out: typeof groups.value = [];
  for (const g of groups.value) {
    if (budget <= 0) break;
    const items = g.items.length > budget ? g.items.slice(0, budget) : g.items;
    out.push({ ...g, items });
    budget -= items.length;
  }
  return out;
});

const visibleFlat = computed(() => flatList.value.slice(0, renderLimit.value));
const hasMore = computed(() => flatList.value.length > renderLimit.value);

/** 滚动接近底部时追加一批 */
function onScroll({ scrollTop, scrollHeight }: { scrollTop: number; scrollHeight: number }) {
  if (!hasMore.value) return;
  const wrap = scrollbarRef.value?.wrapRef as HTMLElement | undefined;
  const clientH = wrap?.clientHeight || 0;
  if (scrollTop + clientH >= scrollHeight - 300) {
    renderLimit.value += BATCH_SIZE;
  }
}
</script>

<style scoped lang="scss">
.todo-list {
  width: 100%;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.load-more-hint {
  text-align: center;
  padding: 12px 0 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.todo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.todo-group {
  margin-bottom: 18px;

  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0 12px;
    padding-left: 4px;

    .group-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .group-count {
      font-size: 12px;
      color: var(--text-muted);
      background: var(--bg-hover);
      border-radius: 10px;
      padding: 1px 8px;
    }
  }
}

.loading-state {
  text-align: center;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-subtle);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-text {
    font-size: 12px;
    color: var(--text-muted);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
