<template>
  <div class="tool-panel">
    <p class="hint">选择源 PDF 与要插入的 PDF，指定插入位置（0 = 最前，依此类推）。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>
    <div class="field">
      <label>要插入的 PDF</label>
      <PdfSourcePicker v-model:path="insertFile" />
    </div>

    <div class="field row">
      <label>插入位置（0 基页码）</label>
      <el-input-number v-model="atIndex" :min="0" :controls="true" />
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src || !insertFile" @click="run">插入页面</el-button>
      <span v-if="!src || !insertFile" class="tip">需选择两个 PDF</span>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import PdfSourcePicker from './PdfSourcePicker.vue';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfActionResult } from '../types';

const store = usePdfTools();
const src = ref<string | null>(null);
const insertFile = ref<string | null>(null);
const atIndex = ref(0);
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

async function run(): Promise<void> {
  result.value = null;
  if (!src.value || !insertFile.value) {
    ElMessage.warning('请选择源 PDF 与要插入的 PDF');
    return;
  }
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_插入.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.insert(src.value!, save.filePath, insertFile.value!, atIndex.value);
    result.value = res;
    if (res.success && res.outputPath) store.pushOutput(res.outputPath);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.tool-panel {
  display: flex;
  flex-direction: column;
}
.hint {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 12px;
}
.field {
  margin-bottom: 12px;
}
.field.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.field label {
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 6px;
}
.actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.tip {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
