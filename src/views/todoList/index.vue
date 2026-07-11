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
            <LucideIcon name="Search" class="search-icon" />
            <el-input
              v-model="searchKeyword"
              placeholder="搜索待办内容..."
              clearable
              @input="handleSearch"
              @clear="handleSearch"
              class="search-input"
            />
          </div>
          <div class="priority-filter">
            <el-select
              v-model="selectedPriority"
              placeholder="优先级"
              size="small"
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
              size="small"
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
              size="small"
              clearable
              @change="handleSearch"
            >
              <el-option label="未完成" :value="0" />
              <el-option label="已完成" :value="1" />
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
              <span class="stat-value pending">{{ pendingCount }}</span>
              <span class="stat-label">待完成</span>
            </span>
            <span class="stat-divider"></span>
            <span class="stat-item">
              <span class="stat-value completed">{{ completedCount }}</span>
              <span class="stat-label">已完成</span>
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
          @toggle-complete="handleToggleComplete"
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
  createTime: string;
  updateTime: string;
}

const searchKeyword = ref('');
const selectedPriority = ref('');
const selectedStatus = ref<number | null>(null);
const selectedTag = ref('');
const allTags = ref<Tag[]>([]);
const allTodos = ref<TodoItem[]>([]);
const dialogVisible = ref(false);
const currentTodo = ref<TodoItem | null>(null);
const pageSize = ref(10);
const currentPage = ref(1);
const loading = ref(false);
const hasMore = ref(true);

const totalCount = computed(() => filteredTodos.value.length);
const pendingCount = computed(() => filteredTodos.value.filter(t => t.completed === 0).length);
const completedCount = computed(() => filteredTodos.value.filter(t => t.completed === 1).length);

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

  if (selectedStatus.value === 1) {
    whereClauses.push('completed = 1');
  } else {
    whereClauses.push('completed = 0');
  }

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
      rawTodos.value = cleanData;
    }
  } catch (err) {
    console.error('获取待办失败:', err);
    rawTodos.value = [];
  } finally {
    loading.value = false;
  }
}

const filteredTodos = computed(() => rawTodos.value);

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

function handleToggleComplete(todo: TodoItem) {
  const index = rawTodos.value.findIndex(t => t.key === todo.key);
  if (index > -1) {
    rawTodos.value[index] = todo;
  }
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