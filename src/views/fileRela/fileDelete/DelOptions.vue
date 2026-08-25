// 原子组件：删除选项（遍历子目录 + 处理方式：回收站/永久删除）
<script setup lang="ts">
import type { DeleteFilter } from './types';

const filter = defineModel<DeleteFilter>({ required: true });
</script>

<template>
  <div class="del-options">
    <el-checkbox v-model="filter.recursive">遍历子目录（保留结构）</el-checkbox>

    <div class="opt-method">
      <span class="opt-label">处理方式</span>
      <el-radio-group v-model="filter.recycleBin" class="radio-group">
        <el-radio :value="true">移入回收站（可恢复）</el-radio>
        <el-radio :value="false">永久删除</el-radio>
      </el-radio-group>
    </div>
  </div>
</template>

<style scoped lang="scss">
.del-options {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.opt-method {
  display: flex;
  align-items: center;
  gap: 12px;
}

.opt-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}
</style>
