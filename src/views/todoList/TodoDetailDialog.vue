<template>
  <app-dialog
    :model-value="visible"
    :title="readOnly ? '待办详情' : (isEdit ? '编辑待办事项' : '新建待办事项')"
    width="520px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="todo-form">
      <fieldset class="form-fieldset" :disabled="readOnly">
        <el-form :model="form" label-width="80px">
        <el-form-item label="标题">
          <el-input
            v-model="form.title"
            placeholder="请输入待办标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            placeholder="请输入待办描述"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="优先级">
          <el-radio-group v-model="form.priority" class="priority-radio-group">
            <el-radio value="high" class="priority-high"><span class="priority-label">高</span><span class="priority-dot high" /></el-radio>
            <el-radio value="medium" class="priority-medium"><span class="priority-label">中</span><span class="priority-dot medium" /></el-radio>
            <el-radio value="low" class="priority-low"><span class="priority-label">低</span><span class="priority-dot low" /></el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="截止时间">
          <el-date-picker
            v-model="form.dueDate"
            type="datetime"
            placeholder="选择截止时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>

        <el-form-item label="截止提醒">
          <el-switch
            v-model="form.deadlineReminder"
            :active-value="1"
            :inactive-value="0"
            active-text="开启"
            inactive-text="关闭"
          />
          <span class="form-hint">开启后将在截止时间前按间隔多次提醒</span>
        </el-form-item>

        <template v-if="form.deadlineReminder === 1">
          <el-form-item label="提醒次数">
            <el-input-number v-model="form.remindCount" :min="1" :max="20" :step="1" />
          </el-form-item>
          <el-form-item label="提醒间隔">
            <div class="interval-wrap">
              <el-input-number v-model="form.remindInterval" :min="1" :max="1440" :step="1" />
              <el-select v-model="form.remindIntervalUnit" class="interval-unit">
                <el-option label="分钟" value="minute" />
                <el-option label="小时" value="hour" />
              </el-select>
            </div>
          </el-form-item>
        </template>

        <!-- 重复配置：不重复 / 每天 / 每周 -->
        <el-form-item label="重复">
          <el-radio-group v-model="form.recurrenceRule" @change="onRecurrenceChange">
            <el-radio :value="null" class="rc-none">不重复</el-radio>
            <el-radio value="daily">每天</el-radio>
            <el-radio value="weekly">每周</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="form.recurrenceRule === 'daily'">
          <el-form-item label="间隔">
            <div class="interval-wrap">
              <span class="fixed-text">每</span>
              <el-input-number v-model="form.recurrenceInterval" :min="1" :max="365" :step="1" />
              <span class="fixed-text">天</span>
            </div>
          </el-form-item>
        </template>

        <template v-if="form.recurrenceRule === 'weekly'">
          <el-form-item label="间隔">
            <div class="interval-wrap">
              <span class="fixed-text">每</span>
              <el-input-number v-model="form.recurrenceInterval" :min="1" :max="52" :step="1" />
              <span class="fixed-text">周</span>
            </div>
          </el-form-item>
          <el-form-item label="星期">
            <el-checkbox-group v-model="weekdayModel" class="weekday-group">
              <el-checkbox-button v-for="(w, i) in WEEKDAYS" :key="i" :value="i">{{ w }}</el-checkbox-button>
            </el-checkbox-group>
            <span class="form-hint">不选则按创建日所在星期</span>
          </el-form-item>
        </template>

        <el-form-item v-if="form.recurrenceRule" label="结束于">
          <el-date-picker
            v-model="form.recurrenceEnd"
            type="date"
            placeholder="可选，留空=永久重复"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>

        <!-- 关联父任务：弹窗选择（多选），子任务作为独立待办存在 -->
        <el-form-item label="关联父任务">
          <!-- 只读模式：仅展示 tag -->
          <div v-if="readOnly" class="parent-tags">
            <span v-if="!parentTagItems.length" class="form-hint">无关联父任务</span>
            <span
              v-for="p in parentTagItems"
              :key="p.key"
              class="parent-tag"
              :title="'父任务：' + p.title"
            >{{ p.title }}</span>
          </div>
          <!-- 编辑模式：已选 tag（可移除）+ 选择按钮 -->
          <div v-else class="parent-tags">
            <span
              v-for="p in parentTagItems"
              :key="p.key"
              class="parent-tag removable"
              :title="'父任务：' + p.title"
            >
              {{ p.title }}
              <LucideIcon name="X" :size="11" class="parent-tag-x" @click="removeParent(p.key)" />
            </span>
            <el-button size="small" class="parent-pick" @click="parentSelectVisible = true">
              <LucideIcon name="Link" :size="13" /> 选择父任务
            </el-button>
            <span v-if="!parentTagItems.length" class="form-hint">未关联（选填）</span>
          </div>
        </el-form-item>

        <el-form-item label="标签">
          <div v-if="readOnly" class="ro-tags">
            <span
              v-for="tag in readOnlyTags"
              :key="tag.key"
              class="ro-tag"
              :style="{ backgroundColor: tag.color + '20', color: tag.color }"
            >{{ tag.name }}</span>
            <span v-if="!readOnlyTags.length" class="form-hint">无标签</span>
          </div>
          <TagSelectPopover v-else v-model="formTagKeys" class="form-tag-pop" />
        </el-form-item>

        <el-form-item label="状态">
          <el-select v-model="form.status" class="status-select" @change="handleStatusChange">
            <el-option v-for="opt in TODO_STATUS_LIST" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.completedTime" label="完成时间">
          <span class="completed-time">{{ form.completedTime }}</span>
        </el-form-item>
        </el-form>
      </fieldset>
    </div>

    <!-- 关联父任务选择弹窗（多选 + 查看父任务只读详情） -->
    <TodoParentSelectDialog
      :visible="parentSelectVisible"
      :selected-keys="selectedParentIds"
      :exclude-key="form.key || undefined"
      :tags="props.tags"
      @update:visible="parentSelectVisible = $event"
      @confirm="onParentConfirm"
      @view-detail="(t: TodoItem) => emit('view-detail', t)"
    />

    <template #footer>
      <template v-if="readOnly">
        <el-button @click="handleClose">关闭</el-button>
      </template>
      <template v-else>
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { useTodoStore } from '@/store/useTodo';
import { TODO_STATUS_LIST, DEFAULT_TODO_STATUS, deriveStatusFromCompleted } from './statusConfig';
import type { TodoItem, Tag } from './types';
import TagSelectPopover from './components/TagSelectPopover.vue';
import TodoParentSelectDialog from './components/TodoParentSelectDialog.vue';

