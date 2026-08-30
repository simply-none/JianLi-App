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
          <el-button @click="openBatchDelete">
            <LucideIcon name="Trash2" />
            批量删除
          </el-button>
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
            <el-select v-model="store.priorityFilter" placeholder="优先级" size="default" clearable>
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>
            <el-select v-model="store.statusFilter" placeholder="状态" size="default" clearable>
              <el-option v-for="opt in TODO_STATUS_LIST" :key="opt.value" :label="opt.label" :value="opt.value" />
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
        </div>
      </div>

      <div ref="contentRef" class="todo-content">
        <TodoList v-show="store.view === 'card'" :tags="allTags" @view="openView" @edit="openEdit" @delete="handleDelete" @status-change="handleStatusChange" @record="openRecord" @view-parent="openReadOnly" />
        <TodoListView v-show="store.view === 'list'" :tags="allTags" @view="openView" @edit="openEdit" @delete="handleDelete" @status-change="handleStatusChange" @record="openRecord" @view-parent="openReadOnly" />
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

    <RecordProgressDialog
      :visible="recordDialogVisible"
      :todo="recordTodo"
      @update:visible="recordDialogVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import TopTabs from '@/components/TopTabs.vue';
import useTheme from '@/store/useTheme';
import { useTodoStore } from '@/store/useTodo';
import { TODO_STATUS_LIST } from './statusConfig';
import type { TodoItem, Tag } from './types';
import type { TodoView } from '@/store/useTodo';
import TodoList from './TodoList.vue';
import TodoListView from './TodoListView.vue';
import TodoCalendarView from './TodoCalendarView.vue';
import TodoDetailDialog from './TodoDetailDialog.vue';
import TodoBatchDeleteDialog from './TodoBatchDeleteDialog.vue';
import RecordProgressDialog from './RecordProgressDialog.vue';
import TagSelectPopover from './components/TagSelectPopover.vue';

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
const recordDialogVisible = ref(false);
const recordTodo = ref<TodoItem | null>(null);
const contentRef = ref<HTMLElement | null>(null);

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
  const res: any = await window.ipcRenderer.handlePromise('new-sql:upsert', {
    tableName: 'todo_list',
    data: todo,
    config: { primaryKey: 'key' },
  });
  if (res.success) {
    window.ipcRenderer.send('update-todo-reminders');
    ElMessage.success('状态已更新');
    store.fetchTodos();
  } else {
    ElMessage.error('操作失败:' + res.error);
  }
}

async function handleDelete(todo: TodoItem) {
  try {
    await ElMessageBox.confirm('确定要删除这个待办事项吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const res: any = await window.ipcRenderer.handlePromise('new-sql:delete', {
      tableName: 'todo_list',
      condition: { key: todo.key },
    });
    if (res.success) {
      window.ipcRenderer.send('update-todo-reminders');
      ElMessage.success('删除成功');
      store.fetchTodos();
    }
  } catch {
    /* 取消 */
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

onMounted(() => {
  Promise.all([store.fetchTags(), store.fetchTodos()]).then(() => {
    if (store.highlightKey) applyHighlight(store.highlightKey);
  });
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
