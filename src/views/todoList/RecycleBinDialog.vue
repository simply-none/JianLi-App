<!--
  回收站（E5）：软删除待办的恢复 / 彻底删除。
  数据源 store.deletedTodos；超过 30 天的条目由主进程每日 00:05 自动彻底清理。
-->
<template>
  <app-dialog
    :model-value="modelValue"
    title="回收站"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="recycle-body">
      <div v-if="!store.deletedTodos.length" class="empty">
        <el-empty description="回收站是空的" :image-size="60" />
      </div>
      <div v-else class="recycle-list">
        <div v-for="t in store.deletedTodos" :key="t.key" class="recycle-row">
          <div class="row-main">
            <span class="row-title" :title="t.title">{{ t.title || '无标题' }}</span>
            <span class="row-meta">删除于 {{ (t.updateTime || '').slice(0, 16) }}</span>
          </div>
          <div class="row-actions">
            <el-button size="small" type="primary" plain @click="restore(t)">恢复</el-button>
            <el-button size="small" type="danger" plain @click="purge(t)">彻底删除</el-button>
          </div>
        </div>
      </div>
      <div v-if="store.deletedTodos.length" class="recycle-tip">
        回收站内条目保留 30 天，到期自动彻底清理；恢复后回到原列表。
      </div>
    </div>

    <template #footer>
      <el-button v-if="store.deletedTodos.length" type="danger" plain @click="emptyBin">清空回收站</el-button>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { useTodoStore } from '@/store/useTodo';
import type { TodoItem } from './types';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const store = useTodoStore();

/** 恢复到原列表（软删除标记清零） */
async function restore(t: TodoItem) {
  await store.restoreTodo(t.key);
  ElMessage.success('已恢复');
}

/** 彻底删除单条（物理删除，不可恢复） */
async function purge(t: TodoItem) {
  try {
    await ElMessageBox.confirm(`彻底删除「${t.title || '无标题'}」？此操作不可恢复。`, '彻底删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  await store.purgeTodo(t.key);
  ElMessage.success('已彻底删除');
}

/** 清空回收站 */
async function emptyBin() {
  try {
    await ElMessageBox.confirm(
      `彻底删除回收站内全部 ${store.deletedTodos.length} 条待办？此操作不可恢复。`,
      '清空回收站',
      { confirmButtonText: '清空', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  for (const t of [...store.deletedTodos]) {
    await store.purgeTodo(t.key);
  }
  ElMessage.success('回收站已清空');
}
</script>

<style scoped lang="scss">
.recycle-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow: auto;
}

.recycle-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recycle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-hover);

  .row-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .row-title {
      font-size: 13px;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row-meta {
      font-size: 11px;
      color: var(--text-muted);
    }
  }

  .row-actions {
    flex-shrink: 0;
    display: flex;
    gap: 6px;
  }
}

.recycle-tip {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
