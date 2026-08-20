<template>
  <el-scrollbar ref="scrollbarRef" class="todo-list" @scroll="handleScroll">
    <div v-if="todos.length === 0" class="empty-state">
      <el-empty description="暂无待办事项，点击右上角新建吧" />
    </div>
    <div v-else class="todo-grid">
      <div
        v-for="todo in todos"
        :key="todo.key"
        class="todo-card"
        :class="{ 'is-done': todo.status === 'completed', 'is-cancelled': todo.status === 'cancelled' }"
      >
        <el-dropdown
          trigger="click"
          class="todo-status"
          @command="(s: string) => handleChangeStatus(todo, s)"
          @click.stop
        >
          <span
            class="status-badge"
            :style="{
              color: getTodoStatusMeta(todo.status).color,
              background: getTodoStatusMeta(todo.status).bg,
            }"
          >
            {{ getTodoStatusMeta(todo.status).label }}
            <LucideIcon name="ChevronDown" class="status-caret" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="opt in TODO_STATUS_LIST"
                :key="opt.value"
                :command="opt.value"
                :class="{ 'is-active': todo.status === opt.value }"
              >
                {{ opt.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div class="todo-content" @click="$emit('view', todo)">
          <div class="todo-header">
            <h3 class="todo-title">{{ todo.title || '无标题' }}</h3>
            <div class="priority-badge" :class="todo.priority">
              {{ getPriorityText(todo.priority) }}
            </div>
          </div>
          <p class="todo-description">{{ todo.description || '无描述' }}</p>
          <div class="todo-tags" v-if="getTodoTags(todo).length > 0">
            <span
              v-for="tag in getTodoTags(todo)"
              :key="tag.key"
              class="todo-tag"
              :style="{ backgroundColor: tag.color + '20', color: tag.color }"
            >
              {{ tag.name }}
            </span>
          </div>
          <div class="todo-footer">
            <span class="todo-record" @click.stop="emit('record', todo)">
              <LucideIcon name="FileText" class="footer-icon" />
              记录进展
            </span>
            <span class="todo-due" v-if="todo.dueDate">
              <LucideIcon name="Calendar" class="footer-icon" />
              {{ formatDate(todo.dueDate) }}
            </span>
            <span class="todo-remind" v-if="Number(todo.deadlineReminder)">
              <LucideIcon name="Bell" class="footer-icon" />
              提前{{ Number(todo.remindInterval) || 30 }}{{ todo.remindIntervalUnit === 'hour' ? '小时' : '分钟' }} · 提醒{{ Number(todo.remindCount) || 1 }}次
            </span>
            <span class="todo-completed-time" v-if="todo.completedTime">
              <LucideIcon name="CheckCircle" class="footer-icon" />
              {{ formatDate(todo.completedTime) }}
            </span>
            <span class="todo-time">{{ formatTime(todo.updateTime || todo.createTime) }}</span>
          </div>
        </div>
        <el-dropdown trigger="click" @click.stop class="todo-actions">
          <LucideIcon name="EllipsisVertical" class="more-icon" @click.stop />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click.stop="$emit('edit', todo)">
                <LucideIcon name="Pencil" />
                编辑
              </el-dropdown-item>
              <el-dropdown-item divided @click.stop="handleDelete(todo)">
                <LucideIcon name="Trash2" />
                删除
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <div v-if="loading && todos.length > 0" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">加载中...</span>
    </div>
  </el-scrollbar>
</template>

<script setup lang="ts">
import { ref, onMounted, type ComponentPublicInstance } from 'vue';
import { ElMessage, ElMessageBox, ElScrollbar } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import { TODO_STATUS_LIST, getTodoStatusMeta } from './statusConfig';

const scrollbarRef = ref<ComponentPublicInstance<typeof ElScrollbar> | null>(null);

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

const props = defineProps<{
  todos: TodoItem[];
  tags: Tag[];
  loading: boolean;
  hasMore: boolean;
}>();

const emit = defineEmits(['view', 'edit', 'delete', 'load-more', 'status-change', 'record']);

onMounted(() => {
  console.log('TodoList mounted');
});

function handleScroll() {
  const scrollbar = scrollbarRef.value;
  if (!scrollbar) return;

  const wrap = scrollbar.wrapRef;
  if (!wrap) return;

  const { scrollTop, scrollHeight, clientHeight } = wrap;
  const distance = 100;

  if (scrollTop + clientHeight + distance >= scrollHeight) {
    if (!props.loading && props.hasMore) {
      emit('load-more');
    }
  }
}

function getPriorityText(priority: string) {
  const map: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  return map[priority] || '中';
}

function getTodoTags(todo: TodoItem) {
  if (!todo.tags) return [];
  let tagKeys: string[] = [];
  try {
    tagKeys = JSON.parse(todo.tags);
  } catch {
    tagKeys = todo.tags ? [todo.tags] : [];
  }
  return props.tags.filter(t => tagKeys.includes(t.key));
}

function formatDate(date: string) {
  if (!date) return '--';
  return moment(date).format('MM-DD');
}

function formatTime(time: string) {
  if (!time) return '--';
  const now = moment();
  const todoTime = moment(time);
  const diffDays = now.diff(todoTime, 'days');

  if (diffDays === 0) {
    return todoTime.format('HH:mm');
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return diffDays + '天前';
  } else {
    return todoTime.format('YYYY-MM-DD');
  }
}

/** 在列表中直接切换待办状态：写库 + 更新提醒排程 + 通知父组件刷新本地 */
async function handleChangeStatus(todo: TodoItem, newStatus: string) {
  if (todo.status === newStatus) return;

  const isCompleted = newStatus === 'completed';
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const todoData: TodoItem = {
    ...todo,
    status: newStatus,
    completed: isCompleted ? 1 : 0,
    completedTime: isCompleted ? (todo.completedTime || now) : '',
    updateTime: now,
  };

  const result = await window.ipcRenderer.handlePromise('new-sql:upsert', {
    tableName: 'todo_list',
    data: todoData,
    config: { primaryKey: 'key' },
  });

  if (result.success) {
    emit('status-change', todoData);
    // 状态变化会改变提醒资格（已完成/已取消不再提醒），通知主进程重新排程
    window.ipcRenderer.send('update-todo-reminders');
    ElMessage.success('状态已更新为「' + getTodoStatusMeta(newStatus).label + '」');
  } else {
    ElMessage.error('操作失败:' + result.error);
  }
}

async function handleDelete(todo: TodoItem) {
  try {
    await ElMessageBox.confirm('确定要删除这个待办事项吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });

    const result = await window.ipcRenderer.handlePromise('new-sql:delete', {
      tableName: 'todo_list',
      condition: { key: todo.key },
    });

    if (result.success) {
      ElMessage.success('删除成功');
      // 删除后移除其截止提醒排程
      window.ipcRenderer.send('update-todo-reminders');
      emit('delete', todo);
    } else {
      ElMessage.error('删除失败');
    }
  } catch {
    // 用户取消
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

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.todo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.todo-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  gap: 12px;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
    transform: translateY(-2px);
  }

  &.is-done,
  &.is-cancelled {
    .todo-title,
    .todo-description {
      text-decoration: line-through;
    }
  }

  &.is-done {
    opacity: 0.7;

    .todo-title,
    .todo-description {
      color: var(--text-muted);
    }
  }

  &.is-cancelled {
    opacity: 0.6;

    .todo-title,
    .todo-description {
      color: var(--text-muted);
    }
  }
}

.todo-status {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: 2px;

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 12px;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s ease;
    white-space: nowrap;

    &:hover {
      filter: brightness(0.95);
      box-shadow: 0 0 0 1px currentColor inset;
    }

    .status-caret {
      font-size: 12px;
      opacity: 0.7;
    }
  }
}

// 下拉菜单中标记当前状态
:deep(.el-dropdown-menu__item.is-active) {
  color: var(--color-primary);
  font-weight: 600;
}

.todo-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .todo-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;

    .todo-title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.4;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .priority-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
      flex-shrink: 0;

      &.high {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
      }

      &.medium {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      &.low {
        background: rgba(34, 197, 94, 0.15);
        color: #22c55e;
      }
    }
  }

  .todo-description {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    flex: 1;
  }

  .todo-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .todo-tag {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
      line-height: 1.5;
    }
  }

  .todo-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
    flex-wrap: wrap;

    .todo-due,
    .todo-completed-time,
    .todo-remind {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 4px;

      .footer-icon {
        font-size: 12px;
      }
    }

    .todo-record {
      font-size: 12px;
      color: var(--color-primary);
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-weight: 500;
      user-select: none;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 0.75;
      }

      .footer-icon {
        font-size: 12px;
      }
    }

    .todo-remind {
      color: #f59e0b;
    }

    .todo-completed-time {
      color: var(--color-primary);
    }

    .todo-time {
      font-size: 12px;
      color: var(--text-muted);
      margin-left: auto;
    }
  }
}

.todo-actions {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;

  .more-icon {
    font-size: 18px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}
</style>