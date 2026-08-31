<template>
  <div class="tool-panel">
    <p class="hint">双栏并排对比两份文档的页面排版。左为文档 A，右为文档 B；页数不一致时多出的部分以占位提示。</p>

    <div class="field two">
      <div>
        <label>文档 A</label>
        <PdfSourcePicker v-model:path="a" />
      </div>
      <div>
        <label>文档 B</label>
        <PdfSourcePicker v-model:path="b" />
      </div>
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!a || !b" @click="compare">开始对比</el-button>
      <span v-if="!a || !b" class="tip">请选择两份 PDF</span>
    </div>

    <div v-if="loading" class="scanning"><LucideIcon name="LoaderCircle" :size="15" class="spin" /> 正在渲染页面…</div>

    <div v-if="cols.a.length || cols.b.length" class="compare-grid">
      <div class="col">
        <div class="col-head">文档 A · {{ cols.a.length }} 页</div>
        <div v-for="(u, i) in cols.a" :key="'a' + i" class="pg">
          <div class="pg-no">第 {{ i + 1 }} 页</div>
          <img v-if="u" :src="u" class="pg-img" />
          <div v-else class="pg-ph">—</div>
        </div>
      </div>
      <div class="col">
        <div class="col-head">文档 B · {{ cols.b.length }} 页</div>
        <div v-for="(u, i) in cols.b" :key="'b' + i" class="pg">
          <div class="pg-no">第 {{ i + 1 }} 页</div>
          <img v-if="u" :src="u" class="pg-img" />
          <div v-else class="pg-ph">—</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import PdfSourcePicker from './PdfSourcePicker.vue';
import { loadPdf, renderPageToImage } from '../composables/usePdfjs';

const a = ref<string | null>(null);
const b = ref<string | null>(null);
const loading = ref(false);
const cols = reactive<{ a: string[]; b: string[] }>({ a: [], b: [] });

async function readBytes(path: string): Promise<string> {
  return (window as any).ipcRenderer.ebook.readFileBytes(path).then((r: any) => r.base64 as string);
}

async function renderDoc(path: string): Promise<string[]> {
  const base64 = await readBytes(path);
  const doc = await loadPdf(base64);
  const out: string[] = [];
  for (let i = 1; i <= (doc.numPages as number); i++) {
    try {
      const page = await doc.getPage(i);
      out.push(await renderPageToImage(page, 240));
    } catch {
      out.push('');
    }
  }
  doc.destroy?.();
  return out;
}

async function compare(): Promise<void> {
  if (!a.value || !b.value) {
    ElMessage.warning('请选择两份 PDF');
    return;
  }
  cols.a = [];
  cols.b = [];
  loading.value = true;
  try {
    const [ra, rb] = await Promise.all([renderDoc(a.value), renderDoc(b.value)]);
    cols.a = ra;
    cols.b = rb;
  } catch (e) {
    ElMessage.error('对比失败：' + String(e));
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
.field.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 12px;
}
.field label {
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 6px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tip {
  color: var(--text-muted);
  font-size: 12px;
}
.scanning {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  margin: 12px 0;
}
.spin {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.col-head {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  position: sticky;
  top: 0;
  background: var(--bg-base);
  padding-bottom: 6px;
  margin-bottom: 8px;
}
.pg {
  margin-bottom: 12px;
}
.pg-no {
  color: var(--text-muted);
  font-size: 12px;
  margin-bottom: 4px;
}
.pg-img {
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: #fff;
}
.pg-ph {
  height: 120px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  border: 1px dashed var(--border-subtle);
  border-radius: 6px;
}
</style>
