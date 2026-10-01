/**
 * 待办统一状态仓库（Pinia）
 * 职责：收敛 todo_list 的查询、筛选、统计、分组与子任务树，供主页面与 todoMiniWindow 共用，
 * 消除原先分散在各组件内的重复查询逻辑。视图切换（卡片/列表/日历）、分组方式、筛选条件均在此集中。
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import moment from 'moment';
import * as api from '@/views/todoList/api/todoApi';
import type { TodoItem, Tag } from '@/views/todoList/types';
import { deriveStatusFromCompleted } from '@/views/todoList/statusConfig';
import { dueGroupKeyOf, dueSegment, isOverdueItem, type DueSegment } from '@/views/todoList/utils/time';

/** 分组「无父任务」的占位 key */
const NONE_PARENT = '__none__';

export type TodoView = 'card' | 'list' | 'calendar';
export type GroupBy = 'none' | 'status' | 'due' | 'parent';
/** 排序模式（D7）：更新时间倒序为默认（与旧 SQL ORDER BY 一致） */
export type SortMode = 'updated' | 'due' | 'priority' | 'created';

/** 视图/筛选态持久化 key（C3）：刷新后保持上次视图、分组与筛选 */
const VIEW_STATE_KEY = 'todoList.viewState';

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
  const dueFilter = ref<DueSegment | ''>(''); // 到期段筛选（D1，口径对齐移动端）
  const showCompleted = ref(false);
  const showTemplates = ref(false); // 是否显示重复任务模板
  const sortMode = ref<SortMode>('updated'); // 排序模式（D7）
  /** 今日聚焦（D2）：只看「今天到期 + 已逾期」的未完成项；瞬态不持久化 */
  const todayFocus = ref(false);

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

  /**
   * store 内局部更新（B2）：原位替换或头部插入，并保持 updateTime 倒序与 SQL 拉取一致。
   * 替代旧的「写库后 fetchTodos() 全量重拉」。
   */
  function upsertLocal(todo: TodoItem) {
    const idx = todos.value.findIndex((t) => t.key === todo.key);
    if (idx > -1) todos.value.splice(idx, 1, todo);
    else todos.value.unshift(todo);
    todos.value.sort((a, b) => (b.updateTime || '').localeCompare(a.updateTime || ''));
  }

  /**
   * 单条写库统一入口（B1/B2 收口）：upsert + 局部更新 + 重排截止提醒 + 通知其他窗口。
   * 单条新增/编辑/状态切换一律走这里；批量导入、同步刷新等场景仍用 fetchTodos() 兜底。
   */
  async function commitTodo(todo: TodoItem) {
    await api.saveTodo(todo);
    upsertLocal(todo);
    // 带 key 增量重排（B4）：主进程只重建该待办的提醒行
    window.ipcRenderer?.send('update-todo-reminders', todo.key);
    window.ipcRenderer?.send('sync-data-to-other-window', { todoUpdated: true });
  }

  // 其他窗口（如桌面小窗）修改待办后自动刷新本端数据：
  // 主窗口此前不监听该广播，小窗完成/新增后主界面一直不更新（B1 补齐）。
  // 主进程广播会排除发送者自身，因此 commitTodo 的广播不会触发这里造成重复拉取。
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    window.ipcRenderer.on('sync-data-to-other-window', (_e: unknown, arg: any) => {
      if (arg && arg.todoUpdated) fetchTodos();
    });
  }

  // ===== 回收站（E5 软删除）=====
  /** 有效待办（未进回收站）：统计/分组/子任务/父任务关联全部基于它 */
  const activeTodos = computed(() => todos.value.filter((t) => !Number(t.deleted)));
  /** 回收站内的待办 */
  const deletedTodos = computed(() => todos.value.filter((t) => Number(t.deleted) === 1));

  /** 删除 = 软删除进回收站（30 天后主进程定时彻底清理） */
  async function removeTodo(key: string) {
    const item = todos.value.find((t) => t.key === key);
    if (!item) return;
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    const next: TodoItem = { ...item, deleted: 1, updateTime: now };
    await api.saveTodo(next);
    upsertLocal(next);
    window.ipcRenderer?.send('update-todo-reminders', key);
    window.ipcRenderer?.send('sync-data-to-other-window', { todoUpdated: true });
  }

  /** 从回收站恢复 */
  async function restoreTodo(key: string) {
    const item = todos.value.find((t) => t.key === key);
    if (!item) return;
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    const next: TodoItem = { ...item, deleted: 0, updateTime: now };
    await api.saveTodo(next);
    upsertLocal(next);
    window.ipcRenderer?.send('sync-data-to-other-window', { todoUpdated: true });
  }

  /** 彻底删除（物理删除，不可恢复；回收站内使用） */
  async function purgeTodo(key: string) {
    await api.deleteTodo(key);
    todos.value = todos.value.filter((t) => t.key !== key);
    window.ipcRenderer?.send('update-todo-reminders', key);
    window.ipcRenderer?.send('sync-data-to-other-window', { todoUpdated: true });
  }

  // ===== 番茄钟联动（E3）=====
  /** 当前专注关联的待办 key（番茄钟小窗在专注段结束时向其累计 focusedMinutes） */
  const POMODORO_LINK_KEY = 'todo.pomodoroLink';
  const pomodoroLinkKey = ref('');

  function loadPomodoroLink() {
    try {
      const v = window.ipcRenderer?.sendSync('get-store', POMODORO_LINK_KEY);
      pomodoroLinkKey.value = typeof v === 'string' ? v : '';
    } catch {
      pomodoroLinkKey.value = '';
    }
  }

  /** 设定/取消（传空串）专注关联待办 */
  function focusTodo(todo: TodoItem | null) {
    const key = todo ? todo.key : '';
    pomodoroLinkKey.value = key;
    try {
      window.ipcRenderer?.sendSync('set-store', POMODORO_LINK_KEY, key);
    } catch {
      /* 存储失败仅影响本次 */
    }
  }

  loadPomodoroLink();

  /** 切换今日聚焦（D2）；开启时清空到期段筛选（两者口径重叠，互斥展示） */
  function setTodayFocus(v: boolean) {
    todayFocus.value = v;
    if (v) dueFilter.value = '';
  }

  // ===== 视图/筛选态持久化（C3）=====
  function persistViewState() {
    try {
      localStorage.setItem(
        VIEW_STATE_KEY,
        JSON.stringify({
          view: view.value,
          groupBy: groupBy.value,
          statusFilter: statusFilter.value,
          tagFilters: tagFilters.value,
          dueFilter: dueFilter.value,
          sortMode: sortMode.value,
          showCompleted: showCompleted.value,
          showTemplates: showTemplates.value,
        }),
      );
    } catch {
      /* 配额/隐私模式等写失败忽略 */
    }
  }

  function restoreViewState() {
    try {
      const raw = localStorage.getItem(VIEW_STATE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) || {};
      if (s.view && ['card', 'list', 'calendar'].includes(s.view)) view.value = s.view;
      if (s.groupBy && ['none', 'status', 'due', 'parent'].includes(s.groupBy)) groupBy.value = s.groupBy;
      if (s.statusFilter === null || typeof s.statusFilter === 'string') statusFilter.value = s.statusFilter;
      if (Array.isArray(s.tagFilters)) tagFilters.value = s.tagFilters;
      if (typeof s.dueFilter === 'string') dueFilter.value = s.dueFilter;
      if (typeof s.sortMode === 'string' && ['updated', 'due', 'priority', 'created'].includes(s.sortMode))
        sortMode.value = s.sortMode;
      if (typeof s.showCompleted === 'boolean') showCompleted.value = s.showCompleted;
      if (typeof s.showTemplates === 'boolean') showTemplates.value = s.showTemplates;
    } catch {
      /* 脏数据忽略 */
    }
  }
  restoreViewState();
  watch(
    [view, groupBy, statusFilter, tagFilters, dueFilter, sortMode, showCompleted, showTemplates],
    persistViewState,
  );

  /** 取有效状态（兼容旧数据无 status 字段） */
  function effectiveStatus(t: TodoItem): string {
    return t.status || deriveStatusFromCompleted(t.completed);
  }

  // ===== 客户端过滤（无 SQL，杜绝注入与 execute）=====
  const filteredTodos = computed<TodoItem[]>(() => {
    // 基于有效待办（回收站内的不参与列表与筛选）
    let list = activeTodos.value;

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
    // 今日聚焦（D2）：今天到期或已逾期的未完成项（与到期段筛选互斥，开启时清空 dueFilter）
    if (todayFocus.value) {
      list = list.filter((t) => {
        const st = effectiveStatus(t);
        if (st === 'completed' || st === 'cancelled') return false;
        const seg = dueSegment(t.dueDate);
        return seg === 'today' || seg === 'overdue';
      });
    }
    if (dueFilter.value) {
      // 到期段筛选（D1）：「已逾期」段额外限定未完成/未取消，其余段只看时间
      const seg = dueFilter.value;
      list = list.filter((t) => {
        const s = dueSegment(t.dueDate);
        if (seg === 'overdue') {
          const st = effectiveStatus(t);
          return s === 'overdue' && st !== 'completed' && st !== 'cancelled';
        }
        return s === seg;
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
    // 排序（D7）：默认 updateTime 倒序（与拉取序一致），无截止日期的排最后
    const sorted = [...list];
    const prioRank = (p: string) => ({ high: 0, medium: 1, low: 2 })[p] ?? 1;
    switch (sortMode.value) {
      case 'due':
        sorted.sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'));
        break;
      case 'priority':
        sorted.sort((a, b) => prioRank(a.priority) - prioRank(b.priority));
        break;
      case 'created':
        sorted.sort((a, b) => (b.createTime || '').localeCompare(a.createTime || ''));
        break;
      default:
        sorted.sort((a, b) => (b.updateTime || '').localeCompare(a.updateTime || ''));
    }
    return sorted;
  });

  // ===== 统计 =====
  const totalCount = computed(() => activeTodos.value.length);
  const inProgressCount = computed(
    () => activeTodos.value.filter((t) => effectiveStatus(t) === 'in_progress').length,
  );
  const completedCount = computed(
    () => activeTodos.value.filter((t) => effectiveStatus(t) === 'completed').length,
  );
  const cancelledCount = computed(
    () => activeTodos.value.filter((t) => effectiveStatus(t) === 'cancelled').length,
  );

  // ===== 扩展统计（E1）=====
  /** 完成率（%） */
  const completionRate = computed(() => {
    const total = activeTodos.value.length;
    if (!total) return 0;
    return Math.round((completedCount.value / total) * 100);
  });
  /** 今日完成数（按 completedTime 日期口径） */
  const todayDoneCount = computed(() => {
    const today = moment().format('YYYY-MM-DD');
    return activeTodos.value.filter(
      (t) => effectiveStatus(t) === 'completed' && (t.completedTime || '').slice(0, 10) === today,
    ).length;
  });
  /** 逾期未完成数 */
  const overdueCount = computed(
    () =>
      activeTodos.value.filter((t) => {
        const st = effectiveStatus(t);
        return st !== 'completed' && st !== 'cancelled' && isOverdueItem(t.dueDate, false);
      }).length,
  );

  // ===== 子任务关联（可多父）=====
  /** 是否子任务：parentIds 非空 */
  function isSubtask(t: TodoItem): boolean {
    return !!(t.parentIds && t.parentIds.length);
  }

  /** 取某任务的直属子任务（parentIds 含该 key 即为其子；按 sortOrder 排序；不含回收站内条目） */
  function childrenOf(parentKey: string): TodoItem[] {
    return activeTodos.value
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
    const titleMap = new Map(activeTodos.value.map((t) => [t.key, t.title || '未命名任务']));
    return child.parentIds
      .map((k) => titleMap.get(k))
      .filter((x): x is string => !!x);
  }

  /** 取某子任务所关联的父任务对象列表（用于点击父任务 tag 打开只读详情） */
  function parentItemsOf(child: TodoItem): TodoItem[] {
    if (!child.parentIds || !child.parentIds.length) return [];
    const map = new Map(activeTodos.value.map((t) => [t.key, t]));
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
    // 统一走时间工具解析（C1），替代原 replace(/-/g,'/') 手写转换
    return { key: dueGroupKeyOf(dueDate) };
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
    activeTodos,
    deletedTodos,
    // 筛选
    keyword,
    priorityFilter,
    statusFilter,
    tagFilters,
    dueFilter,
    showCompleted,
    showTemplates,
    sortMode,
    todayFocus,
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
    completionRate,
    todayDoneCount,
    overdueCount,
    calendarMap,
    selectedDayTodos,
    // 方法
    fetchTodos,
    fetchTags,
    commitTodo,
    removeTodo,
    restoreTodo,
    purgeTodo,
    focusTodo,
    pomodoroLinkKey,
    setTodayFocus,
    effectiveStatus,
    childrenOf,
    subtaskProgress,
    isSubtask,
    parentTitlesOf,
    parentItemsOf,
  };
});
