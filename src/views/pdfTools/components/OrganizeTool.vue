<template>
  <div class="tool-panel">
    <FileDropZone @select="onSelect" />

    <div v-if="file" class="org-body">
      <div class="org-head">
        <div class="sel-file">
          <LucideIcon name="FileText" :size="15" class="ficon" />
          <span class="fname" :title="file.path">{{ file.name }}</span>
          <span class="pc">共 {{ pages.length }} 页</span>
        </div>
        <div class="batch-ops" v-if="pages.length">
          <el-button size="small" :disabled="!selected.size" @click="rotateSelected">旋转选中</el-button>
          <el-button size="small" :disabled="!selected.size" @click="deleteSelected">删除选中</el-button>
          <span class="sel-count">已选 {{ selected.size }} 页</span>
        </div>
      </div>

      <ThumbnailGrid
        :doc="doc"
        :pages="pages"
        :selected="selected"
        @toggle="toggle"
        @rotate="rotateOne"
        @remove="removeOne"
        @reorder="reorder"
      />

      <div class="actions">
        <el-button type="primary" :loading="loading" :disabled="!pages.length" @click="save(false)">
          应用并保存（重排/删除/旋转）
        </el-button>
        <el-button :loading="loading" :disabled="!selected.size" @click="save(true)">
          仅提取选中为文件
        </el-button>
      </div>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import FileDropZone from './FileDropZone.vue';
import ThumbnailGrid from './ThumbnailGrid.vue';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import { loadPdf } from '../composables/usePdfjs';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfFileItem, PdfActionResult, OrganizePageState } from '../types';

const store = usePdfTools();
const file = ref<PdfFileItem | null>(null);
const doc = ref<any>(null);
const pages = ref<OrganizePageState[]>([]);
const selected = ref<Set<number>>(new Set());
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

function onSelect(paths: string[]): void {
  if (!paths.length) return;
  load(paths[0]);
}

async function load(path: string): Promise<void> {
  result.value = null;
  selected.value.clear();
  try {
    const res = await (window as any).ipcRenderer.ebook.readFileBytes(path);
    if (!res || !res.base64) {
      ElMessage.error('读取文件失败');
      return;
    }
    const pdf: any = await loadPdf(res.base64);
    doc.value = pdf;
    file.value = { path, name: path.replace(/^.*[\\/]/, ''), pages: pdf.numPages };
    pages.value = Array.from({ length: pdf.numPages }, (_, i) => ({
      srcIndex: i,
      rotation: 0,
      kept: true,
    }));
  } catch (e) {
    console.error(e);
    ElMessage.error('PDF 解析失败：' + String(e));
  }
}

function toggle(srcIndex: number): void {
  const s = new Set(selected.value);
  if (s.has(srcIndex)) s.delete(srcIndex);
  else s.add(srcIndex);
  selected.value = s;
}
function rotateOne(srcIndex: number): void {
  const p = pages.value.find((x) => x.srcIndex === srcIndex);
  if (p) p.rotation = (p.rotation + 90) % 360;
}
function removeOne(srcIndex: number): void {
  pages.value = pages.value.filter((x) => x.srcIndex !== srcIndex);
  const s = new Set(selected.value);
  s.delete(srcIndex);
  selected.value = s;
}
function rotateSelected(): void {
  pages.value.forEach((p) => {
    if (selected.value.has(p.srcIndex)) p.rotation = (p.rotation + 90) % 360;
  });
}
function deleteSelected(): void {
  const keep = new Set(selected.value);
  pages.value = pages.value.filter((x) => !keep.has(x.srcIndex));
  selected.value = new Set();
}
function reorder({ from, to }: { from: number; to: number }): void {
  const arr = pages.value;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
}

function buildPageMap(onlySelected: boolean): { index: number; rotation?: number }[] {
  const list = onlySelected ? pages.value.filter((p) => selected.value.has(p.srcIndex)) : pages.value;
  return list.map((p) => ({ index: p.srcIndex, rotation: p.rotation || undefined }));
}

async function save(onlySelected: boolean): Promise<void> {
  result.value = null;
  if (!file.value) return;
  const pageMap = buildPageMap(onlySelected);
  if (!pageMap.length) {
    ElMessage.warning('没有可导出的页面');
    return;
  }
  const base = file.value.name.replace(/\.pdf$/i, '') + (onlySelected ? '_提取' : '_整理');
  const save = await pdfApi.pickSave(`${base}.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.organize(file.value.path, save.filePath, pageMap);
    result.value = res;
    if (res.success && res.outputPath) store.pushOutput(res.outputPath);
  } finally {
    loading.value = false;
  }
}

onBeforeUnmount(() => {
  doc.value?.destroy();
});
</script>

<style scoped>
.tool-panel {
  display: flex;
  flex-direction: column;
}
.org-head {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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
.batch-ops {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sel-count {
  color: var(--text-muted);
  font-size: 12px;
}
.actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
</style>
