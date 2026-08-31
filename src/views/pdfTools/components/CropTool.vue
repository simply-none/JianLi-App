<template>
  <div class="tool-panel">
    <p class="hint">按四边边距裁剪页面白边（单位 pt，1pt ≈ 0.35mm）。仅调整裁剪框，不丢失内容，可随时还原。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <div class="margins">
      <div class="m-item">
        <label>上</label>
        <el-input-number v-model="m.top" :min="0" :step="5" />
      </div>
      <div class="m-item">
        <label>下</label>
        <el-input-number v-model="m.bottom" :min="0" :step="5" />
      </div>
      <div class="m-item">
        <label>左</label>
        <el-input-number v-model="m.left" :min="0" :step="5" />
      </div>
      <div class="m-item">
        <label>右</label>
        <el-input-number v-model="m.right" :min="0" :step="5" />
      </div>
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src" @click="run">裁剪白边</el-button>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import PdfSourcePicker from './PdfSourcePicker.vue';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfActionResult, CropMargins } from '../types';

const store = usePdfTools();
const src = ref<string | null>(null);
const m = reactive<CropMargins>({ left: 0, right: 0, top: 0, bottom: 0 });
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

async function run(): Promise<void> {
  result.value = null;
  if (!src.value) {
    ElMessage.warning('请先选择 PDF');
    return;
  }
  if (!m.left && !m.right && !m.top && !m.bottom) {
    ElMessage.warning('四边边距均为 0，无需裁剪');
    return;
  }
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_裁剪.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.crop(src.value!, save.filePath, { ...m });
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
.field label {
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 6px;
}
.margins {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.m-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.m-item label {
  color: var(--text-secondary);
  font-size: 13px;
}
.actions {
  margin-top: 4px;
}
</style>
