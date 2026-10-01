<template>
  <app-dialog
    :model-value="visible"
    title="高级条件批量编辑"
    width="540px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <TodoBatchEditPanel @applied="onApplied" />

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { useTodoStore } from '@/store/useTodo';
import TodoBatchEditPanel from './components/TodoBatchEditPanel.vue';

defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>();

const store = useTodoStore();

function handleClose() {
  emit('update:visible', false);
}

/** 批量修改完成后：刷新列表并关闭弹窗 */
function onApplied() {
  store.fetchTodos();
  handleClose();
}
</script>
