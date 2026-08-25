<template>
  <div class="rule-block">
    <div class="rule-title">
      <el-switch v-model="model.enabled" size="small" />
      <span>按位置截取</span>
    </div>
    <div class="rule-body" :class="{ disabled: !model.enabled }">
      <el-select v-model="model.mode" :disabled="!model.enabled" size="small" class="rule-input">
        <el-option label="保留前 N 个字符" value="keepStart" />
        <el-option label="保留后 N 个字符" value="keepEnd" />
        <el-option label="删除前 N 个字符" value="removeStart" />
        <el-option label="删除后 N 个字符" value="removeEnd" />
      </el-select>
      <label class="mini-label">
        N
        <el-input v-model.number="model.n" :disabled="!model.enabled" size="small" class="mini-input" type="number" />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TrimRule } from '../types';

const model = defineModel<TrimRule>({ required: true });
</script>
