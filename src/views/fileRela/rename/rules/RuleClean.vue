<template>
  <div class="rule-block">
    <div class="rule-title">
      <el-switch v-model="model.enabled" size="small" />
      <span>字符清理</span>
    </div>
    <div class="rule-body col" :class="{ disabled: !model.enabled }">
      <el-checkbox :model-value="isOn('removeSpaces')" @change="(v: any) => toggleOp('removeSpaces', v)" :disabled="!model.enabled" border size="small">去除空格</el-checkbox>
      <el-checkbox :model-value="isOn('spaceToUnderscore')" @change="(v: any) => toggleOp('spaceToUnderscore', v)" :disabled="!model.enabled" border size="small">空格转下划线</el-checkbox>
      <el-checkbox :model-value="isOn('removeDigits')" @change="(v: any) => toggleOp('removeDigits', v)" :disabled="!model.enabled" border size="small">去除数字</el-checkbox>
      <el-checkbox :model-value="isOn('removeBrackets')" @change="(v: any) => toggleOp('removeBrackets', v)" :disabled="!model.enabled" border size="small">去括号及内容</el-checkbox>
      <div class="specified-row">
        <el-checkbox :model-value="isOn('removeSpecified')" @change="(v: any) => toggleOp('removeSpecified', v)" :disabled="!model.enabled" border size="small">去除指定字符</el-checkbox>
        <el-input
          v-model="model.specified"
          :disabled="!model.enabled || !isOn('removeSpecified')"
          size="small"
          class="specified-input"
          placeholder="如 @#%"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CleanRule } from '../types';

const model = defineModel<CleanRule>({ required: true });

// ops 是 string[]，checkbox 直接用 :model-value + @change 切换数组成员身份，
// 避免「对 computed 返回对象赋值属性不触发 setter」的陷阱（此前点击无反应的根因）
const OP_KEYS = ['removeSpaces', 'spaceToUnderscore', 'removeDigits', 'removeBrackets', 'removeSpecified'] as const;
type OpKey = (typeof OP_KEYS)[number];

function isOn(key: OpKey): boolean {
  return model.value.ops.includes(key);
}
function toggleOp(key: OpKey, val: any) {
  const on = !!val;
  const arr = model.value.ops;
  const has = arr.includes(key);
  if (on && !has) arr.push(key);
  else if (!on && has) {
    const i = arr.indexOf(key);
    if (i >= 0) arr.splice(i, 1);
  }
}
</script>
