<template>
  <div class="task-list">
    <div class="list-header">
      <el-input v-model="keyword" size="small" placeholder="搜索任务" clearable />
      <el-button size="small" type="primary" @click="emit('create')">新建</el-button>
    </div>
    <div v-if="!filtered.length" class="empty-tip">暂无任务，点击「新建」创建</div>
    <div
      v-for="task in filtered"
      :key="task.id"
      class="task-item"
      :class="{ 'is-active': activeId === task.id }"
      @click="emit('select', task)"
    >
      <div class="task-name" :title="task.config.url">{{ task.name }}</div>
      <div class="task-meta">
        <span class="task-url">{{ task.config.url || '未配置 URL' }}</span>
        <el-button
          class="task-delete"
          size="small"
          text
          type="danger"
          @click.stop="confirmDelete(task)"
        >删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 任务列表侧边栏
 * ------------------------------------------------------------------
 * 展示已保存的采集任务（搜索过滤/点击载入/删除），
 * 并提供「新建」入口。数据由父组件传入与刷新。
 */
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { TaskItem } from '../../types'

/** 组件属性 */
const props = defineProps<{
  /** 任务列表 */
  tasks: TaskItem[];
  /** 当前选中的任务 id（高亮） */
  activeId?: number | null;
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 点击「新建」 */
  (e: 'create'): void;
  /** 选中某个任务载入编辑 */
  (e: 'select', task: TaskItem): void;
  /** 请求删除任务（父组件执行并刷新） */
  (e: 'delete', id: number): void;
}>()

/** 搜索关键字 */
const keyword = ref('')

/** 关键字过滤后的任务列表 */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.tasks
  return props.tasks.filter(
    (t) => t.name.toLowerCase().includes(kw) || (t.config.url || '').toLowerCase().includes(kw)
  )
})

/**
 * 确认删除任务（二次确认后向父组件发事件）
 * @param task 待删除任务
 */
async function confirmDelete(task: TaskItem): Promise<void> {
  await ElMessageBox.confirm(`确定删除任务「${task.name}」？`, '删除确认', { type: 'warning' })
  emit('delete', task.id)
}
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  overflow-y: auto;
}
.list-header {
  display: flex;
  gap: 6px;
}
.empty-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 12px 0;
  text-align: center;
}
.task-item {
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.task-item:hover {
  background: var(--el-fill-color-light);
}
.task-item.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.task-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.task-url {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-delete {
  flex-shrink: 0;
  padding: 0;
  height: auto;
}
</style>
