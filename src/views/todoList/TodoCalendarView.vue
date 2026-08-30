<!--
  待办日历视图（自研轻量月历，零新依赖）
  - 顶部 el-date-picker 选择月份 + 上/下月切换
  - 月历网格按 dueDate 聚合待办；单元格显示当日待办数量与优先级色点
  - 点击某天，下方列出当天待办，可快速切换状态 / 编辑 / 删除
  - 全部走主题 token，与设置里的主题联动
-->
<template>
  <div class="todo-calendar">
    <div class="cal-toolbar">
      <el-date-picker
        v-model="monthModel"
        type="month"
        placeholder="选择月份"
        format="YYYY-MM"
        value-format="YYYY-MM"
        size="default"
      />
      <div class="cal-nav">
        <el-button circle @click="prevMonth"><LucideIcon name="ChevronLeft" :size="16" /></el-button>
        <span class="cal-current">{{ calendarMonth }}</span>
        <el-button circle @click="nextMonth"><LucideIcon name="ChevronRight" :size="16" /></el-button>
      </div>
      <div class="cal-legend">
        <span class="lg"><i class="dot" style="background:#ef4444" />高</span>
        <span class="lg"><i class="dot" style="background:#f59e0b" />中</span>
        <span class="lg"><i class="dot" style="background:#22c55e" />低</span>
      </div>
    </div>

    <div class="cal-grid">
      <div v-for="w in WEEKDAYS" :key="w" class="cal-weekday">{{ w }}</div>
      <div
        v-for="cell in monthCells"
        :key="cell.date"
        class="cal-cell"
        :class="{ 'is-other': !cell.inMonth, 'is-selected': cell.date === dayPop.date }"
        @click="selectDay(cell.date, $event)"
      >
        <div class="cell-head">
          <span class="cell-day">{{ cell.day }}</span>
          <span v-if="isToday(cell.date)" class="today-flag">今天</span>
        </div>
        <div class="cell-dots">
          <i
            v-for="t in cell.todos.slice(0, 3)"
            :key="t.key"
            class="dot"
            :style="{ background: priorityColor(t) }"
            :title="t.title"
          />
          <span v-if="cell.todos.length > 3" class="more">+{{ cell.todos.length - 3 }}</span>
        </div>
      </div>
    </div>

    <!-- 点击日期弹出当日待办列表（锚定在日期格） -->
    <el-popover
      :visible="dayPop.visible"
      :virtual-ref="dayPopAnchor"
      virtual-triggering
      placement="bottom-start"
      :width="320"
      :show-arrow="false"
      popper-class="tag-day-pop"
      :popper-style="{ padding: '0' }"
    >
      <div class="day-pop">
        <div class="day-pop-header">
          <span class="dp-date">{{ dayPop.date || '未选择日期' }}</span>
          <span class="dp-count">{{ dayPopTodos.length }} 条待办</span>
          <LucideIcon name="X" class="dp-close" @click="dayPop.visible = false" />
        </div>
        <el-scrollbar class="day-pop-list">
          <div v-if="!dayPopTodos.length" class="dp-empty">这一天没有待办</div>
          <div
            v-for="t in dayPopTodos"
            :key="t.key"
            class="dp-item"
            :class="{ 'is-done': store.effectiveStatus(t) === 'completed' }"
          >
            <el-checkbox
              :model-value="store.effectiveStatus(t) === 'completed'"
              @change="(v: any) => changeStatus(t, v)"
            />
            <span class="dp-title" @click="openDetail(t)">{{ t.title || '无标题' }}</span>
            <span v-if="store.isSubtask(t)" class="dp-sub">子</span>
            <span
              v-for="p in parentItemsOf(t)"
              :key="'p' + p.key"
              class="dp-parent clickable"
              :title="'查看父任务：' + p.title"
              @click.stop="emit('view-parent', p)"
            >↳ {{ p.title }}</span>
            <span class="dp-priority" :class="t.priority">{{ priorityText(t.priority) }}</span>
            <LucideIcon name="Pencil" class="dp-edit" @click="openDetail(t, true)" />
          </div>
        </el-scrollbar>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, nextTick, reactive, ref } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import { useTodoStore } from '@/store/useTodo';
import type { TodoItem, Tag } from './types';

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
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const calendarMonth = computed(() => store.calendarMonth);

// 点击日期弹窗状态：锚定在日期格，显示当日待办列表
const dayPop = reactive({ visible: false, date: '' });
const dayPopAnchor = ref<HTMLElement | null>(null);
const dayPopTodos = computed<TodoItem[]>(() =>
  dayPop.date ? store.calendarMap[dayPop.date] || [] : [],
);

// 月份选择双向绑定到 store
const monthModel = computed({
  get: () => store.calendarMonth,
  set: (v: string) => {
    store.calendarMonth = v || moment().format('YYYY-MM');
  },
});

onMounted(() => {
  if (!store.calendarMonth) store.calendarMonth = moment().format('YYYY-MM');
  if (!store.selectedDate) store.selectedDate = moment().format('YYYY-MM-DD');
  document.addEventListener('click', onDocClick, true);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true);
});

function prevMonth() {
  store.calendarMonth = moment(store.calendarMonth, 'YYYY-MM').subtract(1, 'month').format('YYYY-MM');
}
function nextMonth() {
  store.calendarMonth = moment(store.calendarMonth, 'YYYY-MM').add(1, 'month').format('YYYY-MM');
}
/** 点击日期：弹出锚定在该日期格的当日待办列表 */
async function selectDay(date: string, e: MouseEvent) {
  store.selectedDate = date;
  const anchorEl = e.currentTarget as HTMLElement; // 事件结束前保存锚点引用
  if (dayPop.visible && dayPop.date === date) {
    dayPop.visible = false;
    return;
  }
  dayPop.date = date;
  dayPopAnchor.value = anchorEl;
  // 先关闭再打开，强制 popper 重新定位到新锚点
  dayPop.visible = false;
  await nextTick();
  dayPop.visible = true;
}

