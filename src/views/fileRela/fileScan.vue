// 文件扫描（优化版）：原子化组件编排。扫描结果仅供展示，支持复制到文件夹。
<template>
  <div class="file-scan-card">
    <div class="card-header">
      <h3 class="card-title">
        <el-icon><LucideIcon name="Search" :size="20" /></el-icon>
        文件扫描
      </h3>
    </div>

    <div class="card-body">
      <!-- 扫描位置 -->
      <ScanPathSelect v-model="scanPath" />

      <!-- 扩展名（包含） -->
      <ScanExtInput v-model="extensions" class="block" />

      <!-- 文件夹 含/不含（复用删除页的 RuleTagGroup，语义与转移一致） -->
      <div class="block">
        <RuleTagGroup
          title="文件夹"
          v-model:include="folderInclude"
          v-model:exclude="folderExclude"
          ph-include="如 temp、备份，回车添加"
          default-mode="exclude"
        />
        <div class="hint">不含文件夹：其下所有子孙文件与子孙文件夹均跳过。</div>
      </div>

      <!-- 扫描选项 -->
      <ScanOptions v-model="scanOptions" class="block" />

      <div class="action-row">
        <el-button type="primary" @click="startScan" :loading="scanning" class="scan-btn">
          <el-icon><LucideIcon name="Search" /></el-icon>
          开始扫描
        </el-button>
      </div>
    </div>

    <!-- 结果区 -->
    <ScanResultList
      v-if="scanResultFiles.length"
      :files="scanResultFiles"
      @preview="onPreview"
      @copy="onCopy"
    />
    <div v-else-if="scanning" class="empty-tip">扫描中…</div>
    <div v-else class="empty-tip">尚无扫描结果（扫描结果仅展示，不入库）</div>

    <!-- 复制到文件夹 -->
    <ScanCopyDialog v-model="copyVisible" :files="copyFiles" @done="onCopyDone" />

    <!-- 预览 -->
    <ScanPreviewDialog v-model="previewVisible" :item="previewItem" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { ElMessage } from 'element-plus';
import ScanPathSelect from './fileScan/ScanPathSelect.vue';
import ScanExtInput from './fileScan/ScanExtInput.vue';
import ScanOptions from './fileScan/ScanOptions.vue';
import ScanResultList from './fileScan/ScanResultList.vue';
import ScanCopyDialog from './fileScan/ScanCopyDialog.vue';
import ScanPreviewDialog from './fileScan/ScanPreviewDialog.vue';
import RuleTagGroup from './fileDelete/RuleTagGroup.vue';
import type { ScanResult, ScanOptionsState } from './fileScan/types';

const scanPath = ref('');
const extensions = ref<string[]>([]);
const folderInclude = ref<string[]>([]);
const folderExclude = ref<string[]>([]);
const scanOptions = reactive<ScanOptionsState>({
  deep: 0,
  caseSensitiveMatch: true,
  onlyDirectories: false,
  onlyFiles: true,
  includeFolder: [],
  ignoreFolder: [],
});

const scanResultFiles = ref<ScanResult[]>([]);
const scanning = ref(false);
const scanStart = ref(0);
const scanTimeGap = ref('');

const copyVisible = ref(false);
const copyFiles = ref<ScanResult[]>([]);
const previewVisible = ref(false);
const previewItem = ref<ScanResult | null>(null);

function startScan() {
  if (!scanPath.value) {
    ElMessage.error('请先选择扫描位置');
    return;
  }
  if (extensions.value.length === 0) {
    ElMessage.error('请添加扫描扩展名');
    return;
  }
  scanning.value = true;
  scanResultFiles.value = [];
  scanStart.value = Date.now();
  scanTimeGap.value = '';
  window.ipcRenderer.send('start-scan', {
    startPath: scanPath.value,
    extensions: [...extensions.value],
    options: {
      deep: scanOptions.deep,
      caseSensitiveMatch: scanOptions.caseSensitiveMatch,
      onlyDirectories: scanOptions.onlyDirectories,
      onlyFiles: scanOptions.onlyFiles,
      includeFolder: [...folderInclude.value],
      ignoreFolder: [...folderExclude.value],
    },
  });
}

function onStartScan(_e: any, files: ScanResult[]) {
  scanResultFiles.value = files || [];
  scanning.value = false;
  const gap = Date.now() - scanStart.value;
  const h = Math.floor(gap / 1000 / 60 / 60);
  const m = Math.floor((gap / 1000 / 60) % 60);
  const s = Math.floor((gap / 1000) % 60);
  scanTimeGap.value = `${h ? h + '时' : ''}${m ? m + '分' : ''}${s ? s + '秒' : ''}` || '1秒内';
}

function onPreview(item: ScanResult) {
  previewItem.value = item;
  previewVisible.value = true;
}

function onCopy(files: ScanResult[]) {
  copyFiles.value = files;
  copyVisible.value = true;
}

function onCopyDone() {
  // 复制完成：结果仍为展示态，无需刷新
}

onMounted(() => {
  window.ipcRenderer.on('start-scan', onStartScan);
});
onUnmounted(() => {
  window.ipcRenderer.removeAllListeners('start-scan');
});
</script>

<style scoped lang="scss">
.file-scan-card {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
  padding: 16px;
}
.card-header {
  padding: 4px 4px 14px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 16px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.block {
  display: block;
}
.hint {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  margin-top: 6px;
}
.action-row {
  display: flex;
  justify-content: center;
}
.scan-btn {
  padding: 10px 32px;
}
.empty-tip {
  text-align: center;
  color: var(--text-tertiary, #999);
  font-size: 13px;
  padding: 24px 0;
}
</style>
