<template>
  <div class="rule-block">
    <div class="rule-title">
      <el-switch v-model="model.enabled" size="small" />
      <span>按文件日期命名</span>
    </div>
    <div class="rule-body" :class="{ disabled: !model.enabled }">
      <el-select v-model="model.mode" :disabled="!model.enabled" size="small" class="rule-input">
        <el-option label="修改时间" value="mtime" />
        <el-option label="创建时间" value="ctime" />
      </el-select>
      <el-select
        v-model="model.format"
        :disabled="!model.enabled"
        size="small"
        class="rule-input"
        filterable
        allow-create
        placeholder="时间格式"
      >
        <!-- 常用（横线/紧凑） -->
        <el-option label="2026-08-25" value="YYYY-MM-DD" />
        <el-option label="2026-08-25 14:30:00" value="YYYY-MM-DD HH:mm:ss" />
        <el-option label="20260825_143000" value="YYYYMMDD_HHmmss" />
        <el-option label="2026-08-25_14-30-00" value="YYYY-MM-DD_HH-mm-ss" />
        <el-option label="20260825" value="YYYYMMDD" />
        <!-- 中文年月日 -->
        <el-option label="2026年08月25日" value="YYYY年MM月DD日" />
        <el-option label="2026年08月25日14时30分00秒" value="YYYY年MM月DD日HH时mm分ss秒" />
        <el-option label="26年08月25日" value="YY年MM月DD日" />
        <el-option label="2026年08月" value="YYYY年MM月" />
        <el-option label="08月25日" value="MM月DD日" />
      </el-select>
      <el-select v-model="model.pos" :disabled="!model.enabled" size="small" class="mini-select">
        <el-option label="日期在前" value="prefix" />
        <el-option label="日期在后" value="suffix" />
      </el-select>
      <el-input v-model="model.sep" :disabled="!model.enabled" size="small" class="mini-input" placeholder="分隔符" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DateRule } from '../types';

// 双向绑定规则对象（父组件传入 rules.date）
const model = defineModel<DateRule>({ required: true });
</script>
