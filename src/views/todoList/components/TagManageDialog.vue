<!--
  标签管理弹窗（D5）：重命名 / 改色 / 删除。
  删除标签时同步清理 todo_list.tags JSON 中的引用（逐条 upsert，走合规通道），
  完成后刷新 store 的标签与待办。
-->
<template>
  <el-dialog
    :model-value="modelValue"
    title="管理标签"
    width="500px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="tag-manage">
      <div v-if="!store.tags.length" class="empty">暂无标签，先在筛选栏新建吧</div>
      <div v-for="tag in store.tags" :key="tag.key" class="tag-row">
        <template v-if="editingKey === tag.key">
          <el-input v-model="editName" size="small" maxlength="20" class="edit-input" />
          <div class="palette">
            <span
              v-for="c in palette"
              :key="c"
              class="color-dot selectable"
              :class="{ active: editColor === c }"
              :style="{ background: c }"
              @click="editColor = c"
            />
          </div>
          <el-button size="small" type="primary" @click="saveEdit(tag)">保存</el-button>
          <el-button size="small" @click="cancelEdit">取消</el-button>
        </template>
        <template v-else>
          <span class="color-dot" :style="{ background: tag.color }" />
          <span class="tag-name">{{ tag.name }}</span>
          <span class="tag-count">{{ countOf(tag.key) }} 条待办</span>
          <span class="row-actions">
            <el-button link type="primary" size="small" title="编辑" @click="startEdit(tag)">
              <LucideIcon name="Pencil" :size="14" />
            </el-button>
            <el-button link type="danger" size="small" title="删除" @click="removeTag(tag)">
              <LucideIcon name="Trash2" :size="14" />
            </el-button>
          </span>
        </template>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { useTodoStore } from '@/store/useTodo';
import { saveTag, deleteTag, saveTodo } from '../api/todoApi';
import type { Tag, TodoItem } from '../types';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const store = useTodoStore();

// 调色板与 TagSelectPopover 保持一致
const palette = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const editingKey = ref('');
const editName = ref('');
const editColor = ref(palette[0]);

function countOf(tagKey: string): number {
  return store.activeTodos.filter((t) => {
    try {
      const keys = JSON.parse(t.tags || '[]') as string[];
      return keys.includes(tagKey);
    } catch {
      return false;
    }
  }).length;
}

function startEdit(tag: Tag) {
  editingKey.value = tag.key;
  editName.value = tag.name;
  editColor.value = tag.color || palette[0];
}

function cancelEdit() {
  editingKey.value = '';
  editName.value = '';
}

/** 保存编辑：重命名/改色（携带原 id 按 id 更新）；重名拦截 */
async function saveEdit(tag: Tag) {
  const name = editName.value.trim();
  if (!name) {
    ElMessage.warning('标签名称不能为空');
    return;
  }
  if (store.tags.some((t) => t.key !== tag.key && t.name === name)) {
    ElMessage.warning('已存在同名标签');
    return;
  }
  await saveTag({ ...tag, name, color: editColor.value });
  await store.fetchTags();
  ElMessage.success('已保存');
  cancelEdit();
}

/** 删除标签：先清理待办 tags 引用，再删标签行，最后刷新 */
async function removeTag(tag: Tag) {
  if (!tag.id) {
    ElMessage.error('标签数据缺少 id，无法删除');
    return;
  }
  const affected = store.todos.filter((t) => {
    try {
      return ((JSON.parse(t.tags || '[]') as string[]) || []).includes(tag.key);
    } catch {
      return false;
    }
  });
  try {
    await ElMessageBox.confirm(
      affected.length
        ? `确定删除标签「${tag.name}」吗？将同时从 ${affected.length} 条待办上移除该标签。`
        : `确定删除标签「${tag.name}」吗？`,
      '删除标签',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return; /* 用户取消 */
  }

  // 清理待办上的引用（逐条 upsert 合规通道；量级=命中条数）
  for (const t of affected) {
    let keys: string[] = [];
    try {
      keys = JSON.parse(t.tags || '[]');
    } catch {
      keys = [];
    }
    const next: TodoItem = {
      ...t,
      tags: JSON.stringify(keys.filter((k) => k !== tag.key)),
      updateTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    await saveTodo(next);
  }
  await deleteTag(tag.id);
  await Promise.all([store.fetchTags(), store.fetchTodos()]);
  // 引用清理后重排提醒（全量兜底一次）
  window.ipcRenderer?.send('update-todo-reminders');
  ElMessage.success('标签已删除');
}
</script>

<style scoped lang="scss">
.tag-manage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 380px;
  overflow: auto;

  .empty {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    padding: 24px 0;
  }
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;

  &:hover {
    background: var(--bg-hover);
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;

    &.selectable {
      cursor: pointer;
      box-sizing: content-box;
      border: 2px solid transparent;

      &.active {
        border-color: var(--color-primary);
      }
    }
  }

  .tag-name {
    flex: 0 1 auto;
    font-size: 13px;
    color: var(--text-primary);
  }

  .tag-count {
    flex: 1;
    font-size: 12px;
    color: var(--text-muted);
  }

  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .edit-input {
    width: 140px;
  }

  .palette {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
}
</style>
