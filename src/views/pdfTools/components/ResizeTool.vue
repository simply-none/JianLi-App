<template>
  <div class="tool-panel">
    <p class="hint">等比缩放内容并统一所有页面尺寸（单位 pt）。用于归一化不同来源的页面大小。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <div class="field row">
      <label>目标尺寸</label>
      <el-select v-model="sizeKey" style="width: 180px">
        <el-option label="A4（纵向 595×842）" value="a4" />
        <el-option label="A3（纵向 842×1191）" value="a3" />
        <el-option label="自定义" value="custom" />
      </el-select>
      <template v-if="sizeKey === 'custom'">
        <el-input-number v-model="cw" :min="100" :step="10" />
        <span class="x">×</span>
        <el-input-number v-model="ch" :min="100" :step="10" />
      </template>
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src" @click="run">统一尺寸</el-button>
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

const SIZE: Record<string, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  a3: { w: 841.89, h: 1190.55 },
};

const store = usePdfTools();
const src = ref<string | null>(null);
const sizeKey = ref<'a4' | 'a3' | 'custom'>('a4');
const cw = ref(595);
const ch = ref(842);
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

async function run(): Promise<void> {
  result.value = null;
  if (!src.value) {
    ElMessage.warning('请先选择 PDF');
    return;
  }
  const size = sizeKey.value === 'custom' ? { w: cw.value, h: ch.value } : SIZE[sizeKey.value];
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_尺寸.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.resize(src.value!, save.filePath, size);
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
  gap: 10px;
}
.field label {
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 6px;
}
.x {
  color: var(--text-muted);
}
.actions {
  margin-top: 8px;
}
</style>
