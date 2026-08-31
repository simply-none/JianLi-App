<template>
  <div class="tool-panel">
    <p class="hint">为页面添加页码、页眉或页脚文字（浅灰、居中于页边）。</p>

    <div class="field">
      <label>源 PDF</label>
      <PdfSourcePicker v-model:path="src" />
    </div>

    <!-- 页码 -->
    <el-divider content-position="left">页码</el-divider>
    <el-checkbox v-model="pn.on" label="添加页码" />
    <template v-if="pn.on">
      <div class="grid2">
        <div class="m-item">
          <label>位置</label>
          <el-select v-model="pn.position" size="default">
            <el-option label="底部居中" value="bottom-center" />
            <el-option label="右下角" value="bottom-right" />
            <el-option label="顶部居中" value="top-center" />
          </el-select>
        </div>
        <div class="m-item">
          <label>样式</label>
          <el-select v-model="pn.style" size="default">
            <el-option label="阿拉伯数字" value="arabic" />
            <el-option label="罗马数字" value="roman" />
            <el-option label="字母" value="letter" />
          </el-select>
        </div>
        <div class="m-item">
          <label>起始编号</label>
          <el-input-number v-model="pn.start" :min="0" />
        </div>
        <div class="m-item">
          <label>前缀</label>
          <el-input v-model="pn.prefix" placeholder="如 第" />
        </div>
        <div class="m-item">
          <label>后缀</label>
          <el-input v-model="pn.suffix" placeholder="如 页" />
        </div>
      </div>
    </template>

    <!-- 页眉 -->
    <el-divider content-position="left">页眉</el-divider>
    <el-checkbox v-model="header.on" label="添加页眉" />
    <div v-if="header.on" class="field" style="margin-top: 8px">
      <el-input v-model="header.text" placeholder="页眉文字" />
    </div>

    <!-- 页脚 -->
    <el-divider content-position="left">页脚</el-divider>
    <el-checkbox v-model="footer.on" label="添加页脚" />
    <div v-if="footer.on" class="field" style="margin-top: 8px">
      <el-input v-model="footer.text" placeholder="页脚文字" />
      <el-checkbox v-model="footer.divider" label="显示分隔线" style="margin-top: 8px" />
    </div>

    <div class="actions">
      <el-button type="primary" :loading="loading" :disabled="!src || !hasAny" @click="run">应用</el-button>
      <span v-if="src && !hasAny" class="tip">至少启用一项</span>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import PdfSourcePicker from './PdfSourcePicker.vue';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import { usePdfTools } from '../store/usePdfTools';
import type { PdfActionResult, DecorateOpts } from '../types';

const store = usePdfTools();
const src = ref<string | null>(null);
const pn = reactive({ on: true, position: 'bottom-center' as const, start: 1, style: 'arabic' as const, prefix: '', suffix: '' });
const header = reactive({ on: false, text: '' });
const footer = reactive({ on: false, text: '', divider: false });
const result = ref<PdfActionResult | null>(null);
const loading = ref(false);

const hasAny = computed(() => pn.on || header.on || footer.on);

function buildOpts(): DecorateOpts {
  const opts: DecorateOpts = {};
  if (pn.on) {
    opts.pageNumbers = {
      position: pn.position,
      start: pn.start,
      style: pn.style,
      prefix: pn.prefix || undefined,
      suffix: pn.suffix || undefined,
    };
  }
  if (header.on && header.text) opts.header = { text: header.text };
  if (footer.on && footer.text) opts.footer = { text: footer.text, divider: footer.divider };
  return opts;
}

async function run(): Promise<void> {
  result.value = null;
  if (!src.value) {
    ElMessage.warning('请先选择 PDF');
    return;
  }
  const base = (src.value || '').replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');
  const save = await pdfApi.pickSave(`${base}_装饰.pdf`);
  if (!save.success || !save.filePath) return;
  loading.value = true;
  try {
    const res = await pdfApi.decorate(src.value!, save.filePath, buildOpts());
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
  margin-top: 10px;
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
