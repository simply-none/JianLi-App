<template>
  <div class="tool-panel">
    <p class="hint">永久涂黑敏感内容（不可逆）。可选整页涂黑，或按「页码 + 矩形」精确遮盖。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <el-radio-group v-model="mode" class="seg">
      <el-radio value="whole">整页涂黑</el-radio>
      <el-radio value="rects">指定矩形</el-radio>
    </el-radio-group>

    <template v-if="mode === 'whole'">
      <div class="field" style="margin-top: 12px">
        <label>涂黑的页码（留空=全部页）</label>
        <RangeInput v-model="rangeTags" hint="支持多个范围与单页，回车生成 tag；留空则整本文档涂黑" />
      </div>
    </template>

    <template v-else>
      <div class="rect-help">矩形格式：每行为「页码 左上x 左上y 宽 高」（pt，原点左上，逗号或空格分隔）。</div>
      <el-input v-model="rectsText" type="textarea" :rows="5" placeholder="例如：&#10;1 100 200 200 120&#10;3 50 300 180 90" />
    </template>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src || !canRun" @click="run">应用密文</el-button>
      <span v-if="src && !canRun" class="tip">请填写遮盖范围</span>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import PdfSourcePicker from './PdfSourcePicker.vue';
import PdfResultBar from './PdfResultBar.vue';
import RangeInput from './RangeInput.vue';
import { pdfApi } from '../api/pdfApi';
import { rangeTagsToIndices } from '../utils/pageRange';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfActionResult, RedactOpts } from '../types';

const store = usePdfTools();
const src = ref<string | null>(null);
const mode = ref<'whole' | 'rects'>('whole');
const rangeTags = ref<string[]>([]);
const rectsText = ref('');
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

const canRun = computed(() => (mode.value === 'whole' ? true : !!rectsText.value.trim()));

/** 解析 tag 列表 → 0 基页码集合；空 = 全部页（返回 undefined） */
function parsePages(): number[] | undefined {
  const idxs = rangeTagsToIndices(rangeTags.value);
  if (!idxs.length) return undefined; // 空 = 全部
  return idxs;
}

async function run(): Promise<void> {
  result.value = null;
  if (!src.value) {
    ElMessage.warning('请先选择 PDF');
    return;
  }
  const opts: RedactOpts =
    mode.value === 'whole'
      ? { mode: 'whole', pages: parsePages() }
      : {
          mode: 'rects',
          rects: rectsText.value
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => l.split(/[\s,]+/).map(Number))
            .filter((r) => r.length === 5 && r.every((n) => !isNaN(n))),
        };
  if (mode.value === 'rects' && !opts.rects?.length) {
    ElMessage.warning('请填写有效的矩形（页码 x y 宽 高）');
    return;
  }
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_密文.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.redact(src.value!, save.filePath, opts);
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
.seg {
  margin-bottom: 4px;
}
.rect-help {
  color: var(--text-muted);
  font-size: 12px;
  margin: 8px 0;
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
