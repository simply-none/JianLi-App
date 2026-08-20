<template>
  <div class="todo-list-page" :class="['theme-' + currentTheme]">
    <div class="todo-container">
      <div class="todo-header">
        <div class="todo-title">
          <h2>待办事项</h2>
          <p class="todo-subtitle">高效管理你的任务清单</p>
        </div>
        <el-button type="primary" @click="createNewTodo">
          <LucideIcon name="Plus" />
          新建待办
        </el-button>
      </div>

      <div class="todo-toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索待办内容..."
              clearable
              size="default"
              @input="handleSearch"
              @clear="handleSearch"
              class="search-input"
            >
            <template #prefix>
              <LucideIcon name="Search" :size="14" class="search-icon" />
            </template>
          </el-input>
          </div>
          <div class="priority-filter">
            <el-select
              v-model="selectedPriority"
              placeholder="优先级"
              size="default"
              clearable
              @change="handleSearch"
            >
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>
          </div>
          <div class="tag-filter">
            <el-select
              v-model="selectedTag"
              placeholder="标签"
              size="default"
              clearable
              @change="handleSearch"
            >
              <el-option
                v-for="tag in allTags"
                :key="tag.key"
                :label="tag.name"
                :value="tag.key"
              >
                <span
                  class="tag-color-dot"
                  :style="{ backgroundColor: tag.color }"
                ></span>
                {{ tag.name }}
              </el-option>
            </el-select>
          </div>
          <div class="status-filter">
            <el-select
              v-model="selectedStatus"
              placeholder="状态"
              size="default"
              clearable
              @change="handleSearch"
            >
              <el-option
                v-for="opt in TODO_STATUS_LIST"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </div>
        <div class="toolbar-right">
          <div class="todo-stats">
            <span class="stat-item">
              <span class="stat-value">{{ totalCount }}</span>
              <span class="stat-label">总计</span>
            </span>
            <span class="stat-divider"></span>
            <span class="stat-item">
              <span class="stat-value pending">{{ inProgressCount }}</span>
              <span class="stat-label">进行中</span>
            </span>
            <span class="stat-divider"></span>
            <span class="stat-item">
              <span class="stat-value completed">{{ completedCount }}</span>
              <span class="stat-label">已完成</span>
            </span>
            <span class="stat-divider"></span>
            <span class="stat-item">
              <span class="stat-value cancelled">{{ cancelledCount }}</span>
              <span class="stat-label">已取消</span>
            </span>
          </div>
        </div>
      </div>

      <div class="todo-content">
        <TodoList
          :todos="filteredTodos"
          :tags="allTags"
          :loading="loading"
          :has-more="false"
          @view="handleViewTodo"
          @edit="handleEditTodo"
          @delete="handleDeleteTodo"
          @status-change="handleStatusChange"
          @record="handleRecord"
        />
      </div>
    </div>

    <TodoDetailDialog
      :visible="dialogVisible"
      :todo="currentTodo"
      :tags="allTags"
      @update:visible="dialogVisible = $event"
      @save="handleDialogSave"
      @tag-update="fetchTags"
    />

    <RecordProgressDialog
      :visible="recordDialogVisible"
      :todo="recordTodo"
      @update:visible="recordDialogVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import useTheme from '@/store/useTheme';
import TodoList from './TodoList.vue';
import TodoDetailDialog from './TodoDetailDialog.vue';
import RecordProgressDialog from './RecordProgressDialog.vue';
import { TODO_STATUS_LIST, deriveStatusFromCompleted } from './statusConfig';

const themeStore = useTheme();
const { currentTheme } = storeToRefs(themeStore);

interface Tag {
  key: string;
  name: string;
  color: string;
}

interface TodoItem {
  key: string;
  title: string;
  description: string;
  tags: string;
  completed: number;
  completedTime: string;
  priority: string;
  dueDate: string;
  /** 待办状态：not_started/in_progress/blocked/completed/cancelled/restart，默认 not_started */
  status?: string;
  deadlineReminder?: number;
  remindCount?: number;
  remindInterval?: number;
  remindIntervalUnit?: string;
  createTime: string;
  updateTime: string;
}

const searchKeyword = ref('');
const selectedPriority = ref('');
const selectedStatus = ref<string | null>(null);
const selectedTag = ref('');
const allTags = ref<Tag[]>([]);
const allTodos = ref<TodoItem[]>([]);
const dialogVisible = ref(false);
const currentTodo = ref<TodoItem | null>(null);
const recordDialogVisible = ref(false);
const recordTodo = ref<TodoItem | null>(null);
const pageSize = ref(10);
const currentPage = ref(1);
const loading = ref(false);
const hasMore = ref(true);

