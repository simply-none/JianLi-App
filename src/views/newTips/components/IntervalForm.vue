<template>
  <div class="form-item">
    <span class="form-label">间隔</span>
    <div class="gap-input-wrap">
      <el-input v-model="form.interval" type="number" placeholder="请输入间隔数值" class="gap-input" />
      <el-select v-model="form.unit" class="gap-unit">
        <el-option v-for="u in unitOptions" :key="u.value" :label="u.label" :value="u.value" />
      </el-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TipsReminder } from "../types";

defineProps<{ form: TipsReminder }>();

const unitOptions = [
  { label: "秒", value: 1000 },
  { label: "分钟", value: 60 * 1000 },
  { label: "小时", value: 60 * 60 * 1000 },
];
</script>

<style scoped lang="scss">
.gap-input-wrap { display: flex; gap: 8px; }
.gap-input { flex: 1; }
.gap-unit { width: 120px; }
</style>
