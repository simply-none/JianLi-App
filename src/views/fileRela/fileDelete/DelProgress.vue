// 原子组件：删除进度弹窗 + 结果反馈
// 始终监听 IPC；仅当 monitor=true 时展示进度弹窗。完成时向上 emit finished。
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  monitor: boolean; // 是否展示进度弹窗（关闭时仍监听完成事件以便刷新）
}>();

const emit = defineEmits<{
  finished: [result: any];
}>();

const visible = ref(false);
const current = ref(0);
const total = ref(0);
const currentPath = ref('');
const percent = ref(0);

function onProgress(_e: any, data: { current: number; total: number; currentPath: string }) {
  current.value = data.current;
  total.value = data.total;
  currentPath.value = data.currentPath;
  percent.value = total.value ? Math.min(100, Math.round((current.value / total.value) * 100)) : 0;
  if (props.monitor) visible.value = true;
}

function onDone(_e: any, res: any) {
  visible.value = false;
  if (res == null) {
    ElMessage.success('删除成功');
  } else {
    ElMessage({ message: '删除失败: ' + res, type: 'error', duration: 5000 });
  }
  emit('finished', res);
}

onMounted(() => {
  window.ipcRenderer.on('delete-files', onDone);
  window.ipcRenderer.on('delete-files-progress', onProgress);
});
onUnmounted(() => {
  window.ipcRenderer.removeAllListeners('delete-files');
  window.ipcRenderer.removeAllListeners('delete-files-progress');
});
</script>

<template>
  <app-dialog
    v-model="visible"
    title="文件删除进度"
    width="440px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
  >
    <div class="progress-body">
      <el-progress :percentage="percent" :stroke-width="14" />
      <div class="progress-meta">已删除 {{ current }} / {{ total }} 项</div>
      <div class="progress-current" :title="currentPath">{{ currentPath || '准备中…' }}</div>
    </div>
  </app-dialog>
</template>

<style scoped lang="scss">
.progress-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 96px;
}

.progress-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.progress-current {
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
  max-height: 96px;
  overflow-y: auto;
  line-height: 1.6;
}
</style>
