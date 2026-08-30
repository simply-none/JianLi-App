<template>
  <div class="del-panel">
    <!-- 顶部：删除当前正在编辑的待办（仅编辑态出现） -->
    <div v-if="currentTodo && currentTodo.key" class="del-current">
      <div class="del-current__info">
        <span class="del-current__label">当前待办</span>
        <span class="del-current__title" :title="currentTodo.title">{{ currentTodo.title || '未命名待办' }}</span>
      </div>
      <el-button type="danger" plain size="small" @click="deleteCurrent">
        <LucideIcon name="Trash2" :size="14" /> 删除此待办
      </el-button>
    </div>

    <div class="del-divider"><span>高级条件删除</span></div>

    <!-- 条件区 -->
    <el-form label-width="64px" class="del-form">
      <el-form-item label="关键词">
        <el-input v-model="keyword" placeholder="标题/描述模糊匹配（留空=不限）" clearable size="small" />
      </el-form-item>

      <el-form-item label="状态">
        <el-select
          v-model="statusSel"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="不限"
          clearable
          size="small"
          class="del-select"
        >
          <el-option
            v-for="s in statusOptions"
            :key="s.value"
            :label="s.label"
            :value="s.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="优先级">
        <el-select
          v-model="prioritySel"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="不限"
          clearable
          size="small"
          class="del-select"
        >
          <el-option
            v-for="p in priorityOptions"
            :key="p.value"
            :label="p.label"
            :value="p.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="标签">
        <el-select
          v-model="tagSel"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="不限"
          clearable
          filterable
          size="small"
          class="del-select"
        >
          <el-option
            v-for="t in tagOptions"
            :key="t.key"
            :label="t.name"
            :value="t.key"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="截止日期">
        <div class="date-range">
          <el-date-picker
            v-model="dueAfter"
            type="date"
            placeholder="晚于等于"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            size="small"
            class="date-picker"
          />
          <span class="date-sep">~</span>
          <el-date-picker
            v-model="dueBefore"
            type="date"
            placeholder="早于等于"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            size="small"
            class="date-picker"
          />
        </div>
      </el-form-item>

      <el-form-item label="任务类型">
        <el-select v-model="typeSel" size="small" class="del-select">
          <el-option label="全部" value="all" />
          <el-option label="仅子任务" value="subtask" />
          <el-option label="仅重复模板" value="template" />
          <el-option label="仅重复实例" value="instance" />
          <el-option label="仅顶层(非子任务)" value="top" />
        </el-select>
      </el-form-item>

      <el-form-item label="级联">
        <el-checkbox v-model="cascadeChildren">同时删除被删父任务的子任务</el-checkbox>
      </el-form-item>
    </el-form>

    <!-- 匹配结果预览 -->
    <div class="del-preview">
      <div class="del-preview__head">
        <span>匹配 <b>{{ matched.length }}</b> 条</span>
        <el-button
          type="primary"
          size="small"
          :disabled="!matched.length"
          @click="deleteMatched"
        >
          <LucideIcon name="Trash2" :size="14" /> 删除匹配项
        </el-button>
      </div>
      <div v-if="matched.length" class="del-preview__list">
        <div v-for="t in previewItems" :key="t.key" class="del-item">
          <span class="del-item__title" :title="t.title">{{ t.title || '未命名待办' }}</span>
          <span class="del-item__badges">
            <span
              class="badge"
              :style="{ color: statusMeta(t).color, background: statusMeta(t).bg }"
            >{{ statusMeta(t).label }}</span>
            <span class="badge badge--prio" :style="{ color: priorityColor(t.priority) }">
              {{ priorityText(t.priority) }}
            </span>
            <span v-if="store.isSubtask(t)" class="badge badge--sub">子</span>
            <span v-else-if="t.recurrenceRule && !t.recurrenceId" class="badge badge--tpl">模板</span>
            <span v-else-if="t.isRecurrenceInstance" class="badge badge--ins">实例</span>
          </span>
        </div>
        <div v-if="matched.length > previewItems.length" class="del-item del-item--more">
          仅预览前 {{ previewItems.length }} 条，共 {{ matched.length }} 条
        </div>
      </div>
      <el-empty v-else description="无符合条件的待办" :image-size="48" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { useTodoStore } from '@/store/useTodo';
import { deleteTodo as apiDeleteTodo } from '@/views/todoList/api/todoApi';
import { TODO_STATUS_LIST, getTodoStatusMeta } from '@/views/todoList/statusConfig';
import type { TodoItem } from '@/views/todoList/types';

const props = defineProps<{
  /** 当前正在编辑的待办（用于「删除此待办」按钮）；新建态为 null */
  currentTodo?: TodoItem | null;
}>();

const emit = defineEmits<{ (e: 'deleted', keys: string[]): void }>();

const store = useTodoStore();

// ===== 条件状态 =====
const keyword = ref('');
const statusSel = ref<string[]>([]);
const prioritySel = ref<string[]>([]);
const tagSel = ref<string[]>([]);
const dueAfter = ref(''); // 截止日期 >= 该日（晚于等于）
const dueBefore = ref(''); // 截止日期 <= 该日（早于等于）
const typeSel = ref<'all' | 'subtask' | 'template' | 'instance' | 'top'>('all');
const cascadeChildren = ref(true);

