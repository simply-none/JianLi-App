<template>
  <app-dialog
    :model-value="visible"
    title="高级条件删除"
    width="540px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <TodoBatchDeletePanel @deleted="onDeleted" />

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { useTodoStore } from '@/store/useTodo';
import TodoBatchDeletePanel from './components/TodoBatchDeletePanel.vue';

defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>();

const store = useTodoStore();

function handleClose() {
  emit('update:visible', false);
}

/** 面板批量/单条删除完成后：刷新列表并关闭弹窗 */
function onDeleted(_keys: string[]) {
  store.fetchTodos();
  handleClose();
}
</script>
