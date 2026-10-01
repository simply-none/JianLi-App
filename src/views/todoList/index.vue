<template>
  <div class="todo-list-page" :class="['theme-' + currentTheme]">
    <div class="todo-container">
      <div class="todo-header">
        <div class="todo-title">
          <h2>待办事项</h2>
          <p class="todo-subtitle">高效管理你的任务清单</p>
        </div>
        <div class="todo-header-actions">
          <el-button type="primary" @click="createNewTodo">
            <LucideIcon name="Plus" />
            新建待办
          </el-button>
          <el-button @click="statsVisible = true">
            <LucideIcon name="TrendingUp" />
            统计
          </el-button>
          <el-button @click="batchEditVisible = true">
            <LucideIcon name="PenLine" />
            批量编辑
          </el-button>
          <el-button @click="openBatchDelete">
            <LucideIcon name="Trash2" />
            批量删除
          </el-button>
          <el-button @click="recycleBinVisible = true">
            <LucideIcon name="Trash" />
            回收站
          </el-button>
          <!-- 导出（D4）：Markdown / CSV，走统一导出规范 -->
          <el-dropdown @command="(f: string) => exportTodos(store.filteredTodos, store.tags, f as 'md' | 'csv')">
            <el-button>
              <LucideIcon name="Download" />
              导出
              <LucideIcon name="ChevronDown" />
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="md">Markdown</el-dropdown-item>
                <el-dropdown-item command="csv">CSV 表格</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 视图切换：卡片 / 列表 / 日历 -->
      <TopTabs
        :tabs="viewTabs"
        :model-value="store.view"
        @update:model-value="(k: string | number) => (store.view = k as TodoView)"
      />

      <div class="todo-toolbar">
        <div class="toolbar-main">
          <div class="toolbar-left">
            <div class="search-box">
              <el-input
                ref="searchInputRef"
                v-model="store.keyword"
                placeholder="搜索待办内容..."
                clearable
                size="default"
                class="search-input"
              >
                <template #prefix>
                  <LucideIcon name="Search" :size="14" class="search-icon" />
                </template>
              </el-input>
            </div>
            <el-button
              :type="store.todayFocus ? 'primary' : 'default'"
              size="default"
              class="today-btn"
              @click="store.setTodayFocus(!store.todayFocus)"
            >
              <LucideIcon name="Calendar" :size="14" />
              今日
            </el-button>
            <el-select v-model="store.priorityFilter" placeholder="优先级" size="default" clearable>
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>
            <el-select v-model="store.statusFilter" placeholder="状态" size="default" clearable>
              <el-option v-for="opt in TODO_STATUS_LIST" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <!-- 到期段筛选（D1）：口径与移动端 todo_filter 对齐 -->
            <el-select v-model="store.dueFilter" placeholder="到期" size="default" clearable class="due-select">
              <el-option v-for="(label, key) in DUE_SEGMENT_LABELS" :key="key" :label="label" :value="key" />
            </el-select>
          </div>
          <div class="toolbar-right">
            <el-select
              v-if="store.view !== 'calendar'"
              v-model="store.groupBy"
              placeholder="分组"
              size="default"
              class="group-select"
            >
              <el-option label="不分组" value="none" />
              <el-option label="按状态" value="status" />
              <el-option label="按截止日期" value="due" />
              <el-option label="按父任务" value="parent" />
            </el-select>
            <!-- 排序（D7）：客户端排序 -->
            <el-select v-model="store.sortMode" placeholder="排序" size="default" class="sort-select">
              <el-option label="按更新时间" value="updated" />
              <el-option label="按截止时间" value="due" />
              <el-option label="按优先级" value="priority" />
              <el-option label="按创建时间" value="created" />
            </el-select>
            <el-checkbox v-model="store.showCompleted" class="tb-check">显示已完成</el-checkbox>
            <el-checkbox v-model="store.showTemplates" class="tb-check">重复模板</el-checkbox>
            <div class="todo-stats">
              <span class="stat-item"><span class="stat-value">{{ store.totalCount }}</span><span class="stat-label">总计</span></span>
              <span class="stat-divider" />
              <span class="stat-item"><span class="stat-value pending">{{ store.inProgressCount }}</span><span class="stat-label">进行中</span></span>
              <span class="stat-divider" />
              <span class="stat-item"><span class="stat-value completed">{{ store.completedCount }}</span><span class="stat-label">已完成</span></span>
              <span class="stat-divider" />
              <span class="stat-item"><span class="stat-value cancelled">{{ store.cancelledCount }}</span><span class="stat-label">已取消</span></span>
            </div>
          </div>
        </div>

        <!-- 标签筛选单独成行：更宽展示已选标签 chips -->
        <div class="toolbar-tags">
          <LucideIcon name="Tag" :size="14" class="tags-label-icon" />
          <span class="tags-label">标签</span>
          <TagSelectPopover v-model="store.tagFilters" class="tags-popover" />
          <el-button link type="primary" size="small" class="tags-manage" @click="tagManageVisible = true">
            <LucideIcon name="Tags" :size="14" />
            管理
          </el-button>
        </div>
      </div>

      <div ref="contentRef" class="todo-content">
        <TodoList v-show="store.view === 'card'" :tags="allTags" :focus-key="store.pomodoroLinkKey" @view="openView" @edit="openEdit" @delete="handleDelete" @status-change="handleStatusChange" @record="openRecord" @view-parent="openReadOnly" @focus="handleFocus" />
        <TodoListView v-show="store.view === 'list'" :tags="allTags" :focus-key="store.pomodoroLinkKey" @view="openView" @edit="openEdit" @delete="handleDelete" @status-change="handleStatusChange" @record="openRecord" @view-parent="openReadOnly" @focus="handleFocus" />
        <TodoCalendarView v-show="store.view === 'calendar'" :tags="allTags" @view="openView" @edit="openEdit" @delete="handleDelete" @status-change="handleStatusChange" @record="openRecord" @view-parent="openReadOnly" />
      </div>
    </div>

    <TodoDetailDialog
      :visible="dialogVisible"
      :todo="currentTodo"
      :tags="allTags"
      @update:visible="dialogVisible = $event"
      @save="handleDialogSave"
      @tag-update="store.fetchTags"
      @view-detail="openReadOnly"
    />

    <!-- 只读详情：查看父任务（不可编辑），覆盖在任意弹窗之上 -->
    <TodoDetailDialog
      :visible="readOnlyVisible"
      :todo="readOnlyTodo"
      :tags="allTags"
      read-only
      @update:visible="readOnlyVisible = $event"
    />

    <TodoBatchDeleteDialog
      :visible="deleteDialogVisible"
      @update:visible="deleteDialogVisible = $event"
    />

    <TodoBatchEditDialog
      :visible="batchEditVisible"
      @update:visible="batchEditVisible = $event"
    />

    <TagManageDialog v-model="tagManageVisible" />

    <TodoStatsDialog v-model="statsVisible" />

    <RecycleBinDialog v-model="recycleBinVisible" />

    <RecordProgressDialog
      :visible="recordDialogVisible"
      :todo="recordTodo"
      @update:visible="recordDialogVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import TopTabs from '@/components/TopTabs.vue';
