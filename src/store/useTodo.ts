/**
 * 待办统一状态仓库（Pinia）
 * 职责：收敛 todo_list 的查询、筛选、统计、分组与子任务树，供主页面与 todoMiniWindow 共用，
 * 消除原先分散在各组件内的重复查询逻辑。视图切换（卡片/列表/日历）、分组方式、筛选条件均在此集中。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as api from '@/views/todoList/api/todoApi';
import type { TodoItem, Tag } from '@/views/todoList/types';
import { deriveStatusFromCompleted } from '@/views/todoList/statusConfig';

/** 分组「无父任务」的占位 key */
const NONE_PARENT = '__none__';

export type TodoView = 'card' | 'list' | 'calendar';
export type GroupBy = 'none' | 'status' | 'due' | 'parent';

export interface TodoGroup {
  key: string;
  label: string;
  items: TodoItem[];
}

export const useTodoStore = defineStore('todo', () => {
  // ===== 数据 =====
  const todos = ref<TodoItem[]>([]);
  const tags = ref<Tag[]>([]);
  const loading = ref(false);

  // ===== 筛选条件 =====
  const keyword = ref('');
  const priorityFilter = ref('');
  const statusFilter = ref<string | null>(null); // 指定状态；null=默认（隐藏已完成/已取消）
  const tagFilters = ref<string[]>([]); // 标签多选：命中任一选中标签即显示（或逻辑）
  const showCompleted = ref(false);
  const showTemplates = ref(false); // 是否显示重复任务模板

  // ===== 视图态 =====
  const view = ref<TodoView>('card');
  const groupBy = ref<GroupBy>('none');
  const calendarMonth = ref(''); // YYYY-MM，日历当前月
  const selectedDate = ref(''); // YYYY-MM-DD，日历选中日
  const highlightKey = ref(''); // 命令面板跳转定位用

  // ===== 读取 =====
  async function fetchTodos() {
    loading.value = true;
    try {
      todos.value = await api.fetchAllTodos();
    } finally {
      loading.value = false;
    }
  }

  async function fetchTags() {
    tags.value = await api.fetchTags();
  }

  /** 取有效状态（兼容旧数据无 status 字段） */
  function effectiveStatus(t: TodoItem): string {
    return t.status || deriveStatusFromCompleted(t.completed);
  }

  // ===== 客户端过滤（无 SQL，杜绝注入与 execute）=====
  const filteredTodos = computed<TodoItem[]>(() => {
    let list = todos.value;

    // 默认隐藏重复模板（模板仅用于生成实例），开启 showTemplates 才显示
    if (!showTemplates.value) {
      list = list.filter((t) => !(t.recurrenceRule && !t.recurrenceId));
    }
    // 子任务作为独立待办展示（通过 parentIds 在卡片/列表中标记「父任务」），不再隐藏
    if (keyword.value.trim()) {
      const k = keyword.value.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(k) ||
          (t.description || '').toLowerCase().includes(k),
      );
    }
    if (priorityFilter.value) {
      list = list.filter((t) => t.priority === priorityFilter.value);
    }
    if (tagFilters.value.length) {
      // 或逻辑：待办携带任一选中标签即保留
      list = list.filter((t) => {
        try {
          const keys = JSON.parse(t.tags || '[]') as string[];
          return tagFilters.value.some((f) => keys.includes(f));
        } catch {
          return false;
        }
      });
    }
    if (statusFilter.value) {
      list = list.filter((t) => effectiveStatus(t) === statusFilter.value);
    } else if (!showCompleted.value) {
      list = list.filter((t) => {
        const s = effectiveStatus(t);
        return s !== 'completed' && s !== 'cancelled';
      });
    }
    return list;
  });

  // ===== 统计 =====
  const totalCount = computed(() => todos.value.length);
  const inProgressCount = computed(
    () => todos.value.filter((t) => effectiveStatus(t) === 'in_progress').length,
  );
  const completedCount = computed(
    () => todos.value.filter((t) => effectiveStatus(t) === 'completed').length,
  );
  const cancelledCount = computed(
    () => todos.value.filter((t) => effectiveStatus(t) === 'cancelled').length,
  );

  // ===== 子任务关联（可多父）=====
  /** 是否子任务：parentIds 非空 */
  function isSubtask(t: TodoItem): boolean {
    return !!(t.parentIds && t.parentIds.length);
  }

  /** 取某任务的直属子任务（parentIds 含该 key 即为其子；按 sortOrder 排序） */
  function childrenOf(parentKey: string): TodoItem[] {
    return todos.value
      .filter((t) => (t.parentIds || []).includes(parentKey))
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
  }

  /** 子任务完成进度 { done, total }，无子任务返回 null */
  function subtaskProgress(parentKey: string): { done: number; total: number } | null {
    const children = childrenOf(parentKey);
    if (!children.length) return null;
    const done = children.filter((c) => effectiveStatus(c) === 'completed').length;
    return { done, total: children.length };
  }

  /** 取某子任务所关联的父任务标题列表（用于卡片/列表展示「父任务：xxx」） */
  function parentTitlesOf(child: TodoItem): string[] {
    if (!child.parentIds || !child.parentIds.length) return [];
    const titleMap = new Map(todos.value.map((t) => [t.key, t.title || '未命名任务']));
    return child.parentIds
      .map((k) => titleMap.get(k))
      .filter((x): x is string => !!x);
  }

  /** 取某子任务所关联的父任务对象列表（用于点击父任务 tag 打开只读详情） */
  function parentItemsOf(child: TodoItem): TodoItem[] {
    if (!child.parentIds || !child.parentIds.length) return [];
    const map = new Map(todos.value.map((t) => [t.key, t]));
    return child.parentIds
      .map((k) => map.get(k))
      .filter((x): x is TodoItem => !!x);
  }

  // ===== 分组（卡片/列表共用）=====
  const groups = computed<TodoGroup[]>(() => {
    const list = filteredTodos.value;
    if (groupBy.value === 'none') {
      return [{ key: 'all', label: '', items: list }];
    }
    if (groupBy.value === 'status') {
      const order = ['not_started', 'in_progress', 'blocked', 'restart', 'completed', 'cancelled'];
      const map = new Map<string, TodoItem[]>();
      list.forEach((t) => {
        const s = effectiveStatus(t);
        if (!map.has(s)) map.set(s, []);
        map.get(s)!.push(t);
      });
      return order
        .filter((s) => map.has(s))
        .map((s) => ({ key: s, label: statusLabel(s), items: map.get(s)! }));
    }
    // 按关联父任务分组：多父任务的任务归入其第一个父任务；无父任务归入「无父任务」
    if (groupBy.value === 'parent') {
      const titleOf = (k: string) =>
        k === NONE_PARENT ? '无父任务' : todos.value.find((t) => t.key === k)?.title || '未知任务';
      const map = new Map<string, TodoItem[]>();
      list.forEach((t) => {
        const pk = isSubtask(t) ? (t.parentIds as string[])[0] : NONE_PARENT;
        if (!map.has(pk)) map.set(pk, []);
        map.get(pk)!.push(t);
      });
      const keys = [...map.keys()].sort((a, b) => {
        if (a === NONE_PARENT) return 1;
        if (b === NONE_PARENT) return -1;
        return 0;
      });
      return keys.map((k) => ({ key: k, label: titleOf(k), items: map.get(k)! }));
    }
    // 按截止日期分组：逾期 / 今天 / 明天 / 本周 / 无日期 / 更晚
    const map = new Map<string, TodoItem[]>();
    list.forEach((t) => {
      const g = dueGroup(t.dueDate);
      if (!map.has(g.key)) map.set(g.key, []);
      map.get(g.key)!.push(t);
    });
    const order = ['overdue', 'today', 'tomorrow', 'thisweek', 'nodate', 'later'];
    return order
      .filter((k) => map.has(k))
      .map((k) => ({ key: k, label: dueGroupLabel(k), items: map.get(k)! }));
  });

  function statusLabel(s: string): string {
    const m: Record<string, string> = {
      not_started: '未开始',
      in_progress: '进行中',
      blocked: '阻塞',
      completed: '已完成',
      cancelled: '已取消',
      restart: '重新开始',
    };
    return m[s] || s;
  }

  function dueGroup(dueDate?: string): { key: string } {
    if (!dueDate) return { key: 'nodate' };
    const now = new Date();
    const due = new Date(dueDate.replace(/-/g, '/'));
    if (isNaN(due.getTime())) return { key: 'nodate' };
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDiff = Math.floor((due.getTime() - startOfToday.getTime()) / 86400000);
    if (dayDiff < 0) return { key: 'overdue' };
    if (dayDiff === 0) return { key: 'today' };
    if (dayDiff === 1) return { key: 'tomorrow' };
    if (dayDiff <= 7) return { key: 'thisweek' };
    return { key: 'later' };
  }

  function dueGroupLabel(k: string): string {
    const m: Record<string, string> = {
      overdue: '已逾期',
      today: '今天截止',
      tomorrow: '明天截止',
      thisweek: '本周截止',
      nodate: '无截止日期',
      later: '更晚',
    };
    return m[k] || k;
  }

  // ===== 日历：按 dueDate 聚合到日期 =====
  const calendarMap = computed<Record<string, TodoItem[]>>(() => {
    const map: Record<string, TodoItem[]> = {};
    filteredTodos.value.forEach((t) => {
      if (!t.dueDate) return;
      const day = t.dueDate.slice(0, 10);
      if (!map[day]) map[day] = [];
      map[day].push(t);
    });
    return map;
  });

  /** 当天待办（日历选中日） */
  const selectedDayTodos = computed<TodoItem[]>(() =>
    selectedDate.value ? calendarMap.value[selectedDate.value] || [] : [],
  );

  return {
    // 数据
    todos,
    tags,
    loading,
    // 筛选
    keyword,
    priorityFilter,
    statusFilter,
    tagFilters,
    showCompleted,
    showTemplates,
    // 视图态
    view,
    groupBy,
    calendarMonth,
    selectedDate,
    highlightKey,
    // 计算
    filteredTodos,
    groups,
    totalCount,
    inProgressCount,
    completedCount,
    cancelledCount,
    calendarMap,
    selectedDayTodos,
    // 方法
    fetchTodos,
    fetchTags,
    effectiveStatus,
    childrenOf,
    subtaskProgress,
    isSubtask,
    parentTitlesOf,
    parentItemsOf,
  };
});