const props = defineProps<{
  visible: boolean;
  todo: TodoItem | null;
  tags: Tag[];
  /** 只读模式：所有输入禁用、底部仅「关闭」，用于查看父任务详情 */
  readOnly?: boolean;
}>();

const emit = defineEmits(['update:visible', 'save', 'tag-update', 'view-detail']);

const store = useTodoStore();
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function blankForm(): TodoItem {
  return {
    key: '',
    title: '',
    description: '',
    tags: '[]',
    completed: 0,
    completedTime: '',
    priority: 'medium',
    dueDate: '',
    status: DEFAULT_TODO_STATUS,
    deadlineReminder: 0,
    remindCount: 1,
    remindInterval: 30,
    remindIntervalUnit: 'minute',
    createTime: '',
    updateTime: '',
    // 新增字段默认值
    parentIds: [],
    sortOrder: 0,
    recurrenceRule: null,
    recurrenceInterval: 1,
    recurrenceWeekdays: null,
    recurrenceEnd: null,
    recurrenceId: null,
    isRecurrenceInstance: 0,
  };
}

const form = ref<TodoItem>(blankForm());

/** 被加载的原始待办 key：编辑时 upsert 必须以它为主键，避免在表单竞态下误用新 key 插入 */
const loadedKey = ref<string | null>(null);

