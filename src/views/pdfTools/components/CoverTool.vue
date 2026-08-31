<template>
  <div class="tool-panel">
    <p class="hint">在文档最前插入一页封面：可放背景图片、标题文字，或两者兼具。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <div class="field">
      <label>封面图片（可选，背景铺底）</label>
      <div class="img-pick">
        <el-button @click="pickImage">选择图片</el-button>
        <span v-if="imagePath" class="img-name" :title="imagePath">{{ imageName }}</span>
        <el-button v-if="imagePath" text type="danger" @click="imagePath = null">清除</el-button>
        <input ref="imgInput" type="file" accept="image/*" hidden @change="onImg" />
      </div>
    </div>

    <div class="field">
      <label>封面标题（可选）</label>
      <el-input v-model="title" placeholder="如 项目报告 2026" />
    </div>

    <div class="field row">
      <label>页面尺寸</label>
      <el-select v-model="sizeKey" style="width: 180px">
        <el-option label="A4（纵向）" value="a4" />
        <el-option label="A3（纵向）" value="a3" />
        <el-option label="自定义" value="custom" />
      </el-select>
      <template v-if="sizeKey === 'custom'">
        <el-input-number v-model="cw" :min="100" :step="10" />
        <span class="x">×</span>
        <el-input-number v-model="ch" :min="100" :step="10" />
      </template>
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src || (!title && !imagePath)" @click="run">添加封面</el-button>
      <span v-if="src && !title && !imagePath" class="tip">至少提供标题或图片</span>
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
import type { PdfActionResult, CoverOpts } from '../types';

const SIZE: Record<string, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  a3: { w: 841.89, h: 1190.55 },
};

const store = usePdfTools();
const src = ref<string | null>(null);
const imagePath = ref<string | null>(null);
const imgInput = ref<HTMLInputElement | null>(null);
const title = ref('');
const sizeKey = ref<'a4' | 'a3' | 'custom'>('a4');
const cw = ref(595);
const ch = ref(842);
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

const imageName = computed(() => (imagePath.value || '').replace(/^.*[\\/]/, ''));

function pickImage(): void {
  imgInput.value?.click();
}
function onImg(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) imagePath.value = (f as any).path || null;
  (e.target as HTMLInputElement).value = '';
}

async function run(): Promise<void> {
  result.value = null;
  if (!src.value || (!title.value && !imagePath.value)) {
    ElMessage.warning('请选择 PDF，并提供标题或封面图片');
    return;
  }
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_封面.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const size = sizeKey.value === 'custom' ? { w: cw.value, h: ch.value } : SIZE[sizeKey.value];
    const opts: CoverOpts = { title: title.value || undefined, imagePath: imagePath.value || undefined, w: size.w, h: size.h };
    const res = await pdfApi.addCover(src.value!, save.filePath, opts);
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
.img-pick {
  display: flex;
  align-items: center;
  gap: 10px;
}
.img-name {
  color: var(--text-secondary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}
.x {
  color: var(--text-muted);
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
