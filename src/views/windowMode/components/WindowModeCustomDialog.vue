<template>
  <!-- 自定义位置 / 尺寸 / 间隙弹窗（原子组件）：只负责收集数值，写入交给上层 -->
  <AppDialog
    :model-value="modelValue"
    :title="title"
    width="320px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="custom-form">
      <template v-if="type === 'position'">
        <label class="form-item">
          <span>X 坐标</span>
          <input v-model.number="form.x" type="number" placeholder="输入X坐标" />
        </label>
        <label class="form-item">
          <span>Y 坐标</span>
          <input v-model.number="form.y" type="number" placeholder="输入Y坐标" />
        </label>
      </template>

      <template v-else-if="type === 'size'">
        <label class="form-item">
          <span>宽度</span>
          <input v-model.number="form.width" type="number" placeholder="输入宽度" />
        </label>
        <label class="form-item">
          <span>高度</span>
          <input v-model.number="form.height" type="number" placeholder="输入高度" />
        </label>
      </template>

      <label v-else class="form-item">
        <span>间隙</span>
        <input v-model.number="form.gap" type="number" placeholder="输入间隙值" />
      </label>
    </div>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="submit">确定</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { CustomFieldType } from '../composables/useWindowModeSetting'

const props = defineProps<{
  modelValue: boolean
  /** 正在编辑的配置项 */
  type: CustomFieldType
  title: string
  /** 打开时的初始值（来自当前配置） */
  initial: { x: number; y: number; width: number; height: number; gap: number }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (
    e: 'confirm',
    payload: {
      type: CustomFieldType
      x: number
      y: number
      width: number
      height: number
      gap: number
    }
  ): void
}>()

const form = reactive({ x: 0, y: 0, width: 0, height: 0, gap: 30 })

// 每次打开都用当前配置重置表单
watch(
  () => props.modelValue,
  (val) => {
    if (val) Object.assign(form, props.initial)
  }
)

function close() {
  emit('update:modelValue', false)
}

function submit() {
  emit('confirm', { type: props.type, ...form })
}
</script>

<style scoped lang="scss">
.custom-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    font-size: 13px;
    color: var(--text-secondary);
  }

  input {
    padding: 8px 12px;
    border: 1px solid var(--input-border);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    background: var(--input-bg);
    color: var(--text-primary);

    &:focus {
      border-color: var(--input-border-focus);
    }
  }
}
</style>
