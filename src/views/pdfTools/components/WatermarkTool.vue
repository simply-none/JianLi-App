<template>
  <div class="tool-panel">
    <p class="hint">平铺文字水印（浅色模拟透明度）。可调整文字、颜色、角度与字号。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <div class="grid2">
      <div class="m-item">
        <label>水印文字</label>
        <el-input v-model="text" placeholder="如 机密 / 草稿" />
      </div>
      <div class="m-item">
        <label>字号</label>
        <el-input-number v-model="fontSize" :min="12" :max="120" :step="4" />
      </div>
      <div class="m-item">
        <label>角度</label>
        <el-input-number v-model="angle" :min="-90" :max="90" :step="5" />
      </div>
      <div class="m-item">
        <label>颜色</label>
        <el-color-picker v-model="colorHex" @change="onColor" />
      </div>
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src || !text" @click="run">添加水印</el-button>
      <span v-if="src && !text" class="tip">请输入水印文字</span>
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
import type { PdfActionResult, WatermarkOpts } from '../types';

/** #rrggbb → [r,g,b] 0~1 */
function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const store = usePdfTools();
const src = ref<string | null>(null);
const text = ref('机密');
const fontSize = ref(48);
const angle = ref(-30);
const colorHex = ref('#999999');
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

function onColor(): void {
  /* 颜色已绑定到 colorHex，运行前转换 */
}

async function run(): Promise<void> {
  result.value = null;
  if (!src.value || !text.value) {
    ElMessage.warning('请选择 PDF 并输入水印文字');
    return;
  }
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_水印.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const opts: WatermarkOpts = { text: text.value, color: hexToRgb01(colorHex.value), angle: angle.value, fontSize: fontSize.value };
    const res = await pdfApi.watermark(src.value!, save.filePath, opts);
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
.grid2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
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
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.tip {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
