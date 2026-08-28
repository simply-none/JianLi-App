// 原子组件：删除确认弹窗
// 回收站=普通确认；永久删除=额外二次确认（必勾选「不可恢复」才放行）。
<script setup lang="ts">
import { ref, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import type { DeletePlan } from './types';

const props = defineProps<{
  modelValue: boolean;
  plan: DeletePlan | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  confirm: [];
}>();

const ackPermanent = ref(false);

// 每次打开重置二次确认勾选
watch(
  () => props.modelValue,
  (v) => {
    if (v) ackPermanent.value = false;
  }
);

function formatSize(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return (i === 0 ? v : v.toFixed(1)) + ' ' + units[i];
}

function onConfirm() {
  emit('update:modelValue', false);
  emit('confirm');
}

function onCancel() {
  emit('update:modelValue', false);
}
</script>

<template>
  <app-dialog
    :model-value="modelValue"
    title="确认删除"
    width="460px"
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="confirm-body" v-if="plan">
      <div class="confirm-icon" :class="plan.recycleBin ? 'safe' : 'danger'">
        <el-icon><LucideIcon :name="plan.recycleBin ? 'Trash2' : 'CircleAlert'" /></el-icon>
      </div>

      <div class="confirm-text">
        <template v-if="plan.wholeFolder">
          将删除整个文件夹（含子目录）：<br />
          <code class="mono">{{ plan.folder }}</code>
        </template>
        <template v-else>
          将删除 <b>{{ plan.count }}</b> 个文件，约 <b>{{ formatSize(plan.size) }}</b>。
        </template>
      </div>

      <div v-if="plan.recycleBin" class="note info">
        <el-icon><LucideIcon name="Info" /></el-icon>
        将移入回收站，可在回收站中恢复。
      </div>
      <div v-else class="note danger">
        <el-icon><LucideIcon name="CircleAlert" /></el-icon>
        永久删除，不可恢复！请确认已备份重要文件。
      </div>

      <label v-if="!plan.recycleBin" class="ack">
        <el-checkbox v-model="ackPermanent" />
        我已确认执行永久删除，且了解该操作不可恢复
      </label>
    </div>

    <template #footer>
      <el-button @click="onCancel">取消</el-button>
      <el-button
        type="danger"
        :disabled="!plan || (!plan.recycleBin && !ackPermanent)"
        @click="onConfirm"
      >
        确认删除
      </el-button>
    </template>
  </app-dialog>
</template>

<style scoped lang="scss">
.confirm-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.confirm-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;

  &.safe {
    background: var(--el-color-success-light-9, #e8f7ee);
    color: var(--el-color-success, #18a058);
  }

  &.danger {
    background: var(--el-color-danger-light-9, #fdecec);
    color: var(--el-color-danger, #f56c6c);
  }
}

.confirm-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
}

.mono {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  word-break: break-all;
  color: var(--text-secondary);
}

.note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 6px;

  &.info {
    background: var(--el-color-info-light-9, #eef4fb);
    color: var(--el-color-info, #378add);
  }

  &.danger {
    background: var(--el-color-danger-light-9, #fdecec);
    color: var(--el-color-danger, #f56c6c);
  }
}

.ack {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
