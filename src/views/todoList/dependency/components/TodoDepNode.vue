<script setup lang="ts">
/**
 * 依赖图自定义节点：展示单个待办的关键信息，供 TodoDepGraph 通过 #node-todoDep 插槽渲染。
 * 数据来自 useTodoDepGraph.buildGraph 产出的 DepNode.data（TodoDepNodeData + 运行时 __critical 标记）。
 * 仅接收 id / data（与项目既有自定义节点约定一致），点击由画布 @node-click 统一处理。
 */
import { computed } from 'vue';
import { getTodoStatusMeta } from '../../statusConfig';
import type { TodoDepNodeData } from '../composables/useTodoDepGraph';

const props = defineProps<{
  id: string;
  data: TodoDepNodeData & { __critical?: boolean };
}>();

const statusMeta = computed(() => getTodoStatusMeta(props.data.status));

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: '#ef4444' },
  medium: { label: '中', color: '#3b82f6' },
  low: { label: '低', color: '#9ca3af' },
};
const priorityMeta = computed(() => PRIORITY_META[props.data.priority] || PRIORITY_META.medium);

const dueText = computed(() => (props.data.dueDate ? props.data.dueDate.slice(0, 10) : '无截止'));
</script>

<template>
  <div class="todo-dep-node" :class="{ critical: data.__critical }">
    <span class="tdn-bar" :style="{ background: statusMeta.color }" />
    <div class="tdn-body">
      <div class="tdn-title" :title="data.title">{{ data.title }}</div>
      <div class="tdn-meta">
        <span class="tdn-chip prio" :style="{ color: priorityMeta.color, borderColor: priorityMeta.color }">
          {{ priorityMeta.label }}
        </span>
        <span class="tdn-due" :class="{ overdue: data.isOverdue }">
          {{ dueText }}
        </span>
        <span v-if="data.isOverdue" class="tdn-warn" title="已逾期">!</span>
      </div>
      <div class="tdn-tags">
        <span v-if="data.isSubtask" class="tdn-tag subtask">子任务 · {{ data.parentCount }} 父</span>
        <span v-if="data.childCount" class="tdn-tag child">{{ data.childCount }} 个子任务</span>
        <span class="tdn-tag status" :style="{ color: statusMeta.color }">{{ statusMeta.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.todo-dep-node {
  display: flex;
  align-items: stretch;
  width: 196px;
  min-height: 64px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #e3e6 eb);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.15s, border-color 0.15s;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary, #3b82f6);
    box-shadow: 0 2px 10px rgba(59, 130, 246, 0.18);
  }

  &.critical {
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.55), 0 2px 10px rgba(239, 68, 68, 0.2);
  }
}

.tdn-bar {
  width: 4px;
  flex-shrink: 0;
}

.tdn-body {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tdn-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  line-height: 1.35;
  max-height: 35px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.tdn-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.tdn-chip {
  padding: 0 6px;
  height: 16px;
  line-height: 15px;
  border: 1px solid;
  border-radius: 8px;
  font-weight: 600;
  flex-shrink: 0;
}

.tdn-due {
  color: var(--text-secondary, #6b7280);
  flex-shrink: 0;

  &.overdue {
    color: #ef4444;
    font-weight: 600;
  }
}

.tdn-warn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.tdn-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tdn-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-secondary, #6b7280);
  white-space: nowrap;

  &.subtask {
    background: rgba(139, 92, 246, 0.12);
    color: #8b5cf6;
  }
  &.child {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
  }
}
</style>
