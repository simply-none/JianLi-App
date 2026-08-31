<template>
  <div class="tool-panel">
    <FileDropZone @select="onSelect" />

    <div v-if="file" class="cfg">
      <div class="sel-file">
        <LucideIcon name="FileText" :size="15" class="ficon" />
        <span class="fname" :title="file.path">{{ file.name }}</span>
        <span class="pc">共 {{ pageCount }} 页</span>
      </div>

      <div class="opt-row">
        <span class="lbl">图片格式</span>
        <el-radio-group v-model="format">
          <el-radio value="png">PNG</el-radio>
          <el-radio value="jpg">JPG</el-radio>
        </el-radio-group>
      </div>

      <div class="opt-row">
        <span class="lbl">清晰度</span>
        <el-radio-group v-model="scale">
          <el-radio :value="1">标准</el-radio>
          <el-radio :value="1.5">高清</el-radio>
          <el-radio :value="2">超清</el-radio>
        </el-radio-group>
      </div>

      <div class="opt-row">
        <span class="lbl">页码范围</span>
        <el-input v-model="rangeText" placeholder="留空=全部，如 1-5 或 1,3,5" />
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
        <el-button type="primary" :loading="loading" :disabled="!outDir" @click="doExport">
          导出图片
        </el-button>
        <span v-if="progress" class="tip">{{ progress }}</span>
      </div>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import FileDropZone from './FileDropZone.vue';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import { loadPdf, renderPageToImage } from '../composables/usePdfjs';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfFileItem, PdfActionResult } from '../types';

const store = usePdfTools();
const file = ref<PdfFileItem | null>(null);
const pageCount = ref(0);
const format = ref<'png' | 'jpg'>('png');
const scale = ref<number>(1.5);
const rangeText = ref('');
const outDir = ref('');
const result = ref<PdfActionResult | null>(null);
const progress = ref('');
const loading = ref(false);

function parsePages(total: number): number[] {
  const txt = rangeText.value.trim();
  if (!txt) return Array.from({ length: total }, (_, i) => i);
  const out = new Set<number>();
  for (const part of txt.split(',')) {
    const seg = part.trim();
    const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let s = Math.max(1, parseInt(m[1], 10));
      let e = Math.min(total, parseInt(m[2], 10));
      for (let i = s; i <= e; i++) out.add(i - 1);
    } else {
      const single = seg.match(/^(\d+)$/);
      if (single) {
        const n = parseInt(single[1], 10);
        if (n >= 1 && n <= total) out.add(n - 1);
      }
    }
  }
  return [...out].sort((a, b) => a - b);
}

async function onSelect(paths: string[]): Promise<void> {
  if (!paths.length) return;
  result.value = null;
  try {
    const res = await (window as any).ipcRenderer.ebook.readFileBytes(paths[0]);
    if (!res || !res.base64) {
      ElMessage.error('读取文件失败');
      return;
    }
    const pdf: any = await loadPdf(res.base64);
    file.value = { path: paths[0], name: paths[0].replace(/^.*[\\/]/, ''), pages: pdf.numPages };
    pageCount.value = pdf.numPages;
    pdf.destroy();
  } catch (e) {
    ElMessage.error('PDF 解析失败：' + String(e));
  }
}

async function pickDir(): Promise<void> {
  const res = await pdfApi.pickDir();
  if (res.success && res.dir) outDir.value = res.dir;
}

async function doExport(): Promise<void> {
  result.value = null;
  if (!file.value || !outDir.value) return;
  const idxs = parsePages(pageCount.value);
  if (!idxs.length) {
    ElMessage.warning('没有匹配的页码');
    return;
  }
  loading.value = true;
  try {
    const res = await (window as any).ipcRenderer.ebook.readFileBytes(file.value.path);
    const pdf: any = await loadPdf(res.base64);
    const ext = format.value === 'jpg' ? 'jpg' : 'png';
    const fmt = format.value === 'jpg' ? 'image/jpeg' : 'image/png';
    const files: { name: string; base64: string }[] = [];
    const baseW = 900 * scale.value;
    for (let i = 0; i < idxs.length; i++) {
      const page = await pdf.getPage(idxs[i] + 1);
      const url = await renderPageToImage(page, baseW, fmt);
      files.push({ name: `page_${String(idxs[i] + 1).padStart(4, '0')}.${ext}`, base64: url });
      progress.value = `已导出 ${i + 1}/${idxs.length}`;
    }
    pdf.destroy();
    const w = await pdfApi.writeFiles(outDir.value, files);
    result.value = w;
    if (w.success) store.pushOutput(outDir.value);
  } catch (e) {
    result.value = { success: false, error: String(e) };
  } finally {
    loading.value = false;
    progress.value = '';
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
  max-width: 280px;
}
.pc {
  color: var(--text-muted);
  font-size: 12px;
}
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
.actions {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.tip {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
