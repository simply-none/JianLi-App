<template>
  <div class="tool-panel">
    <p class="hint">逐页栅格化识别空白页（非白像素占比低于阈值即判定为空白），可一键删除并另存。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <div v-if="scanning" class="scanning">
      <LucideIcon name="LoaderCircle" :size="15" class="spin" /> 正在扫描页面…
    </div>

    <div v-if="blank.length" class="blank-box">
      <div class="blank-title">检测到 {{ blank.length }} 个空白页：</div>
      <div class="blank-tags">
        <el-tag v-for="i in blank" :key="i" type="danger" size="small">第 {{ i + 1 }} 页</el-tag>
      </div>
      <el-button type="primary" :loading="loading" class="clean-btn" @click="clean">删除空白页并另存</el-button>
    </div>
    <el-alert v-else-if="scanned" type="success" :closable="false" title="未检测到空白页" />

    <div class="actions" v-if="!scanned">
      <el-button :loading="scanning" :disabled="!src" @click="scan">开始检测</el-button>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import PdfSourcePicker from './PdfSourcePicker.vue';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import { loadPdf, findBlankPages } from '../composables/usePdfjs';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfActionResult } from '../types';

const store = usePdfTools();
const src = ref<string | null>(null);
const blank = ref<number[]>([]);
const scanned = ref(false);
const scanning = ref(false);
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

async function readBytes(path: string): Promise<string> {
  return (window as any).ipcRenderer.ebook.readFileBytes(path).then((r: any) => r.base64 as string);
}

async function scan(): Promise<void> {
  result.value = null;
  if (!src.value) {
    ElMessage.warning('请先选择 PDF');
    return;
  }
  scanned.value = false;
  blank.value = [];
  scanning.value = true;
  try {
    const base64 = await readBytes(src.value);
    const doc = await loadPdf(base64);
    blank.value = await findBlankPages(doc, 0.012);
    scanned.value = true;
    doc.destroy?.();
  } catch (e) {
    ElMessage.error('检测失败：' + String(e));
  } finally {
    scanning.value = false;
  }
}

async function clean(): Promise<void> {
  if (!src.value || !blank.value.length) return;
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_去空白.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const set = new Set(blank.value);
    const total = await readTotal(src.value);
    const pageMap = Array.from({ length: total }, (_, i) => ({ index: i })).filter((p) => !set.has(p.index));
    const res = await pdfApi.organize(src.value!, save.filePath, pageMap);
    result.value = res;
    if (res.success && res.outputPath) store.pushOutput(res.outputPath);
  } finally {
    loading.value = false;
  }
}

/** 读取总页数（复用 readFileBytes + loadPdf） */
async function readTotal(path: string): Promise<number> {
  const base64 = await readBytes(path);
  const doc = await loadPdf(base64);
  const n = doc.numPages as number;
  doc.destroy?.();
  return n;
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
.scanning {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  margin: 8px 0;
}
.spin {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.blank-box {
  margin: 8px 0;
}
.blank-title {
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}
.blank-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.clean-btn {
  margin-top: 12px;
}
.actions {
  margin-top: 8px;
}
</style>
