<template>
  <div class="tag-form-block">
    <!-- 标签名称：独占一行，宽度充足，不再被颜色/按钮挤压 -->
    <el-input
      v-model="name"
      size="small"
      :placeholder="placeholder"
      maxlength="20"
      @keyup.enter="submit"
    />
    <!-- 颜色选择：独占一行（预设色点 + 自定义取色） -->
    <div class="form-color-row">
      <TagColorPicker v-model="color" />
      <span class="form-color-hint">选择标签颜色（含自定义）</span>
    </div>
    <!-- 操作按钮：独占一行，两端对齐 -->
    <div class="form-actions">
      <el-button size="small" @click="cancel">取消</el-button>
      <el-button type="primary" size="small" @click="submit">{{ confirmText }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import TagColorPicker from './TagColorPicker.vue';
import { TAG_COLORS } from '../types';

const props = withDefaults(
  defineProps<{
    /** create=新建标签，edit=修改标签（共用同一视图） */
    mode?: 'create' | 'edit';
    initialName?: string;
    initialColor?: string;
  }>(),
  { mode: 'create', initialName: '', initialColor: TAG_COLORS[0] }
);

const emit = defineEmits<{
  (e: 'submit', payload: { name: string; color: string }): void;
  (e: 'cancel'): void;
}>();

const name = ref(props.initialName);
const color = ref(props.initialColor);

// 外部重置初始值时（如切换要编辑的标签）同步内部状态
watch(
  () => [props.initialName, props.initialColor],
  ([n, c]) => {
    name.value = (n as string) || '';
    color.value = (c as string) || TAG_COLORS[0];
  }
);

const placeholder = computed(() => (props.mode === 'edit' ? '标签名称' : '新标签名称'));
const confirmText = computed(() => (props.mode === 'edit' ? '保存' : '添加标签'));

function submit() {
  emit('submit', { name: name.value.trim(), color: color.value });
}
function cancel() {
  emit('cancel');
}
</script>

<style scoped lang="scss">
.tag-form-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;

  .form-color-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .form-color-hint {
      font-size: 12px;
      color: var(--text-muted);
    }
  }

  .form-actions {
    display: flex;
    gap: 8px;

    .el-button {
      flex: 1;
    }
  }
}
</style>
