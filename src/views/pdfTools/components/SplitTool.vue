<template>
  <div class="tool-panel">
    <FileDropZone @select="onSelect" />

    <div v-if="file" class="cfg">
      <div class="sel-file">
        <LucideIcon name="FileText" :size="15" class="ficon" />
        <span class="fname" :title="file.path">{{ file.name }}</span>
      </div>

      <div class="mode-row">
        <span class="lbl">拆分方式</span>
        <el-radio-group v-model="modeType">
          <el-radio value="range">按范围</el-radio>
          <el-radio value="everyN">每 N 页</el-radio>
          <el-radio value="oddEven">奇偶页</el-radio>
        </el-radio-group>
      </div>

      <div v-if="modeType === 'range'" class="opt-row">
        <span class="lbl">页码范围</span>
        <el-input v-model="rangeText" placeholder="如 1-3,5-7（逗号分隔，闭区间）" />
      </div>
      <div v-else-if="modeType === 'everyN'" class="opt-row">
        <span class="lbl">每页</span>
        <el-input-number v-model="everyN" :min="1" :max="999" />
        <span class="unit">页一份</span>
      </div>
      <div v-else class="opt-row">
        <span class="lbl">输出</span>
        <span class="hint">将生成 2 份：奇数页 / 偶数页</span>
      </div>

      <div class="opt-row">
        <span class="lbl">输出目录</span>
        <el-input :model-value="outDir" readonly placeholder="点击选择输出目录" @click="pickDir">
          <template #suffix>
            <LucideIcon name="FolderOpen" :size="15" class="ficon" />
          </template>
        </el-input>
      </div>

      <div class="actions">
        <el-button type="primary" :loading="loading" :disabled="!canRun" @click="doSplit">开始拆分</el-button>
      </div>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import FileDropZone from './FileDropZone.vue';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfFileItem, PdfActionResult, SplitConfig } from '../types';

const store = usePdfTools();
const file = ref<PdfFileItem | null>(null);
const modeType = ref<'range' | 'everyN' | 'oddEven'>('range');
const rangeText = ref('1-3');
const everyN = ref(2);
const outDir = ref('');
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

const canRun = computed(() => !!file.value && !!outDir.value && (modeType.value !== 'range' || parsedRanges.value.length > 0));

function onSelect(paths: string[]): void {
  if (paths.length) {
    file.value = { path: paths[0], name: paths[0].replace(/^.*[\\/]/, '') };
    result.value = null;
  }
}

/** 解析范围文本（1 基闭区间）→ 0 基 [[s,e]] */
const parsedRanges = computed<Array<[number, number]>>(() => {
  if (modeType.value !== 'range') return [];
  const out: Array<[number, number]> = [];
  for (const part of rangeText.value.split(',')) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) {
      const single = seg.match(/^(\d+)$/);
      if (single) {
        const n = parseInt(single[1], 10) - 1;
        out.push([n, n]);
      }
      continue;
    }
    const s = parseInt(m[1], 10) - 1;
    const e = parseInt(m[2], 10) - 1;
    if (e >= s) out.push([s, e]);
  }
  return out;
});

async function pickDir(): Promise<void> {
  const res = await pdfApi.pickDir();
  if (res.success && res.dir) outDir.value = res.dir;
}

function buildMode(): SplitConfig {
  if (modeType.value === 'range') return { type: 'range', ranges: parsedRanges.value };
  if (modeType.value === 'everyN') return { type: 'everyN', n: everyN.value };
  return { type: 'oddEven' };
}

async function doSplit(): Promise<void> {
  result.value = null;
  if (!file.value || !outDir.value) return;
  if (modeType.value === 'range' && parsedRanges.value.length === 0) {
    ElMessage.warning('请填写有效的页码范围');
    return;
  }
  const base = file.value.name.replace(/\.pdf$/i, '');
  loading.value = true;
  try {
    const res = await pdfApi.split(file.value.path, outDir.value, base, buildMode());
    result.value = res;
    if (res.success && res.files) res.files.forEach((p) => store.pushOutput(p));
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
.cfg {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sel-file {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ficon {
  color: var(--color-primary);
  flex: none;
}
.fname {
  color: var(--text-primary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mode-row,
.opt-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.lbl {
  width: 64px;
  flex: none;
  color: var(--text-secondary);
  font-size: 13px;
}
.unit,
.hint {
  color: var(--text-muted);
  font-size: 12px;
}
.actions {
  margin-top: 4px;
}
</style>
