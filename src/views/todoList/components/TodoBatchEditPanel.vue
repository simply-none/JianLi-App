<!--
  高级条件批量编辑面板（D6）：与 TodoBatchDeletePanel 同一套条件选择模型，
  命中集合支持批量改状态 / 改优先级 / 改截止日期 / 追加标签。
  全程客户端过滤 + 逐条 new-sql:upsert 合规写库，完成后一次全量重排提醒。
-->
<template>
  <div class="batch-edit">
    <!-- 条件区 -->
    <div class="cond-grid">
      <div class="cond-row">
        <span class="cond-label">状态</span>
        <el-select v-model="statusSel" multiple collapse-tags placeholder="不限" clearable size="small">
          <el-option v-for="opt in TODO_STATUS_LIST" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </div>
      <div class="cond-row">
        <span class="cond-label">优先级</span>
        <el-select v-model="prioritySel" multiple collapse-tags placeholder="不限" clearable size="small">
          <el-option label="高" value="high" />
          <el-option label="中" value="medium" />
          <el-option label="低" value="low" />
        </el-select>
      </div>
      <div class="cond-row">
        <span class="cond-label">标签</span>
        <el-select v-model="tagSel" multiple collapse-tags placeholder="不限（任一命中）" clearable size="small">
          <el-option v-for="t in store.tags" :key="t.key" :label="t.name" :value="t.key" />
        </el-select>
      </div>
      <div class="cond-row">
        <span class="cond-label">类型</span>
        <el-select v-model="typeSel" size="small">
          <el-option label="全部" value="all" />
          <el-option label="仅顶层任务" value="top" />
          <el-option label="仅子任务" value="subtask" />
          <el-option label="仅重复实例" value="instance" />
        </el-select>
      </div>
    </div>

    <!-- 动作区：要改成的目标值，留空 = 不修改该字段 -->
    <div class="action-grid">
      <div class="cond-row">
        <span class="cond-label">改为状态</span>
        <el-select v-model="newStatus" placeholder="不修改" clearable size="small">
          <el-option v-for="opt in TODO_STATUS_LIST" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </div>
      <div class="cond-row">
        <span class="cond-label">改为优先级</span>
        <el-select v-model="newPriority" placeholder="不修改" clearable size="small">
          <el-option label="高" value="high" />
          <el-option label="中" value="medium" />
          <el-option label="低" value="low" />
        </el-select>
      </div>
      <div class="cond-row">
        <span class="cond-label">改为截止</span>
        <el-date-picker
          v-model="newDue"
          type="datetime"
          placeholder="不修改"
          size="small"
          format="YYYY-MM-DD HH:mm"
          date-format="YYYY-MM-DD"
          time-format="HH:mm"
        />
      </div>
      <div class="cond-row">
        <span class="cond-label">追加标签</span>
        <el-select v-model="appendTagSel" multiple collapse-tags placeholder="不追加" clearable size="small">
          <el-option v-for="t in store.tags" :key="t.key" :label="t.name" :value="t.key" />
        </el-select>
      </div>
    </div>

    <!-- 预览与执行 -->
    <div class="apply-bar">
      <span class="matched-count">命中 <b>{{ matched.length }}</b> 条待办</span>
      <el-button
        type="primary"
        size="small"
        :disabled="!matched.length || !hasAction"
        @click="apply"
      >
        应用修改
      </el-button>
    </div>
    <div v-if="matched.length" class="edit-preview">
      <div v-for="t in previewItems" :key="t.key" class="edit-item">
        <span class="edit-item__title" :title="t.title">{{ t.title || '未命名待办' }}</span>
        <span class="badge" :style="{ color: statusMeta(t).color, background: statusMeta(t).bg }">
          {{ statusMeta(t).label }}
        </span>
      </div>
      <div v-if="matched.length > previewItems.length" class="edit-item edit-item--more">
        仅预览前 {{ previewItems.length }} 条，共 {{ matched.length }} 条
      </div>
    </div>
    <el-empty v-else description="无符合条件的待办" :image-size="48" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import moment from 'moment';
import { useTodoStore } from '@/store/useTodo';
import { saveTodo } from '@/views/todoList/api/todoApi';
import { TODO_STATUS_LIST, getTodoStatusMeta, applyStatus, type TodoStatus } from '@/views/todoList/statusConfig';
import { parseTodoDate } from '@/views/todoList/utils/time';
import type { TodoItem } from '@/views/todoList/types';

const emit = defineEmits<{ (e: 'applied'): void }>();

const store = useTodoStore();