/** 从已有待办载入表单，并归一化类型字段 */
function loadForm(todo: TodoItem | null) {
  loadedKey.value = todo ? todo.key ?? null : null;
  if (todo) {
    form.value = {
      ...blankForm(),
      ...todo,
      deadlineReminder: Number(todo.deadlineReminder) || 0,
      remindCount: Number(todo.remindCount) || 1,
      remindInterval: Number(todo.remindInterval) || 30,
      remindIntervalUnit: todo.remindIntervalUnit === 'hour' ? 'hour' : 'minute',
      recurrenceInterval: Number(todo.recurrenceInterval) || 1,
      recurrenceRule: todo.recurrenceRule || null,
      recurrenceWeekdays: todo.recurrenceWeekdays || null,
      recurrenceEnd: todo.recurrenceEnd || null,
      parentIds: parseParentIds(todo.parentIds),
      sortOrder: Number(todo.sortOrder) || 0,
      status: todo.status || deriveStatusFromCompleted(todo.completed),
    };
    // 关联父任务回显：无论存储形态（数组/JSON 字符串/null/旧 parentId）都稳转字符串数组
    selectedParentIds.value = parseParentIds(todo.parentIds);
  } else {
    form.value = blankForm();
    selectedParentIds.value = [];
  }
  weekdayModel.value = parseWeekdays(form.value.recurrenceWeekdays);
}

function parseWeekdays(s?: string | null): number[] {
  try {
    return s ? (JSON.parse(s) as number[]) : [];
  } catch {
    return [];
  }
}

/** 关联父任务 key 解析：兼容数组 / JSON 字符串 / null / 旧单值 parentId，统一输出字符串数组 */
function parseParentIds(val: string[] | string | null | undefined): string[] {
  if (Array.isArray(val)) return val.filter((x) => typeof x === 'string');
  if (typeof val === 'string' && val.trim()) {
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string');
    } catch {
      // 非 JSON：视为单个 key
      return [val];
    }
  }
  return [];
}

// ===== 标签（复用 TagSelectPopover 多选 + 新增）=====
/** 表单标签 key 数组，与 form.tags 双向同步 */
const formTagKeys = computed<string[]>({
  get: () => {
    try {
      return JSON.parse(form.value.tags || '[]') as string[];
    } catch {
      return [];
    }
  },
  set: (v) => {
    form.value = { ...form.value, tags: JSON.stringify(v) };
  },
});

// ===== 关联父任务（多选，可关联多个已有待办）=====
/** 独立 ref 承载已选父任务 key，避免 el-select(multiple) 在整体替换 form 时的回显竞态 */
const selectedParentIds = ref<string[]>([]);

/** 已选父任务对象（用于表单内 tag 展示，映射回标题/可移除） */
const parentTagItems = computed<TodoItem[]>(() =>
  selectedParentIds.value
    .map((k) => store.todos.find((t) => t.key === k))
    .filter((x): x is TodoItem => !!x),
);

/** 只读模式下展示的标签对象 */
const readOnlyTags = computed<Tag[]>(() => {
  try {
    const keys = JSON.parse(form.value.tags || '[]') as string[];
    return props.tags.filter((t) => keys.includes(t.key));
  } catch {
    return [];
  }
});

/** 关联父任务选择弹窗可见态 */
const parentSelectVisible = ref(false);
function onParentConfirm(keys: string[]) {
  selectedParentIds.value = [...keys];
}
function removeParent(key: string) {
  const i = selectedParentIds.value.indexOf(key);
  if (i >= 0) selectedParentIds.value.splice(i, 1);
}

// ===== 重复 =====
const weekdayModel = ref<number[]>([]);

function onRecurrenceChange() {
  if (!form.value.recurrenceRule) {
    form.value.recurrenceInterval = 1;
    form.value.recurrenceWeekdays = null;
    form.value.recurrenceEnd = null;
    weekdayModel.value = [];
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) loadForm(props.todo);
  },
);
watch(
  () => props.todo,
  (val) => {
    if (val && props.visible) loadForm(val);
  },
);

const isEdit = computed(() => !!loadedKey.value);

function handleStatusChange(val: string) {
  if (val === 'completed' && !form.value.completedTime) {
    form.value.completedTime = moment().format('YYYY-MM-DD HH:mm:ss');
  } else if (val !== 'completed') {
    form.value.completedTime = '';
  }
}

