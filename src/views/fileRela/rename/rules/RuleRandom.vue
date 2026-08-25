<template>
  <div class="rule-block">
    <div class="rule-title">
      <el-switch v-model="model.enabled" size="small" />
      <span>随机命名</span>
    </div>
    <div class="rule-body" :class="{ disabled: !model.enabled }">
      <el-select v-model="model.kind" :disabled="!model.enabled" size="small" class="rule-input">
        <el-option label="UUID v4" value="uuid" />
        <el-option label="字母+数字" value="alnum" />
        <el-option label="仅字母" value="alpha" />
        <el-option label="仅数字" value="digit" />
      </el-select>
      <label v-if="model.kind !== 'uuid'" class="mini-label">
        长度
        <el-input v-model.number="model.length" :disabled="!model.enabled" size="small" class="mini-input" type="number" />
      </label>
      <el-select v-model="model.pos" :disabled="!model.enabled" size="small" class="mini-select">
        <el-option label="随机在前" value="prefix" />
        <el-option label="随机在后" value="suffix" />
      </el-select>
      <el-input v-model="model.sep" :disabled="!model.enabled" size="small" class="mini-input" placeholder="分隔符" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RandomRule } from '../types';

const model = defineModel<RandomRule>({ required: true });
</script>