/** 打开详情（查看/编辑），先关闭日历弹窗 */
function openDetail(t: TodoItem, edit = false) {
  dayPop.visible = false;
  if (edit) emit('edit', t);
  else emit('view', t);
}

/** 点击空白区域关闭弹窗（popover 内部与日期格内不关闭） */
function onDocClick(e: MouseEvent) {
  if (!dayPop.visible) return;
  const popEl = document.querySelector('.tag-day-pop');
  if (popEl && popEl.contains(e.target as Node)) return;
  if ((e.target as HTMLElement).closest('.cal-cell')) return;
  dayPop.visible = false;
}

/** 当前月网格（含上月/下月的补齐格） */
const monthCells = computed(() => {
  const base = moment(store.calendarMonth, 'YYYY-MM').startOf('month');
  const startWeekday = base.day(); // 0=周日
  const gridStart = base.clone().subtract(startWeekday, 'days');
  const daysInGrid = 42; // 6 周 * 7
  const cells: { date: string; day: number; inMonth: boolean; todos: TodoItem[] }[] = [];
  for (let i = 0; i < daysInGrid; i++) {
    const d = gridStart.clone().add(i, 'days');
    const dateStr = d.format('YYYY-MM-DD');
    const inMonth = d.month() === base.month();
    cells.push({
      date: dateStr,
      day: d.date(),
      inMonth,
      todos: store.calendarMap[dateStr] || [],
    });
  }
  return cells;
});

function isToday(date: string) {
  return date === moment().format('YYYY-MM-DD');
}

function priorityColor(t: TodoItem) {
  return { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }[t.priority] || '#9ca3af';
}
const priorityText = (p: string) => ({ high: '高', medium: '中', low: '低' }[p] || '中');

/** 取某待办关联的父任务对象列表（用于日历弹窗点击查看父级只读详情） */
function parentItemsOf(t: TodoItem): TodoItem[] {
  return store.parentItemsOf(t);
}

function changeStatus(item: TodoItem, checked: boolean) {
  const newStatus = checked ? 'completed' : 'not_started';
  if (store.effectiveStatus(item) === newStatus) return;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const updated: TodoItem = {
    ...item,
    status: newStatus as TodoItem['status'],
    completed: checked ? 1 : 0,
    completedTime: checked ? now : '',
    updateTime: now,
  };
  emit('status-change', updated);
}
</script>

<style scoped lang="scss">
.todo-calendar {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.cal-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  .cal-nav {
    display: flex;
    align-items: center;
    gap: 8px;

    .cal-current {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      min-width: 84px;
      text-align: center;
    }
  }

  .cal-legend {
    margin-left: auto;
    display: flex;
    gap: 12px;

    .lg {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--text-muted);

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
    }
  }
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;

  .cal-weekday {
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
    padding-bottom: 4px;
  }

  .cal-cell {
    min-height: 72px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 6px;
    cursor: pointer;
    transition: border-color 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 4px;

    &:hover {
      border-color: var(--color-primary);
    }

    &.is-other {
      opacity: 0.4;
    }

    &.is-selected {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary) inset;
    }

    .cell-head {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .cell-day {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .today-flag {
        font-size: 10px;
        color: var(--color-primary);
      }
    }

    .cell-dots {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      align-items: center;

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
      }

      .more {
        font-size: 10px;
        color: var(--text-muted);
      }
    }
  }
}

.day-pop {
  display: flex;
  flex-direction: column;
  max-height: 360px;

  .day-pop-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-subtle);

    .dp-date {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .dp-count {
      font-size: 12px;
      color: var(--text-muted);
    }
    .dp-close {
      margin-left: auto;
      font-size: 16px;
      color: var(--text-muted);
      cursor: pointer;

      &:hover {
        color: var(--color-primary);
      }
    }
  }

  .day-pop-list {
    flex: 1;
    min-height: 0;
    padding: 0 12px;

    .dp-empty {
      color: var(--text-muted);
      font-size: 13px;
      text-align: center;
      padding: 20px 0;
    }

    .dp-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-subtle);

      &.is-done .dp-title {
        text-decoration: line-through;
        color: var(--text-muted);
      }

      .dp-title {
        flex: 1;
        font-size: 14px;
        color: var(--text-primary);
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dp-sub {
        font-size: 11px;
        padding: 0 6px;
        border-radius: 8px;
        background: rgba(124, 58, 237, 0.12);
        color: #7c3aed;
        flex-shrink: 0;
      }

      .dp-parent {
        font-size: 11px;
        padding: 0 6px;
        border-radius: 8px;
        background: var(--color-primary-light, rgba(99, 102, 241, 0.12));
        color: var(--color-primary, #6366f1);
        flex-shrink: 0;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &.clickable {
          cursor: pointer;

          &:hover {
            background: var(--color-primary);
            color: #fff;
          }
        }
      }

      .dp-priority {
        font-size: 11px;
        padding: 1px 7px;
        border-radius: 8px;

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

      .dp-edit {
        font-size: 16px;
        color: var(--text-muted);
        cursor: pointer;

        &:hover {
          color: var(--color-primary);
        }
      }
    }
  }
}
</style>