async function handleSave() {
  if (!form.value.title.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  // 主键统一用「被加载的原始待办 key」：新建时为 null → 走 uuidv4 生成新键；
  // 编辑时必定等于原 key，upsert 命中 ON CONFLICT(key) 执行更新而非插入
  const parentKey = loadedKey.value || uuidv4();

  // 待办本身：parentIds 以 JSON 字符串落库（关联多个父任务；空数组=根任务）
  // 注意：recurrenceId / isRecurrenceInstance 必须沿用 form.value 中加载到的值，
  // 切勿在此处硬编码为 null，否则编辑重复实例/模板会丢失关联，被 recurrence:sync 重新生成成「新记录」
  const parentData: TodoItem = {
    ...form.value,
    key: parentKey,
    parentIds: JSON.stringify(selectedParentIds.value || []) as unknown as string[],
    status: form.value.status || DEFAULT_TODO_STATUS,
    completed: form.value.status === 'completed' ? 1 : 0,
    recurrenceInterval: Math.max(1, Number(form.value.recurrenceInterval) || 1),
    recurrenceWeekdays:
      form.value.recurrenceRule === 'weekly' && weekdayModel.value.length
        ? JSON.stringify([...weekdayModel.value].sort((a, b) => a - b))
        : null,
    createTime: form.value.createTime || now,
    updateTime: now,
  };

  await window.ipcRenderer.handlePromise('new-sql:upsert', {
    tableName: 'todo_list',
    data: parentData,
    config: { primaryKey: 'key' },
  });

  ElMessage.success('保存成功');
  // 通知主进程：重排截止提醒 + 重新生成重复实例
  window.ipcRenderer.send('update-todo-reminders');
  window.ipcRenderer.send('recurrence:sync');
  emit('save', parentData);
  emit('update:visible', false);
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<style scoped lang="scss">
.todo-form {
  padding: 8px 0;
}

// 只读模式：fieldset 禁用内部所有原生表单控件，同时去除默认边框
.form-fieldset {
  border: none;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.form-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--text-muted);
}
.fixed-text {
  font-size: 13px;
  color: var(--text-secondary);
}
.interval-wrap {
  display: flex;
  align-items: center;
  gap: 8px;

  .interval-unit {
    width: 96px;
  }
}
.weekday-group {
  margin-right: 8px;
}

.parent-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;

  .parent-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    color: var(--color-primary);
    background: var(--color-primary-light, rgba(99, 102, 241, 0.12));
    line-height: 1.6;

    &.removable {
      cursor: default;
    }

    .parent-tag-x {
      cursor: pointer;
      opacity: 0.7;

      &:hover {
        opacity: 1;
        color: #ef4444;
      }
    }
  }

  .parent-pick {
    // 与标签选择器视觉一致的小按钮
    height: 28px;
    padding: 0 10px;
  }
}

.ro-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .ro-tag {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    line-height: 1.6;
  }
}

.form-tag-pop {
  width: 100%;

  // 与查询栏标签选择器保持同一高度，去掉 el-form-item 上下文带来的额外行高
  :deep(.tag-trigger) {
    width: 100%;
    height: 32px;
    min-height: 32px;
    padding: 0 4px;
    box-sizing: border-box;
    align-items: center;
  }
}
.completed-time {
  font-size: 13px;
  color: var(--color-primary);
  font-weight: 500;
}
.status-select {
  width: 100%;
}
.priority-radio-group {
  display: flex;
  gap: 16px;

  :deep(.el-radio__inner) {
    display: none;
  }
  :deep(.el-radio__label) {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }
  :deep(.el-radio__input.is-checked + .el-radio__label) {
    border-color: var(--color-primary);
    background-color: var(--color-primary-light);
  }
}
.priority-label {
  font-size: 13px;
}
.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.high {
    background-color: #ef4444;
  }
  &.medium {
    background-color: #f59e0b;
  }
  &.low {
    background-color: #10b981;
  }
}
.priority-high :deep(.el-radio__input.is-checked + .el-radio__label) {
  border-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}
.priority-medium :deep(.el-radio__input.is-checked + .el-radio__label) {
  border-color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.1);
}
.priority-low :deep(.el-radio__input.is-checked + .el-radio__label) {
  border-color: #10b981;
  background-color: rgba(16, 185, 129, 0.1);
}
</style>
