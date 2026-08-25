// 原子组件：扫描选项（深度 / 大小写 / 仅文件 / 仅目录）
<script setup lang="ts">
import type { ScanOptionsState } from './types';

const options = defineModel<ScanOptionsState>({ required: true });
</script>

<template>
  <div class="scan-options">
    <div class="opt-item">
      <span class="opt-lbl">扫描深度</span>
      <el-input v-model.number="options.deep" type="number" placeholder="0=无限" class="opt-input" />
    </div>
    <div class="opt-item">
      <span class="opt-lbl">大小写敏感</span>
      <el-switch v-model="options.caseSensitiveMatch" />
    </div>
    <div class="opt-item">
      <span class="opt-lbl">仅文件</span>
      <el-switch v-model="options.onlyFiles" />
    </div>
    <div class="opt-item">
      <span class="opt-lbl">仅目录</span>
      <el-switch v-model="options.onlyDirectories" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.scan-options {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
}
.opt-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.opt-lbl {
  font-size: 13px;
  color: var(--text-secondary);
}
.opt-input {
  width: 120px;
}
</style>
