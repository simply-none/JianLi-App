<template>
  <div class="tool-panel">
    <el-alert type="warning" :closable="false" class="notice">
      <template #title>加密 / 解密当前为规划中</template>
      PDF 的权限加密与解密依赖外部引擎 <b>qpdf</b>，当前应用未内置该二进制能力。
      后续集成 qpdf 后即可在此提供「设置打开口令 / 权限口令」「移除口令」等功能。
    </el-alert>

    <div class="actions">
      <el-button :disabled="true" @click="doEncrypt">加密（规划中）</el-button>
      <el-button :disabled="true" @click="doDecrypt">解密（规划中）</el-button>
    </div>

    <PdfResultBar :result="result" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import PdfResultBar from './PdfResultBar.vue';
import { pdfApi } from '../api/pdfApi';
import type { PdfActionResult } from '../types';

const result = ref<PdfActionResult | null>(null);

// 后端诚实返回不可用提示；此处仅透传，保持 UI 一致性
async function doEncrypt(): Promise<void> {
  result.value = await pdfApi.encrypt();
  if (!result.value.success) ElMessage.warning(result.value.error || '暂不支持');
}
async function doDecrypt(): Promise<void> {
  result.value = await pdfApi.decrypt();
  if (!result.value.success) ElMessage.warning(result.value.error || '暂不支持');
}
</script>

<style scoped>
.tool-panel {
  display: flex;
  flex-direction: column;
}
.notice {
  margin-bottom: 16px;
}
.actions {
  display: flex;
  gap: 12px;
}
</style>
