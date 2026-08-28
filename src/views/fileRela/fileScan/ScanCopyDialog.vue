// 原子组件：复制到文件夹（目标 + 冲突策略 + 进度）
<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';
import type { ScanResult } from './types';

const props = defineProps<{ files: ScanResult[]; modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; done: [] }>();

const target = ref('');
const strategy = ref<'overwrite' | 'skip' | 'rename'>('rename');
const copying = ref(false);
const progress = ref({ current: 0, total: 0, currentPath: '' });
const finished = ref<{ ok: boolean; skipped: number; failed: string[] } | null>(null);

const planSize = computed(() => props.files.reduce((s, f) => s + (f.size || 0), 0));
const pct = computed(() =>
  progress.value.total ? Math.round((progress.value.current / progress.value.total) * 100) : 0
);

function formatSize(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return (i === 0 ? v : v.toFixed(1)) + ' ' + units[i];
}

function selectTarget() {
  const res = sendSync('get-file-list', 'select-dir');
  if (Array.isArray(res) && res[0]) target.value = res[0];
}

function onProgress(_e: any, p: any) {
  progress.value = p;
}
function onDone(_e: any, r: any) {
  finished.value = r;
  copying.value = false;
  window.ipcRenderer.removeAllListeners('copy-files-progress');
  window.ipcRenderer.removeAllListeners('copy-files');
  if (r.ok) ElMessage.success(`复制完成（跳过 ${r.skipped} 项）`);
  else ElMessage.warning(`复制完成，但有 ${r.failed.length} 项失败`);
  emit('done');
}

function start() {
  if (!target.value) {
    ElMessage.error('请选择目标文件夹');
    return;
  }
  if (!props.files.length) return;
  copying.value = true;
  finished.value = null;
  progress.value = { current: 0, total: props.files.length, currentPath: '' };
  window.ipcRenderer.on('copy-files-progress', onProgress);
  window.ipcRenderer.on('copy-files', onDone);
  window.ipcRenderer.send('copy-files', {
    files: props.files.map((f) => f.path),
    target: target.value,
    strategy: strategy.value,
  });
}

function close() {
  if (copying.value) return; // 复制中禁止关闭
  emit('update:modelValue', false);
  finished.value = null;
}

onUnmounted(() => {
  window.ipcRenderer.removeAllListeners('copy-files-progress');
  window.ipcRenderer.removeAllListeners('copy-files');
});
</script>

<template>
  <app-dialog :model-value="modelValue" title="复制到文件夹" width="560px" :close-on-click-modal="false" @update:model-value="(v:any)=>close()" @close="close">
    <div class="copy-dialog">
      <div class="row">
        <span class="lbl">目标</span>
        <el-input :model-value="target" placeholder="请选择目标文件夹" disabled :title="target">
          <template #append>
            <el-button @click="selectTarget" :disabled="copying">
              <el-icon><LucideIcon name="Folder" /></el-icon>
              选择
            </el-button>
          </template>
        </el-input>
      </div>

      <div class="row">
        <span class="lbl">冲突</span>
        <el-radio-group v-model="strategy" :disabled="copying">
          <el-radio value="rename">自动加序号</el-radio>
          <el-radio value="skip">跳过</el-radio>
          <el-radio value="overwrite">覆盖</el-radio>
        </el-radio-group>
      </div>

      <div class="plan">
        将复制 <b>{{ files.length }}</b> 项 → <b>{{ target || '（未选）' }}</b> · 约 <b>{{ formatSize(planSize) }}</b>
        <span v-if="strategy==='rename'">（重名自动加序号）</span>
      </div>

      <div v-if="copying || finished" class="progress">
        <el-progress :percentage="pct" :status="finished && !finished.ok ? 'exception' : (finished ? 'success' : '')" />
        <div class="prog-text">{{ progress.current }} / {{ progress.total }} · {{ progress.currentPath }}</div>
      </div>

      <div v-if="finished && finished.failed.length" class="fail">
        <div>失败项（前 10）：</div>
        <div v-for="(f, i) in finished.failed.slice(0, 10)" :key="i" class="fail-line">{{ f }}</div>
      </div>
    </div>

    <template #footer>
      <el-button @click="close" :disabled="copying">关闭</el-button>
      <el-button type="primary" @click="start" :disabled="copying || !files.length">开始复制</el-button>
    </template>
  </app-dialog>
</template>

<style scoped lang="scss">
.copy-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.lbl {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  width: 48px;
}
.plan {
  font-size: 13px;
  color: var(--text-secondary);
}
.progress {
  font-size: 12px;
  color: var(--text-secondary);
}
.prog-text {
  margin-top: 4px;
  word-break: break-all;
}
.fail {
  font-size: 12px;
  color: var(--el-color-danger, #f56c6c);
  max-height: 120px;
  overflow: auto;
}
.fail-line {
  word-break: break-all;
}
</style>
