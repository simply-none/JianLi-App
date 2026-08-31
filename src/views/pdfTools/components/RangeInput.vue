<template>
  <!-- 页码范围输入（tag 式）：输入回车即生成下方 tag，可点 × 删除；支持多范围、单页、逗号分隔 -->
  <div class="range-input-wrap">
    <div v-if="modelValue.length" class="tags">
      <span v-for="(t, i) in modelValue" :key="i" class="tag">
        {{ t }}
        <LucideIcon name="X" :size="12" class="tag-x" @click="removeTag(i)" />
      </span>
    </div>
    <el-input
      v-model="input"
      class="range-input"
      :placeholder="placeholder || '输入范围回车添加，如 1-3、5、8-10'"
      @keydown.enter.prevent="add"
    >
      <template #append>
        <el-button @click="add">添加</el-button>
      </template>
    </el-input>
    <span v-if="hint" class="hint">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { isValidRangeSeg } from '../utils/pageRange';

const props = defineProps<{
  modelValue: string[];
  placeholder?: string;
  hint?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const input = ref('');

/** 回车/点击「添加」：解析输入（支持逗号/中文逗号分隔多个），合法者入 tag，非法提示 */
function add(): void {
  const raw = input.value.trim();
  if (!raw) return;
  const segs = raw.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
  const ok: string[] = [];
  const bad: string[] = [];
  for (const seg of segs) {
    if (isValidRangeSeg(seg)) ok.push(seg);
    else bad.push(seg);
  }
  if (ok.length) {
    const set = new Set(props.modelValue);
    ok.forEach((t) => set.add(t));
    emit('update:modelValue', [...set]);
  }
  if (bad.length) ElMessage.warning(`忽略无效范围：${bad.join('、')}`);
  input.value = '';
}

function removeTag(i: number): void {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i));
}
</script>

<style scoped>
.range-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1.6;
}
.tag-x {
  cursor: pointer;
  opacity: 0.7;
}
.tag-x:hover {
  color: var(--color-error);
  opacity: 1;
}
.hint {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
