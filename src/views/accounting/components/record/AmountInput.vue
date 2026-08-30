<!--
 * 记账 - 便捷金额输入框
 * 仅允许数字与小数点（最多两位），回车即触发 confirm（便捷记账：回车保存）。
 * 完整页与小窗口共用；compact 模式字号更小。
-->
<template>
  <div class="amount-input" :class="{ compact }">
    <span class="currency">¥</span>
    <input
      ref="inputRef"
      class="amount-field"
      inputmode="decimal"
      :value="modelValue"
      :placeholder="placeholder"
      @input="onInput"
      @keyup.enter="onEnter"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    placeholder?: string
    autofocus?: boolean
    compact?: boolean
  }>(),
  { modelValue: '', placeholder: '0.00', autofocus: false, compact: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  confirm: []
}>()

const inputRef = ref<HTMLInputElement>()

/** 输入过滤：仅数字 + 单个小数点 + 两位小数 */
function onInput(e: Event) {
  let v = (e.target as HTMLInputElement).value
  v = v.replace(/[^\d.]/g, '')
  const parts = v.split('.')
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
  if (parts[1]?.length > 2) v = parts[0] + '.' + parts[1].slice(0, 2)
  emit('update:modelValue', v)
}

function onEnter() {
  emit('confirm')
}

onMounted(() => {
  if (props.autofocus) nextTick(() => inputRef.value?.focus())
})
</script>

<style scoped lang="scss">
.amount-input {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #e4e7ed);
  border-radius: 10px;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--color-primary, #409eff);
  }

  .currency {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-primary, #409eff);
  }

  .amount-field {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary, #303133);
    font-variant-numeric: tabular-nums;

    &::placeholder {
      color: var(--text-muted, #bbb);
      font-weight: 400;
    }
  }

  &.compact {
    padding: 6px 10px;

    .currency {
      font-size: 16px;
    }
    .amount-field {
      font-size: 22px;
    }
  }
}
</style>
