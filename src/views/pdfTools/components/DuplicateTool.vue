<template>
  <div class="tool-panel">
    <p class="hint">选择源 PDF，并指定要复制的页码（1 基，支持逗号与连字符，如 1,3,5-8）。复制页将追加在各自原页之后。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <div class="field">
      <label>要复制的页码</label>
      <el-input v-model="spec" placeholder="例如 1,3,5-8" />
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src || !indices.length" @click="run">复制页面</el-button>
      <span v-if="src && !indices.length" class="tip">请输入有效页码</span>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import PdfSourcePicker from './PdfSourcePicker.vue';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfActionResult } from '../types';

/** 解析 "1,3,5-8" 为去重升序的 0 基页码数组 */
function parsePages(spec: string): number[] {
  const set = new Set<number>();
  for (const part of spec.split(/[,\s]+/).filter(Boolean)) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((x) => parseInt(x, 10));
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i - 1);
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) set.add(n - 1);
    }
  }
  return [...set].filter((i) => i >= 0).sort((a, b) => a - b);
}

const store = usePdfTools();
const src = ref<string | null>(null);
const spec = ref('');
const indices = computed(() => parsePages(spec.value));
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

async function run(): Promise<void> {
  result.value = null;
  if (!src.value || !indices.value.length) {
    ElMessage.warning('请选择 PDF 并输入有效页码');
    return;
  }
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_复制.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.duplicate(src.value!, save.filePath, indices.value);
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
