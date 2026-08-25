// 原子组件：单组「含/不含」标签输入
// UI 与逻辑对齐「文件转移」：含/不含 radio 决定输入框新增关键字落到哪个桶；
// 空列表不渲染整行（与 fileTransfer.vue 一致）。
<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  title: string;          // 名称 / 类型 / 文件夹
  include: string[];
  exclude: string[];
  phInclude?: string;     // 输入框占位（含模式）
  defaultMode?: 'include' | 'exclude'; // 默认落到含/不含（转移页：名称/类型=include，文件夹=exclude）
}>();

const emit = defineEmits<{
  'update:include': [string[]];
  'update:exclude': [string[]];
}>();

// 含/不含切换：决定输入框新增关键字落到哪个桶（与文件转移一致）
const mode = ref<'include' | 'exclude'>(props.defaultMode || 'include');
const kw = ref('');

function target(): { list: string[]; set: (v: string[]) => void } {
  return mode.value === 'include'
    ? { list: props.include, set: (v) => emit('update:include', v) }
    : { list: props.exclude, set: (v) => emit('update:exclude', v) };
}

function addTag() {
  const v = kw.value.trim();
  if (!v) return;
  const t = target();
  if (!t.list.includes(v)) t.set([...t.list, v]);
  kw.value = '';
}

function removeInclude(i: number) {
  const arr = [...props.include];
  arr.splice(i, 1);
  emit('update:include', arr);
}

function removeExclude(i: number) {
  const arr = [...props.exclude];
  arr.splice(i, 1);
  emit('update:exclude', arr);
}
</script>

<template>
  <div class="rule-group">
    <div class="filter-row">
      <span class="filter-label">{{ title }}</span>
      <el-radio-group v-model="mode" class="radio-group">
        <el-radio value="include">含</el-radio>
        <el-radio value="exclude">不含</el-radio>
      </el-radio-group>
      <el-input
        v-model="kw"
        class="filter-input"
        :placeholder="phInclude || ('输入' + title + '关键字，回车添加')"
        @keyup.enter="addTag"
      >
        <template #append><el-button @click="addTag">添加</el-button></template>
      </el-input>
    </div>
    <div class="tag-list">
      <div class="tag-line" v-if="include.length">
        <span class="tag-prefix include-prefix">{{ title }}包含：</span>
        <el-tag
          v-for="(t, i) in include"
          :key="'i' + i"
          type="success"
          closable
          @close="removeInclude(i)"
        >{{ t }}</el-tag>
      </div>
      <div class="tag-line" v-if="exclude.length">
        <span class="tag-prefix exclude-prefix">{{ title }}不包含：</span>
        <el-tag
          v-for="(t, i) in exclude"
          :key="'e' + i"
          type="danger"
          closable
          @close="removeExclude(i)"
        >{{ t }}</el-tag>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rule-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

// 以下样式与 fileTransfer.vue 的筛选区保持一致
.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  width: 40px;
}

.radio-group {
  display: flex;
  gap: 16px;
}

.filter-input {
  flex: 1;
  max-width: 320px;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
}

.tag-prefix {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.include-prefix {
  color: #18a058;
}

.exclude-prefix {
  color: #d03050;
}
</style>
