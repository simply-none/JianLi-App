<template>
  <div class="tool-panel">
    <p class="hint">设置页面标签（即 PDF 阅读器页脚显示的编号，如 i/ii 与 1/2 混排）。按起始页切分区间。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <div class="ranges">
      <div v-for="(r, i) in ranges" :key="i" class="r-row">
        <div class="r-item">
          <label>起始页(1基)</label>
          <el-input-number v-model="r.start1" :min="1" />
        </div>
        <div class="r-item">
          <label>样式</label>
          <el-select v-model="r.style">
            <el-option label="阿拉伯 1,2,3" value="decimal" />
            <el-option label="罗马 I,II,III" value="upperRoman" />
            <el-option label="罗马 i,ii,iii" value="lowerRoman" />
            <el-option label="字母 A,B,C" value="upperLetter" />
            <el-option label="字母 a,b,c" value="lowerLetter" />
          </el-select>
        </div>
        <div class="r-item">
          <label>前缀</label>
          <el-input v-model="r.prefix" placeholder="如 附录-" />
        </div>
        <div class="r-item">
          <label>起始编号</label>
          <el-input-number v-model="r.startNum" :min="1" />
        </div>
        <LucideIcon name="Trash2" :size="15" class="r-del" @click="removeRange(i)" />
      </div>
    </div>

    <el-button text type="primary" @click="addRange">+ 添加区间</el-button>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src || !ranges.length" @click="run">应用页面标签</el-button>
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
import { usePdfTools } from '../store/usePdfTools';
import type { PdfActionResult, PageLabelStyle, PageLabelRange } from '../types';

interface RangeRow {
  start1: number;
  style: PageLabelStyle;
  prefix: string;
  startNum: number;
}

const store = usePdfTools();
const src = ref<string | null>(null);
const ranges = ref<RangeRow[]>([{ start1: 1, style: 'decimal', prefix: '', startNum: 1 }]);
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

function addRange(): void {
  ranges.value.push({ start1: 1, style: 'decimal', prefix: '', startNum: 1 });
}
function removeRange(i: number): void {
  ranges.value.splice(i, 1);
}

async function run(): Promise<void> {
  result.value = null;
  if (!src.value || !ranges.value.length) {
    ElMessage.warning('请先选择 PDF 并配置区间');
    return;
  }
  const labels: PageLabelRange[] = ranges.value
    .map((r) => ({ start: r.start1 - 1, style: r.style, prefix: r.prefix || undefined, startNum: r.startNum }))
    .sort((a, b) => a.start - b.start);
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_标签.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.pageLabels(src.value!, save.filePath, labels);
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
.ranges {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 8px;
}
.r-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
}
.r-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.r-item label {
  color: var(--text-secondary);
  font-size: 12px;
}
.r-del {
  cursor: pointer;
  color: var(--text-secondary);
  margin-left: auto;
  padding: 4px;
  border-radius: 4px;
}
.r-del:hover {
  background: var(--bg-hover);
  color: var(--color-error);
}
.actions {
  margin-top: 12px;
}
</style>
