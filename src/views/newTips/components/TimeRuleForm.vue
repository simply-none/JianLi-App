<template>
  <div class="form-item">
    <span class="form-label">重复规则</span>
    <el-select v-model="form.repeat" class="form-select">
      <el-option label="每小时" value="hourly" />
      <el-option label="每天" value="daily" />
      <el-option label="每周" value="weekly" />
      <el-option label="每月" value="monthly" />
      <el-option label="每年" value="yearly" />
      <el-option label="仅一次" value="once" />
    </el-select>
  </div>

  <div class="form-item" v-if="form.repeat === 'hourly'">
    <span class="form-label">分钟</span>
    <el-input-number v-model="form.minute" :min="0" :max="59" class="form-number" />
  </div>

  <div class="form-item" v-if="form.repeat === 'monthly'">
    <span class="form-label">日期（几号）</span>
    <el-input-number v-model="form.dayOfMonth" :min="1" :max="31" class="form-number" />
  </div>

  <div class="form-item" v-if="form.repeat === 'yearly'">
    <span class="form-label">月份与日期</span>
    <div class="ymd-wrap">
      <el-input-number v-model="form.month" :min="1" :max="12" class="ymd-input" />
      <span class="ymd-sep">月</span>
      <el-input-number v-model="form.dayOfMonth" :min="1" :max="31" class="ymd-input" />
      <span class="ymd-sep">日</span>
    </div>
  </div>

  <div class="form-item" v-if="form.repeat === 'once'">
    <span class="form-label">日期</span>
    <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" class="form-select" />
  </div>

  <div class="form-item" v-if="form.repeat === 'weekly'">
    <span class="form-label">星期</span>
    <el-checkbox-group v-model="form.weekDays">
      <el-checkbox v-for="w in weekOptions" :key="w.value" :value="w.value" :label="w.label" />
    </el-checkbox-group>
  </div>

  <div class="form-item" v-if="form.repeat !== 'hourly'">
    <span class="form-label">时间</span>
    <el-time-picker v-model="form.time" format="HH:mm" value-format="HH:mm" placeholder="选择时间" class="form-select" />
  </div>
</template>

<script setup lang="ts">
import type { TipsReminder } from "../types";

defineProps<{ form: TipsReminder }>();

const weekOptions = [
  { label: "周日", value: 0 },
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
];
</script>

<style scoped lang="scss">
.form-select { width: 100%; }
.form-number { width: 160px; }
.ymd-wrap { display: flex; align-items: center; gap: 6px; }
.ymd-input { width: 110px; }
.ymd-sep { color: var(--el-text-color-secondary, #909399); }
</style>