import useTheme from '@/store/useTheme';
import { useTodoStore } from '@/store/useTodo';
import { TODO_STATUS_LIST } from './statusConfig';
import { DUE_SEGMENT_LABELS } from './utils/time';
import type { TodoItem, Tag } from './types';
import type { TodoView } from '@/store/useTodo';
import TodoList from './TodoList.vue';
import TodoListView from './TodoListView.vue';
import TodoCalendarView from './TodoCalendarView.vue';
import TodoDetailDialog from './TodoDetailDialog.vue';
import TodoBatchDeleteDialog from './TodoBatchDeleteDialog.vue';
import TodoBatchEditDialog from './TodoBatchEditDialog.vue';
import TagManageDialog from './components/TagManageDialog.vue';
import TodoStatsDialog from './TodoStatsDialog.vue';
import RecycleBinDialog from './RecycleBinDialog.vue';
import RecordProgressDialog from './RecordProgressDialog.vue';
import TagSelectPopover from './components/TagSelectPopover.vue';
import { exportTodos } from './utils/exportTodo';

const themeStore = useTheme();
const { currentTheme } = themeStore;
const store = useTodoStore();

const allTags = computed(() => store.tags);

const viewTabs = [
  { key: 'card', label: '卡片', icon: 'LayoutGrid' },
  { key: 'list', label: '列表', icon: 'List' },
  { key: 'calendar', label: '日历', icon: 'Calendar' },
];

const dialogVisible = ref(false);
const currentTodo = ref<TodoItem | null>(null);
const readOnlyVisible = ref(false);
const readOnlyTodo = ref<TodoItem | null>(null);
const deleteDialogVisible = ref(false);
const batchEditVisible = ref(false);
const tagManageVisible = ref(false);
const statsVisible = ref(false);
const recycleBinVisible = ref(false);
const recordDialogVisible = ref(false);
const recordTodo = ref<TodoItem | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<any>(null); // Ctrl+F 聚焦搜索框（D8）

function createNewTodo() {
  currentTodo.value = null;
  dialogVisible.value = true;
}
function openBatchDelete() {
  deleteDialogVisible.value = true;
}
function openView(todo: TodoItem) {
  currentTodo.value = { ...todo };
  dialogVisible.value = true;
}
function openEdit(todo: TodoItem) {
  currentTodo.value = { ...todo };
  dialogVisible.value = true;
}
function openRecord(todo: TodoItem) {
  recordTodo.value = { ...todo };
  recordDialogVisible.value = true;
}

/** 打开只读详情（查看父任务等场景，不可编辑） */
function openReadOnly(todo: TodoItem) {
  readOnlyTodo.value = { ...todo };
  readOnlyVisible.value = true;
}

