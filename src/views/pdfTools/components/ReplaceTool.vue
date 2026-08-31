<template>
  <div class="tool-panel">
    <p class="hint">用「替换文件」的页面覆盖源 PDF 中从「起始位置」开始的一段页面。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>
    <div class="field">
      <label>替换文件（其页面将覆盖源文件对应段）</label>
      <PdfSourcePicker v-model:path="replaceFile" />
    </div>

    <div class="field row">
      <label>起始位置（0 基页码）</label>
      <el-input-number v-model="targetStart" :min="0" :controls="true" />
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src || !replaceFile" @click="run">替换页面</el-button>
      <span v-if="!src || !replaceFile" class="tip">需选择两个 PDF</span>
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
const replaceFile = ref<string | null>(null);
const targetStart = ref(0);
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

async function run(): Promise<void> {
  result.value = null;
  if (!src.value || !replaceFile.value) {
    ElMessage.warning('请选择源 PDF 与替换文件');
    return;
  }
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_替换.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.replace(src.value!, save.filePath, replaceFile.value!, targetStart.value);
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
