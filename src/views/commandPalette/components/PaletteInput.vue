<template>
  <!-- 搜索行：图标 + 输入框 + 作用域徽标 + 清空按钮 -->
  <div class="palette-input">
    <LucideIcon name="Search" :size="15" class="search-icon" />

    <input
      ref="inputRef"
      :value="modelValue"
      class="palette-input__field"
      :placeholder="placeholder"
      spellcheck="false"
      autocomplete="off"
      @input="onInput"
    />

    <span v-if="scopeLabel" class="palette-input__scope">{{ scopeLabel }}</span>

    <button
      v-if="modelValue"
      type="button"
      class="palette-input__clear"
      title="清空"
      @click="onClear"
    >
      <LucideIcon name="X" :size="13" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { SCOPE_LABEL } from '../config/paletteConfig'

const props = defineProps<{
  modelValue: string
  /** 当前作用域前缀（'' 表示搜全部） */
  scope: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'clear'): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const scopeLabel = computed(() => (props.scope ? SCOPE_LABEL[props.scope] || '' : ''))

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onClear() {
  emit('clear')
  focus()
}

/** 供父组件在窗口重新显示时聚焦 */
function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<style scoped lang="scss">
.palette-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 40px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-base);
  flex-shrink: 0;

  .search-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  &__field {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 14px;
    // 输入框必须显式 no-drag，否则在拖拽区里点不动 / 拿不到焦点
    -webkit-app-region: no-drag;
    user-select: text;

    &::placeholder {
      color: var(--text-muted);
    }
  }

  &__scope {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: var(--radius-btn);
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-size: 11px;
    line-height: 16px;
  }

  &__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--bg-hover);
    color: var(--text-muted);
    cursor: pointer;
    -webkit-app-region: no-drag;

    &:hover {
      color: var(--color-error);
    }
  }
}
</style>