async function handleStatusChange(todo: TodoItem) {
  // 单条状态切换走 store 统一收口（upsert + 局部更新 + 重排提醒 + 通知小窗），不再全量重拉
  try {
    await store.commitTodo(todo);
    ElMessage.success('状态已更新');
  } catch (e) {
    ElMessage.error('操作失败:' + ((e as Error)?.message || e));
  }
}

async function handleDelete(todo: TodoItem) {
  try {
    await ElMessageBox.confirm('确定要删除这个待办事项吗？删除后可在回收站恢复（保留 30 天）。', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return; /* 用户取消 */
  }
  try {
    await store.removeTodo(todo.key);
    ElMessage.success('已移入回收站');
  } catch (e) {
    ElMessage.error('删除失败:' + ((e as Error)?.message || e));
  }
}

/** 番茄钟专注关联（E3）：再次点击同一待办取消关联 */
function handleFocus(todo: TodoItem) {
  if (store.pomodoroLinkKey === todo.key) {
    store.focusTodo(null);
    ElMessage.success('已取消番茄钟专注关联');
  } else {
    store.focusTodo(todo);
    ElMessage.success(`已关联专注目标「${todo.title || '无标题'}」，番茄钟专注段将累计到该待办`);
  }
}

function handleDialogSave() {
  store.fetchTags().then(() => store.fetchTodos());
}

// 命令面板跳转高亮：滚动到目标卡片并闪烁提示
function applyHighlight(key: string) {
  if (!key) return;
  store.view = 'card';
  nextTick(() => {
    const el = contentRef.value?.querySelector(`[data-todo-key="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('todo-flash');
      setTimeout(() => el.classList.remove('todo-flash'), 1600);
    }
    store.highlightKey = '';
  });
}

watch(() => store.highlightKey, (key) => applyHighlight(key));

// ===== 快捷键（D8）：非输入焦点下 N 新建 / Ctrl+F 聚焦搜索 / Esc 清空筛选 =====
function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
}

function onKeydown(e: KeyboardEvent) {
  if (isTypingTarget(e) || e.isComposing) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault();
    searchInputRef.value?.focus?.();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    createNewTodo();
    return;
  }
  if (e.key === 'Escape') {
    // 有弹窗打开时交给弹窗自身的 Esc 行为，不清筛选
    if (dialogVisible.value || readOnlyVisible.value || deleteDialogVisible.value || recordDialogVisible.value)
      return;
    store.keyword = '';
    store.dueFilter = '';
    store.todayFocus = false;
    store.tagFilters = [];
  }
}

onMounted(() => {
  Promise.all([store.fetchTags(), store.fetchTodos()]).then(() => {
    if (store.highlightKey) applyHighlight(store.highlightKey);
  });
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped lang="scss">
.todo-list-page {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.todo-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}
  .todo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .todo-title {
      h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .todo-subtitle {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--text-muted);
      }
    }

    .todo-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
  }
.todo-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 10px 16px;

  .toolbar-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: nowrap;
  }
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    flex-wrap: nowrap;
    min-width: 0;
  }
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: nowrap;
    flex-shrink: 0;
  }
  .toolbar-tags {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px dashed var(--border-subtle);

    .tags-label-icon {
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .tags-label {
      font-size: 13px;
      color: var(--text-secondary);
      flex-shrink: 0;
    }
    .tags-popover {
      flex: 1;
      min-width: 0;
    }
  }
  .group-select {
    width: 120px;
  }
  .sort-select {
    width: 132px;
  }
  .due-select {
    width: 120px;
  }
  .today-btn {
    flex-shrink: 0;
  }
  .tb-check {
    margin-right: 4px;
  }
}
.search-box {
  position: relative;
  flex: 0 0 200px;
  max-width: 200px;
  width: 200px;

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 16px;
    z-index: 1;
  }
  .search-input {
    :deep(.el-input__wrapper) {
      padding-left: 36px;
      background: var(--bg-base);
      box-shadow: 0 0 0 1px var(--border-subtle) inset;

      &:hover,
      &.is-focus {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }
    }
  }
}
// 第二行标签筛选：触发器占满整行，便于展示多个已选标签
.toolbar-tags .tags-popover {
  flex: 1;
  min-width: 0;

  :deep(.tag-trigger) {
    width: 100%;
  }
}
.todo-stats {
  display: flex;
  align-items: center;
  gap: 14px;

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;

    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);

      &.pending {
        color: var(--color-primary);
      }
      &.completed {
        color: #22c55e;
      }
      &.cancelled {
        color: #9ca3af;
      }
    }
    .stat-label {
      font-size: 11px;
      color: var(--text-muted);
    }
  }
  .stat-divider {
    width: 1px;
    height: 24px;
    background: var(--border-subtle);
  }
}
.todo-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

// 命令面板定位高亮闪烁
:deep(.todo-flash) {
  animation: flash 1.6s ease;
}
@keyframes flash {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
  30% {
    box-shadow: 0 0 0 2px var(--color-primary);
  }
}
</style>