// ===== 条件状态 =====
const statusSel = ref<string[]>([]);
const prioritySel = ref<string[]>([]);
const tagSel = ref<string[]>([]);
const typeSel = ref<'all' | 'subtask' | 'instance' | 'top'>('all');

// ===== 动作状态（留空 = 不改）=====
const newStatus = ref('');
const newPriority = ref('');
const newDue = ref<Date | null>(null);
const appendTagSel = ref<string[]>([]);

const hasAction = computed(() => !!(newStatus.value || newPriority.value || newDue.value || appendTagSel.value.length));

/** 命中集合（客户端过滤，复用 store 的 effectiveStatus/isSubtask） */
const matched = computed<TodoItem[]>(() => {
  const statusSet = statusSel.value;
  const prioSet = prioritySel.value;
  const tagSet = tagSel.value;
  const type = typeSel.value;

  return store.activeTodos.filter((t) => {
    if (statusSet.length && !statusSet.includes(store.effectiveStatus(t))) return false;
    if (prioSet.length && !prioSet.includes(t.priority)) return false;
    if (tagSet.length) {
      let keys: string[] = [];
      try {
        keys = JSON.parse(t.tags || '[]');
      } catch {
        keys = [];
      }
      if (!tagSet.some((g) => keys.includes(g))) return false;
    }
    switch (type) {
      case 'subtask':
        if (!store.isSubtask(t)) return false;
        break;
      case 'instance':
        if (!t.isRecurrenceInstance) return false;
        break;
      case 'top':
        if (store.isSubtask(t) || t.isRecurrenceInstance || (t.recurrenceRule && !t.recurrenceId)) return false;
        break;
      default:
        break;
    }
    return true;
  });
});

const previewItems = computed(() => matched.value.slice(0, 100));

function statusMeta(t: TodoItem) {
  return getTodoStatusMeta(t.status);
}

/** 应用批量修改：逐条 upsert（沿 applyStatus 双写状态），完成后一次全量重排提醒 */
async function apply() {
  if (!matched.value.length) return;
  const summary: string[] = [];
  if (newStatus.value) summary.push(`状态→${getTodoStatusMeta(newStatus.value).label}`);
  if (newPriority.value) summary.push(`优先级→${newPriority.value}`);
  if (newDue.value) summary.push(`截止→${moment(newDue.value).format('YYYY-MM-DD HH:mm')}`);
  if (appendTagSel.value.length) summary.push(`追加 ${appendTagSel.value.length} 个标签`);
  try {
    await ElMessageBox.confirm(
      `将对 ${matched.value.length} 条待办执行：${summary.join('、')}。确定继续吗？`,
      '批量编辑确认',
      { type: 'warning', confirmButtonText: '应用', cancelButtonText: '取消' },
    );
  } catch {
    return; /* 用户取消 */
  }

  const dueStr = newDue.value ? moment(newDue.value).format('YYYY-MM-DD HH:mm:ss') : '';
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  for (const t of matched.value) {
    let next: TodoItem = { ...t, updateTime: now };
    if (newStatus.value) next = applyStatus(next, newStatus.value as TodoStatus, now);
    if (newPriority.value) next.priority = newPriority.value as TodoItem['priority'];
    if (dueStr) next.dueDate = dueStr;
    if (appendTagSel.value.length) {
      let keys: string[] = [];
      try {
        keys = JSON.parse(t.tags || '[]');
      } catch {
        keys = [];
      }
      const merged = [...new Set([...keys, ...appendTagSel.value])];
      next.tags = JSON.stringify(merged);
    }
    await saveTodo(next);
  }
  // 批量完成后一次全量重排（逐条带 key 会产生 N 次 IPC，批量场景用全量）
  window.ipcRenderer?.send('update-todo-reminders');
  ElMessage.success(`已批量修改 ${matched.value.length} 条待办`);
  emit('applied');
}
</script>

<style scoped lang="scss">
.batch-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cond-grid,
.action-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cond-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .cond-label {
    flex: 0 0 72px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .el-select,
  .el-date-editor {
    flex: 1;
  }
}

.action-grid {
  padding: 10px;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
}

.apply-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .matched-count {
    font-size: 13px;
    color: var(--text-secondary);

    b {
      color: var(--color-primary);
    }
  }
}

.edit-preview {
  max-height: 220px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .edit-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 4px 6px;
    border-radius: 6px;
    background: var(--bg-hover);

    &__title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-primary);
    }

    .badge {
      flex-shrink: 0;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 8px;
    }

    &--more {
      color: var(--text-muted);
      background: transparent;
      justify-content: center;
    }
  }
}
</style>
