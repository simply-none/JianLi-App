<template>
  <div class="secret-input">
    <input
      :value="modelValue"
      class="secret-input__field"
      :class="{ 'is-invalid': showError && !valid }"
      type="text"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      @input="onInput"
    />
    <span v-if="showError && modelValue" class="secret-input__status" :class="valid ? 'ok' : 'bad'">
      <LucideIcon :name="valid ? 'CircleCheck' : 'CircleX'" :size="16" />
      {{ valid ? '密钥格式正确' : '需为合法 base32（A-Z, 2-7）' }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * 密钥输入框（base32 实时校验）
 * 仅做格式校验与清洗提示；密钥只在用户确认添加时经 IPC 传给主进程，不在此组件落存。
 */
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { isValidBase32 } from '../utils/otpauth';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    showError?: boolean;
  }>(),
  { placeholder: '例如：JBSWY3DPEHPK3PXP', showError: true },
);

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const valid = computed(() => isValidBase32(props.modelValue || ''));

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>

<style scoped lang="scss">
.secret-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.secret-input__field {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  letter-spacing: 0.5px;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  outline: none;
  transition: border-color 0.15s;
  &:focus {
    border-color: var(--color-primary);
  }
  &.is-invalid {
    border-color: var(--color-error, #e11d48);
  }
}
.secret-input__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  &.ok {
    color: var(--color-success, #16a34a);
  }
  &.bad {
    color: var(--color-error, #e11d48);
  }
}
</style>
