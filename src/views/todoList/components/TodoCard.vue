<!--
  单张待办卡片（卡片视图的最小单元）
  优化点（对照需求）：
  - 信息降噪：默认仅突出 标题/状态/优先级/截止，描述与标签折叠，次要时间隐藏
  - 层级缩进：含子任务时显示进度条，可展开子任务清单并直接勾选
  - 统一密度：统一内边距/圆角/对齐，悬停仅做轻量边框高亮（无重阴影）
  - 重复标记：周期任务显示「每天/每周」徽标
-->
<template>
  <div
    class="todo-card"
    :data-todo-key="todo.key"
    :class="{ 'is-done': isDone, 'is-cancelled': isCancelled }"
  >
    <!-- 左侧：状态切换下拉 + 主体 -->
    <div class="card-main" @click="$emit('view', todo)">
      <div class="card-top">
        <el-dropdown
          trigger="click"
          class="todo-status"
          @command="(s: string) => changeStatus(s)"
          @click.stop
        >
          <span
            class="status-badge"
            :style="{ color: meta.color, background: meta.bg }"
          >
            {{ meta.label }}
            <LucideIcon name="ChevronDown" :size="12" class="status-caret" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="opt in TODO_STATUS_LIST"
                :key="opt.value"
                :command="opt.value"
                :class="{ 'is-active': effectiveStatus === opt.value }"
              >
                {{ opt.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <div class="priority-badge" :class="todo.priority">
          {{ priorityText }}
        </div>

        <span v-if="todo.recurrenceRule" class="repeat-badge" :title="recurrenceText">
          <LucideIcon name="Repeat" :size="12" />
          {{ recurrenceText }}
        </span>

        <span v-if="isSubtask" class="subtask-badge" title="子任务（已关联父任务）">
          <LucideIcon name="ListTree" :size="12" />
          子任务
        </span>

        <el-dropdown trigger="click" class="todo-actions" @click.stop>
          <LucideIcon name="EllipsisVertical" class="more-icon" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click.stop="$emit('edit', todo)">
                <LucideIcon name="Pencil" /> 编辑
              </el-dropdown-item>
              <el-dropdown-item divided @click.stop="handleDelete">
                <LucideIcon name="Trash2" /> 删除
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <h3 class="todo-title">{{ todo.title || '无标题' }}</h3>

      <!-- 描述：默认折叠，按需展开 -->
      <p v-if="showDesc" class="todo-description">{{ todo.description }}</p>
      <button
        v-if="todo.description"
        class="desc-toggle"
        @click.stop="showDesc = !showDesc"
      >
        {{ showDesc ? '收起描述' : '展开描述' }}
      </button>

      <!-- 标签：紧凑 chip -->
      <div v-if="todoTags.length" class="todo-tags">
        <span
          v-for="tag in todoTags"
          :key="tag.key"
          class="todo-tag"
          :style="{ backgroundColor: tag.color + '20', color: tag.color }"
        >
          {{ tag.name }}
        </span>
      </div>

      <!-- 子任务进度（父任务视角：统计其直接子任务的完成度） -->
      <div v-if="progress" class="subtask-block">
        <TodoSubtaskProgress :done="progress.done" :total="progress.total" />
      </div>

      <!-- 关联父任务（子任务视角：展示其归属的父任务，tag 形式，可点击查看只读详情） -->
      <div v-if="parentItems.length" class="parent-chips">
        <LucideIcon name="CornerDownRight" :size="12" class="parent-icon" />
        <span class="parent-label">父任务</span>
        <span
          v-for="p in parentItems"
          :key="p.key"
          class="parent-chip clickable"
          :title="'查看父任务：' + p.title"
          @click.stop="$emit('view-parent', p)"
        >{{ p.title }}</span>
      </div>

      <!-- 底部信息：截止 + 记录进展 -->
      <div class="todo-footer">
        <span v-if="todo.dueDate" class="todo-due">
          <LucideIcon name="Calendar" :size="12" />
          {{ formatDate(todo.dueDate) }}
        </span>
        <span class="todo-record" @click.stop="$emit('record', todo)">
          <LucideIcon name="FileText" :size="12" /> 记录进展
        </span>
        <span class="todo-time">{{ formatTime(todo.updateTime || todo.createTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import { useTodoStore } from '@/store/useTodo';
import { TODO_STATUS_LIST, getTodoStatusMeta, formatRecurrence } from '../statusConfig';
import type { TodoItem, Tag } from '../types';
import TodoSubtaskProgress from './TodoSubtaskProgress.vue';

const props = defineProps<{
  todo: TodoItem;
  tags: Tag[];
}>();

const emit = defineEmits<{
  (e: 'view', todo: TodoItem): void;
  (e: 'edit', todo: TodoItem): void;
  (e: 'delete', todo: TodoItem): void;
  (e: 'status-change', todo: TodoItem): void;
  (e: 'record', todo: TodoItem): void;
  (e: 'view-parent', todo: TodoItem): void;
}>();

const store = useTodoStore();

const showDesc = ref(false);

const meta = computed(() => getTodoStatusMeta(props.todo.status));
const effectiveStatus = computed(() => store.effectiveStatus(props.todo));
const isDone = computed(() => effectiveStatus.value === 'completed');
const isCancelled = computed(() => effectiveStatus.value === 'cancelled');

const priorityText = computed(() => ({ high: '高', medium: '中', low: '低' }[props.todo.priority] || '中'));

const todoTags = computed(() => {
  try {
    const keys = JSON.parse(props.todo.tags || '[]') as string[];
    return props.tags.filter((t) => keys.includes(t.key));
  } catch {
    return [];
  }
});

const progress = computed(() => store.subtaskProgress(props.todo.key));
const isSubtask = computed(() => store.isSubtask(props.todo));
const parentItems = computed(() => store.parentItemsOf(props.todo));

const recurrenceText = computed(() =>
  formatRecurrence(props.todo.recurrenceRule, props.todo.recurrenceInterval, props.todo.recurrenceWeekdays),
);

function changeStatus(newStatus: string) {
  if (effectiveStatus.value === newStatus) return;
  const isCompleted = newStatus === 'completed';
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const updated: TodoItem = {
    ...props.todo,
    status: newStatus as TodoItem['status'],
    completed: isCompleted ? 1 : 0,
    completedTime: isCompleted ? props.todo.completedTime || now : '',
    updateTime: now,
  };
  emit('status-change', updated);
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm('确定要删除这个待办事项吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    emit('delete', props.todo);
  } catch {
    /* 用户取消 */
  }
}

function formatDate(date: string) {
  return date ? moment(date).format('MM-DD') : '--';
}
function formatTime(time: string) {
  if (!time) return '--';
  const now = moment();
  const t = moment(time);
  const d = now.diff(t, 'days');
  if (d === 0) return t.format('HH:mm');
  if (d === 1) return '昨天';
  if (d < 7) return d + '天前';
  return t.format('YYYY-MM-DD');
}
</script>

<style scoped lang="scss">
.todo-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px;
  cursor: pointer;
  transition: border-color 0.18s ease;
  display: flex;

  &:hover {
    border-color: var(--color-primary);
  }

  &.is-done,
  &.is-cancelled {
    .todo-title {
      text-decoration: line-through;
      color: var(--text-muted);
    }
  }

  &.is-done {
    opacity: 0.72;
  }
}

.card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 8px;

  .todo-status {
    flex-shrink: 0;

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

      .status-caret {
        opacity: 0.7;
      }
    }
  }

  .priority-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;

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

  .repeat-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    color: var(--color-primary);
    background: var(--color-primary-light, rgba(99, 102, 241, 0.12));
    white-space: nowrap;
  }

  .todo-actions {
    margin-left: auto;
    flex-shrink: 0;

    .more-icon {
      font-size: 18px;
      color: var(--text-muted);
      padding: 4px;
      border-radius: 4px;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }
  }
}

:deep(.el-dropdown-menu__item.is-active) {
  color: var(--color-primary);
  font-weight: 600;
}

.todo-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.desc-toggle {
  align-self: flex-start;
  border: none;
  background: none;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
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

  .subtask-block {
    border-top: 1px dashed var(--border-subtle);
    padding-top: 8px;
  }

  .parent-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;

    .parent-icon {
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .parent-label {
      font-size: 12px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .parent-chip {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 10px;
      color: var(--color-primary);
      background: var(--color-primary-light, rgba(99, 102, 241, 0.12));
      border: 1px solid var(--color-primary-light, rgba(99, 102, 241, 0.35));
      line-height: 1.5;

      &.clickable {
        cursor: pointer;

        &:hover {
          background: var(--color-primary);
          color: #fff;
          border-color: var(--color-primary);
        }
      }
    }
  }

  .subtask-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    color: #7c3aed;
    background: rgba(124, 58, 237, 0.12);
    white-space: nowrap;
  }

.todo-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
  flex-wrap: wrap;

  .todo-due {
    font-size: 12px;
    color: var(--text-muted);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .todo-record {
    font-size: 12px;
    color: var(--color-primary);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-weight: 500;

    &:hover {
      opacity: 0.75;
    }
  }

  .todo-time {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: auto;
  }
}
</style>
