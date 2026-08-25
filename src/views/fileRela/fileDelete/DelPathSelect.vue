// 原子组件：目标文件夹选择
<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue';
import { sendSync } from '@/utils/common';

const path = defineModel<string>({ required: true });

function select() {
  const res = sendSync('get-file-list', 'select-dir') as string[] | undefined;
  if (res && res[0]) path.value = res[0];
}
</script>

<template>
  <div class="del-path">
    <div class="path-label">目标文件夹</div>
    <el-input :model-value="path" disabled :title="path" placeholder="请选择要删除的文件夹">
      <template #append>
        <el-button @click="select" class="path-btn">
          <el-icon><LucideIcon name="Folder" /></el-icon>
          选择目录
        </el-button>
      </template>
    </el-input>
  </div>
</template>

<style scoped lang="scss">
.path-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.path-btn {
  padding: 0 12px;
}
</style>