// ===== 选项 =====
const statusOptions = TODO_STATUS_LIST;
const priorityOptions = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];
const tagOptions = computed(() => store.tags);

// ===== 匹配计算（纯客户端过滤，复用 store 的 effectiveStatus）=====
const matched = computed<TodoItem[]>(() => {
  const kw = keyword.value.trim().toLowerCase();
  const statusSet = statusSel.value;
  const prioSet = prioritySel.value;
  const tagSet = tagSel.value;
  const after = dueAfter.value;
  const before = dueBefore.value;
  const type = typeSel.value;

  return store.todos.filter((t) => {
    // 关键词
    if (kw) {
      const hay = `${t.title || ''} ${t.description || ''}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    // 状态
    if (statusSet.length && !statusSet.includes(store.effectiveStatus(t))) return false;
    // 优先级
    if (prioSet.length && !prioSet.includes(t.priority)) return false;
    // 标签：待办携带任一选中标签即命中
    if (tagSet.length) {
      let keys: string[] = [];
      try {
        keys = JSON.parse(t.tags || '[]');
      } catch {
        keys = [];
      }
      if (!tagSet.some((g) => keys.includes(g))) return false;
    }
    // 截止日期范围
    if (after || before) {
      if (!t.dueDate) return false;
      const day = t.dueDate.slice(0, 10);
      if (after && day < after) return false;
      if (before && day > before) return false;
    }
    // 任务类型
    switch (type) {
      case 'subtask':
        if (!store.isSubtask(t)) return false;
        break;
      case 'template':
        if (!(t.recurrenceRule && !t.recurrenceId)) return false;
        break;
      case 'instance':
        if (!t.isRecurrenceInstance) return false;
        break;
      case 'top':
        if (store.isSubtask(t) || t.isRecurrenceInstance || (t.recurrenceRule && !t.recurrenceId))
          return false;
        break;
      default:
        break;
    }
    return true;
  });
});

const previewItems = computed(() => matched.value.slice(0, 100));

// ===== 展示辅助 =====
function statusMeta(t: TodoItem) {
  return getTodoStatusMeta(t.status);
}
function priorityText(p?: string): string {
  return { high: '高', medium: '中', low: '低' }[p || ''] || '中';
}
function priorityColor(p?: string): string {
  return { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[p || ''] || '#f59e0b';
}

// ===== 删除执行 =====
/** 在匹配集合基础上，按需级联加入子任务，返回最终待删 key 列表 */
function buildDeleteKeys(base: TodoItem[]): string[] {
  const set = new Set(base.map((t) => t.key));
  if (cascadeChildren.value) {
    for (const t of base) {
      store.childrenOf(t.key).forEach((k) => set.add(k.key));
    }
  }
  return [...set];
}

async function doDelete(keys: string[]) {
  if (!keys.length) return;
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${keys.length} 条待办吗？此操作不可恢复。`,
      '批量删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  for (const k of keys) {
    await apiDeleteTodo(k);
  }
  // 删除后重排截止提醒并刷新重复实例生成
  window.ipcRenderer.send('update-todo-reminders');
  window.ipcRenderer.send('recurrence:sync');
  ElMessage.success(`已删除 ${keys.length} 条待办`);
  emit('deleted', keys);
}

/** 按条件批量删除匹配项 */
async function deleteMatched() {
  const keys = buildDeleteKeys(matched.value);
  if (!keys.length) {
    ElMessage.warning('没有符合条件的待办');
    return;
  }
  await doDelete(keys);
}

/** 删除当前正在编辑的待办 */
async function deleteCurrent() {
  if (!props.currentTodo?.key) return;
  await doDelete([props.currentTodo.key]);
}
</script>

<style scoped lang="scss">
.del-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.del-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  border-radius: 8px;

  &__info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  &__label {
    font-size: 11px;
    color: var(--text-muted);
  }
  &__title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }
}

.del-divider {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-subtle);
  }
  span {
    padding: 0 8px;
  }
}

.del-form {
  :deep(.el-form-item) {
    margin-bottom: 10px;
  }
  :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--text-secondary);
  }
}
.del-select {
  width: 100%;
}
.date-range {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;

  .date-picker {
    flex: 1;
    min-width: 0;
  }
  .date-sep {
    color: var(--text-muted);
    flex-shrink: 0;
  }
}

.del-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text-secondary);

    b {
      color: var(--color-error, #ef4444);
    }
  }
  &__list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 4px;
    max-height: 320px;
  }
}

.del-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 6px;

  & + & {
    margin-top: 2px;
  }
  &:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  }
  &__title {
    font-size: 12px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  &__badges {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  &--more {
    justify-content: center;
    color: var(--text-muted);
    font-size: 12px;
    &:hover {
      background: transparent;
    }
  }
}

.badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.6;
  white-space: nowrap;

  &--prio {
    font-weight: 600;
  }
  &--sub {
    color: #8b5cf6;
    background: rgba(139, 92, 246, 0.15);
  }
  &--tpl {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
  }
  &--ins {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.15);
  }
}
</style>
