// 原子组件：扫描位置选择
<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue';
import { sendSync } from '@/utils/common';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();

function select() {
  const res = sendSync('get-file-list', 'select-dir');
  if (Array.isArray(res) && res[0]) emit('update:modelValue', res[0]);
}
</script>

<template>
  <div class="scan-path">
    <span class="lbl">扫描位置</span>
    <el-input :model-value="modelValue" placeholder="请选择目录" disabled :title="modelValue">
      <template #append>
        <el-button @click="select">
          <el-icon><LucideIcon name="Folder" /></el-icon>
          选择目录
        </el-button>
      </template>
    </el-input>
  </div>
</template>

<style scoped lang="scss">
.scan-path {
  display: flex;
  align-items: center;
  gap: 12px;
}
.lbl {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  width: 64px;
}
</style>
