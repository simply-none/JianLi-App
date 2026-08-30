<!--
  待办列表视图（紧凑纵向列表）
  - 接入通用 VirtualList 做长列表虚拟化（定高快路径），避免大量待办时卡顿
  - 每行展示：状态、标题、优先级、截止、子任务进度、标签、操作
  - 复用 useTodo store 的过滤结果；事件透传给父页面（index.vue）
-->
<template>
  <div class="todo-list-view">
    <VirtualList
      v-if="items.length"
      :items="items"
      item-key="key"
      :item-height="64"
      :gap="8"
      :loading="loading"
      class="vl"
    >
      <template #default="{ item }">
        <div class="todo-row" :data-todo-key="item.key" :class="{ 'is-done': store.effectiveStatus(item) === 'completed' }">
          <el-dropdown
            trigger="click"
            class="row-status"
            @command="(s: string) => changeStatus(item, s)"
            @click.stop
          >
            <span class="status-dot" :style="{ background: dotColor(item) }" :title="store.effectiveStatus(item)" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="opt in TODO_STATUS_LIST"
                  :key="opt.value"
                  :command="opt.value"
                  :class="{ 'is-active': store.effectiveStatus(item) === opt.value }"
                >
                  {{ opt.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <div class="row-main" @click="emit('view', item)">
            <div class="row-line1">
              <span class="row-title">{{ item.title || '无标题' }}</span>
              <span class="priority-tag" :class="item.priority">{{ priorityText(item.priority) }}</span>
              <span v-if="item.recurrenceRule" class="repeat-tag">
                <LucideIcon name="Repeat" :size="11" /> {{ recurrenceText(item) }}
              </span>
              <span v-if="isSubtaskOf(item)" class="sub-tag">子</span>
            </div>
            <!-- 关联父任务：单独第二行，每个父任务用 tag 形式，可点击查看只读详情 -->
            <div v-if="parentItemsOf(item).length" class="row-line2 parent-line">
              <LucideIcon name="CornerDownRight" :size="12" class="parent-line-icon" />
              <span class="parent-line-label">父任务</span>
              <span
                v-for="p in parentItemsOf(item)"
                :key="'p' + p.key"
                class="parent-tag clickable"
                :title="'查看父任务：' + p.title"
                @click.stop="emit('view-parent', p)"
              >{{ p.title }}</span>
            </div>
            <div class="row-line3">
              <span v-if="item.dueDate" class="row-due">
                <LucideIcon name="Calendar" :size="11" /> {{ formatDate(item.dueDate) }}
              </span>
              <TodoSubtaskProgress
                v-if="progressOf(item)"
                :done="progressOf(item)!.done"
                :total="progressOf(item)!.total"
              />
              <span v-for="tag in tagsOf(item)" :key="tag.key" class="row-tag" :style="{ color: tag.color }">
                {{ tag.name }}
              </span>
            </div>
          </div>

          <div class="row-actions" @click.stop>
            <span class="row-record" @click="emit('record', item)">
              <LucideIcon name="FileText" :size="14" />
            </span>
            <el-dropdown trigger="click" @click.stop>
              <LucideIcon name="EllipsisVertical" class="more-icon" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click.stop="emit('edit', item)">
                    <LucideIcon name="Pencil" /> 编辑
                  </el-dropdown-item>
                  <el-dropdown-item divided @click.stop="emit('delete', item)">
                    <LucideIcon name="Trash2" /> 删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
      <template #empty>
        <el-empty description="暂无待办事项" />
      </template>
    </VirtualList>

    <el-empty v-else description="暂无待办事项，点击右上角新建吧" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import VirtualList from '@/components/VirtualList.vue';
import { useTodoStore } from '@/store/useTodo';
import { TODO_STATUS_LIST, getTodoStatusMeta, formatRecurrence } from './statusConfig';
import type { TodoItem, Tag } from './types';
import TodoSubtaskProgress from './components/TodoSubtaskProgress.vue';

const props = defineProps<{
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
const items = computed(() => store.filteredTodos);
const loading = computed(() => store.loading);

const priorityText = (p: string) => ({ high: '高', medium: '中', low: '低' }[p] || '中');

function dotColor(item: TodoItem) {
  return getTodoStatusMeta(item.status).color;
}

function recurrenceText(item: TodoItem) {
  return formatRecurrence(item.recurrenceRule, item.recurrenceInterval, item.recurrenceWeekdays);
}

function tagsOf(item: TodoItem): Tag[] {
  try {
    const keys = JSON.parse(item.tags || '[]') as string[];
    return props.tags.filter((t) => keys.includes(t.key));
  } catch {
    return [];
  }
}

function progressOf(item: TodoItem) {
  return store.subtaskProgress(item.key);
}

function isSubtaskOf(item: TodoItem) {
  return store.isSubtask(item);
}

function parentItemsOf(item: TodoItem): TodoItem[] {
  return store.parentItemsOf(item);
}

function changeStatus(item: TodoItem, newStatus: string) {
  if (store.effectiveStatus(item) === newStatus) return;
  const isCompleted = newStatus === 'completed';
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const updated: TodoItem = {
    ...item,
    status: newStatus as TodoItem['status'],
    completed: isCompleted ? 1 : 0,
    completedTime: isCompleted ? item.completedTime || now : '',
    updateTime: now,
  };
  emit('status-change', updated);
}

function formatDate(date: string) {
  return date ? moment(date).format('MM-DD') : '--';
}
</script>

<style scoped lang="scss">
.todo-list-view {
  width: 100%;
  height: 100%;
}

.vl {
  height: 100%;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
  padding: 0 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  transition: border-color 0.18s ease;

  &:hover {
    border-color: var(--color-primary);
  }

  &.is-done .row-title {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .row-status {
    flex-shrink: 0;
    cursor: pointer;

    .status-dot {
      display: block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  }

  .row-main {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;

    .row-line1 {
      display: flex;
      align-items: center;
      gap: 8px;

      .row-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .priority-tag {
        font-size: 11px;
        padding: 1px 7px;
        border-radius: 8px;
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

      .repeat-tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .sub-tag {
        font-size: 11px;
        padding: 1px 7px;
        border-radius: 8px;
        flex-shrink: 0;
        background: rgba(124, 58, 237, 0.12);
        color: #7c3aed;
      }
    }

    .row-line2 {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      padding-left: 2px;

      .parent-line-icon {
        color: var(--text-muted);
        flex-shrink: 0;
      }
      .parent-line-label {
        font-size: 12px;
        color: var(--text-muted);
        flex-shrink: 0;
      }
    }

    .row-line3 {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;

      .row-due {
        font-size: 12px;
        color: var(--text-muted);
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }

      .row-tag {
        font-size: 12px;
      }
    }

    // 关联父任务 chip：与卡片 .parent-chip 保持一致，作用域提到 .row-main，避免被 .row-line* 嵌套失效
    .parent-tag {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 10px;
      color: var(--color-primary);
      background: var(--color-primary-light, rgba(99, 102, 241, 0.12));
      border: 1px solid var(--color-primary-light, rgba(99, 102, 241, 0.35));
      flex-shrink: 0;
      white-space: nowrap;
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

  .row-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;

    .row-record {
      color: var(--color-primary);
      cursor: pointer;
      display: inline-flex;
    }

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
</style>
