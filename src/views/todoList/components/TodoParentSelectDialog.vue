<!--
  关联父任务选择弹窗（弹窗选择形式）
  - 左侧/主体：可搜索的任务列表，每行复选框多选（关联多个父任务）
  - 每行独立「查看」按钮：点击打开该父任务的只读详情（不可编辑）
  - 底部「取消 / 确定(已选 N 项)」：确定后把选中的 key 数组回传给详情弹窗
  - 候选来源：store 全部任务，仅排除「正在编辑的自身」防自关联；关键字同时匹配标题与描述
-->
<template>
  <app-dialog
    :model-value="visible"
    title="关联父任务"
    width="640px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="parent-select">
      <div class="ps-toolbar">
        <el-input
          v-model="search"
          placeholder="搜索任务标题或描述…"
          clearable
          size="default"
          class="ps-search"
        >
          <template #prefix>
            <LucideIcon name="Search" :size="14" class="ps-search-icon" />
          </template>
        </el-input>
        <span class="ps-count">已选 {{ checkedKeys.length }} 项</span>
      </div>

      <!-- 全量任务列表（仅排除自身），接入 VirtualList 虚拟化，任务多时也不卡 -->
      <VirtualList
        :items="candidates"
        item-key="key"
        :item-height="62"
        :gap="8"
        height="52vh"
        class="ps-list"
      >
        <template #default="{ item: t }">
          <div class="ps-item" :class="{ 'is-checked': checkedKeys.includes(t.key) }">
            <el-checkbox
              :model-value="checkedKeys.includes(t.key)"
              @change="() => toggle(t.key)"
            />
            <div class="ps-main" @click="viewDetail(t)">
              <div class="ps-line1">
                <span class="ps-title">{{ t.title || '无标题' }}</span>
                <span
                  v-if="store.isSubtask(t)"
                  class="ps-sub"
                  title="该任务本身也是子任务"
                >子</span>
              </div>
              <div class="ps-line2">
                <span class="ps-status" :style="{ color: statusMeta(t).color, background: statusMeta(t).bg }">
                  {{ statusMeta(t).label }}
                </span>
                <span class="ps-priority" :class="t.priority">{{ priorityText(t.priority) }}</span>
                <span v-if="t.recurrenceRule" class="ps-repeat">
                  <LucideIcon name="Repeat" :size="11" /> {{ recurrenceText(t) }}
                </span>
                <span
                  v-for="tag in tagsOf(t)"
                  :key="tag.key"
                  class="ps-tag"
                  :style="{ backgroundColor: tag.color + '20', color: tag.color }"
                >{{ tag.name }}</span>
              </div>
            </div>
            <LucideIcon name="Eye" class="ps-view" title="查看详情" @click="viewDetail(t)" />
          </div>
        </template>
        <template #empty>
          <div class="ps-empty">没有可关联的任务</div>
        </template>
      </VirtualList>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="confirm">确定（已选 {{ checkedKeys.length }} 项）</el-button>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import VirtualList from '@/components/VirtualList.vue';
import { useTodoStore } from '@/store/useTodo';
import { getTodoStatusMeta, formatRecurrence } from '../statusConfig';
import type { TodoItem, Tag } from '../types';

const props = defineProps<{
  visible: boolean;
  /** 当前已选父任务 key（编辑回显用） */
  selectedKeys: string[];
  /** 正在编辑的任务 key：从候选中排除自身，避免自关联 */
  excludeKey?: string;
  tags: Tag[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void;
  (e: 'confirm', keys: string[]): void;
  (e: 'view-detail', todo: TodoItem): void;
}>();

const store = useTodoStore();

/** 弹窗内多选状态：打开时从外部已选同步，避免与表单父任务状态互相覆盖 */
const checkedKeys = ref<string[]>([]);
const search = ref('');

// 打开弹窗时，用外部传入的已选初始化本地勾选
watch(
  () => props.visible,
  (val) => {
    if (val) {
      checkedKeys.value = [...props.selectedKeys];
      search.value = '';
    }
  },
);

/**
 * 候选父任务：展示全部任务，均可选（重复模板/实例此前被排除，导致可选项只剩零星几条）。
 * 仅排除「正在编辑的自身」，避免自关联造成父子环。
 * 关键字搜索同时匹配标题与描述。
 */
const candidates = computed<TodoItem[]>(() => {
  const q = search.value.trim().toLowerCase();
  return store.todos.filter((t) => {
    if (t.key === props.excludeKey) return false;
    if (!q) return true;
    const title = (t.title || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return title.includes(q) || desc.includes(q);
  });
});

function toggle(key: string) {
  const i = checkedKeys.value.indexOf(key);
  if (i >= 0) checkedKeys.value.splice(i, 1);
  else checkedKeys.value.push(key);
}

function statusMeta(t: TodoItem) {
  return getTodoStatusMeta(t.status);
}
const priorityText = (p: string) => ({ high: '高', medium: '中', low: '低' }[p] || '中');
function recurrenceText(t: TodoItem) {
  return formatRecurrence(t.recurrenceRule, t.recurrenceInterval, t.recurrenceWeekdays);
}
function tagsOf(t: TodoItem): Tag[] {
  try {
    const keys = JSON.parse(t.tags || '[]') as string[];
    return props.tags.filter((tag) => keys.includes(tag.key));
  } catch {
    return [];
  }
}

/** 点击行/查看图标：把该父任务交给外层打开只读详情 */
function viewDetail(t: TodoItem) {
  emit('view-detail', t);
}

function confirm() {
  emit('confirm', [...checkedKeys.value]);
  emit('update:visible', false);
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<style scoped lang="scss">
.parent-select {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ps-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;

  .ps-search {
    flex: 1;
    max-width: 300px;
  }
  .ps-search-icon {
    color: var(--text-muted);
  }
  .ps-count {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: auto;
  }
}

.ps-list {
  .ps-empty {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    padding: 28px 0;
  }

  .ps-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    transition: border-color 0.15s ease, background 0.15s ease;

    &:hover {
      border-color: var(--color-primary);
    }
    &.is-checked {
      background: var(--color-primary-light, rgba(99, 102, 241, 0.08));
      border-color: var(--color-primary);
    }

    .ps-main {
      flex: 1;
      min-width: 0;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .ps-line1 {
        display: flex;
        align-items: center;
        gap: 6px;

        .ps-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ps-sub {
          font-size: 11px;
          padding: 0 6px;
          border-radius: 8px;
          background: rgba(124, 58, 237, 0.12);
          color: #7c3aed;
          flex-shrink: 0;
        }
      }

      .ps-line2 {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        .ps-status {
          font-size: 11px;
          padding: 1px 7px;
          border-radius: 8px;
          font-weight: 500;
        }
        .ps-priority {
          font-size: 11px;
          padding: 1px 7px;
          border-radius: 8px;

          &.high { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
          &.medium { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
          &.low { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
        }
        .ps-repeat {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: var(--color-primary);
        }
        .ps-tag {
          font-size: 11px;
          padding: 1px 7px;
          border-radius: 8px;
        }
      }
    }

    .ps-view {
      font-size: 16px;
      color: var(--text-muted);
      cursor: pointer;
      flex-shrink: 0;
      padding: 4px;

      &:hover {
        color: var(--color-primary);
      }
    }
  }
}
</style>
