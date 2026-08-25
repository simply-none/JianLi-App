// 原子组件：扩展名包含（标签输入）
<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ modelValue: string[]; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [string[]] }>();

const kw = ref('');

function add() {
  const v = kw.value.trim().replace(/^\./, '').toLowerCase();
  if (!v) return;
  if (!props.modelValue.includes(v)) emit('update:modelValue', [...props.modelValue, v]);
  kw.value = '';
}

function remove(i: number) {
  const arr = [...props.modelValue];
  arr.splice(i, 1);
  emit('update:modelValue', arr);
}
</script>

<template>
  <div class="ext-input">
    <span class="lbl">扩展名</span>
    <div class="body">
      <el-input
        v-model="kw"
        :placeholder="placeholder || '如 png、jpg、mp4，回车添加'"
        @keyup.enter="add"
      >
        <template #append><el-button @click="add">添加</el-button></template>
      </el-input>
      <div class="tags" v-if="modelValue.length">
        <el-tag
          v-for="(t, i) in modelValue"
          :key="i"
          type="success"
          closable
          @close="remove(i)"
        >.{{ t }}</el-tag>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ext-input {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.lbl {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  width: 64px;
  padding-top: 8px;
}
.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