/** 由待办派生出有效状态（兼容旧数据无 status 字段的情况） */
function effectiveStatus(todo: TodoItem): string {
  return todo.status || deriveStatusFromCompleted(todo.completed);
}

const totalCount = computed(() => rawTodos.value.length);
const inProgressCount = computed(() => rawTodos.value.filter(t => effectiveStatus(t) === 'in_progress').length);
const completedCount = computed(() => rawTodos.value.filter(t => effectiveStatus(t) === 'completed').length);
const cancelledCount = computed(() => rawTodos.value.filter(t => effectiveStatus(t) === 'cancelled').length);

async function fetchTags() {
  try {
    const result = await window.ipcRenderer.handlePromise('new-sql:query', {
      tableName: 'todo_tags',
      conditions: {},
    });
    if (result.success) {
      allTags.value = result.data || [];
    } else {
      allTags.value = [];
    }
  } catch (error) {
    console.error('获取标签失败:', error);
    allTags.value = [];
  }
}

const rawTodos = ref<TodoItem[]>([]);

async function fetchTodos() {
  if (loading.value) return;

  loading.value = true;

  let sql = 'SELECT * FROM todo_list';
  const params: any[] = [];
  const whereClauses: string[] = [];

  if (searchKeyword.value.trim()) {
    whereClauses.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${searchKeyword.value}%`, `%${searchKeyword.value}%`);
  }

  if (selectedPriority.value) {
    whereClauses.push('priority = ?');
    params.push(selectedPriority.value);
  }

  if (selectedTag.value) {
    whereClauses.push("tags LIKE ?");
    params.push(`%"${selectedTag.value}"%`);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ' ORDER BY updateTime DESC';

  try {
    const result = await window.ipcRenderer.handlePromise('new-sql:execute', {
      sql,
      params,
      primaryKey: 'key',
    });

    if (result.success) {
      const data = result.data?.rows || [];
      const cleanData = data.filter((item: any) =>
        item && typeof item === 'object' && !item.$el && !item.$options && !item._componentTag
      );
      // 归一化：旧数据无 status 字段时按 completed 推导，保证列表/筛选/统计一致
      rawTodos.value = cleanData.map((item: any) => ({
        ...item,
        status: item.status || deriveStatusFromCompleted(item.completed),
      }));
    }
  } catch (err) {
    console.error('获取待办失败:', err);
    rawTodos.value = [];
  } finally {
    loading.value = false;
  }
}

// 状态筛选（客户端）：默认仅展示未完结（排除已完成、已取消）
const filteredTodos = computed(() => {
  if (!selectedStatus.value) {
    return rawTodos.value.filter(t => {
      const s = effectiveStatus(t);
      return s !== 'completed' && s !== 'cancelled';
    });
  }
  return rawTodos.value.filter(t => effectiveStatus(t) === selectedStatus.value);
});

function handleSearch() {
  fetchTodos();
}

function createNewTodo() {
  currentTodo.value = null;
  dialogVisible.value = true;
}

function handleViewTodo(todo: TodoItem) {
  currentTodo.value = { ...todo };
  dialogVisible.value = true;
}

function handleEditTodo(todo: TodoItem) {
  currentTodo.value = { ...todo };
  dialogVisible.value = true;
}

function handleDeleteTodo(todo: TodoItem) {
  const index = rawTodos.value.findIndex(t => t.key === todo.key);
  if (index > -1) {
    rawTodos.value.splice(index, 1);
  }
}

function handleStatusChange(todo: TodoItem) {
  const index = rawTodos.value.findIndex(t => t.key === todo.key);
  if (index > -1) {
    rawTodos.value[index] = todo;
  }
}

/** 打开「记录进展」弹窗，把进展保存到以待办名称为主题的主题对话中 */
function handleRecord(todo: TodoItem) {
  recordTodo.value = { ...todo };
  recordDialogVisible.value = true;
}

async function handleDialogSave(todoData: TodoItem) {
  fetchTags().then(() => {
    fetchTodos();
  });
}

function handleDialogClose() {
  currentTodo.value = null;
}

onMounted(async () => {
  Promise.all([fetchTags(), fetchTodos()]);
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
  gap: 16px;
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
}

.todo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 12px 16px;
  gap: 12px;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .toolbar-right {
    flex-shrink: 0;
  }
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 300px;

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

      &:hover {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }
    }
  }
}

.priority-filter,
.status-filter,
.tag-filter {
  min-width: 100px;
}

.tag-color-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.todo-stats {
  display: flex;
  align-items: center;
  gap: 16px;

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
</style>