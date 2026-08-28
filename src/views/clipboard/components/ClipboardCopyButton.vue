<template>
  <!-- 复制操作组（原子组件）：主按钮原样复制 + 箭头展开「纯文本复制」 -->
  <span class="copy-group" @click.stop>
    <button
      type="button"
      class="icon-btn"
      :class="{ 'is-done': copied }"
      :title="copied ? '已复制' : '复制'"
      @click="handleCopy('raw')"
    >
      <LucideIcon :name="copied ? 'Check' : 'Copy'" :size="14" />
    </button>

    <el-dropdown trigger="click" @command="handleCopy">
      <button type="button" class="icon-btn icon-btn-arrow" title="更多复制方式">
        <LucideIcon name="ChevronDown" :size="12" />
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="raw">原样复制</el-dropdown-item>
          <el-dropdown-item command="text" :disabled="!hasText">纯文本复制（去格式）</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { ClipboardCopyMode } from '../types'

defineProps<{
  /** 是否含纯文本内容：图片条目无文本，禁用纯文本复制 */
  hasText?: boolean
}>()

const emit = defineEmits<{
  (e: 'copy', mode: ClipboardCopyMode): void
}>()

// 复制成功后的短时反馈（图标切换为对勾），1.2s 后自动复位
const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

function handleCopy(mode: ClipboardCopyMode) {
  emit('copy', mode)
  copied.value = true
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copied.value = false
    resetTimer = null
  }, 1200)
}

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer)
})
</script>

<style scoped lang="scss">
.copy-group {
  display: inline-flex;
  align-items: stretch;

  // 主按钮与箭头按钮拼接成一组
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;
  }

  > .icon-btn {
    width: 30px;
    border-radius: 8px 0 0 8px;

    &:hover {
      background: var(--bg-hover);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    &.is-done {
      border-color: var(--color-success);
      color: var(--color-success);
    }
  }

  // 箭头按钮：单独使用时塌缩为窄条
  :deep(.icon-btn-arrow) {
    width: 16px;
    border-left: none;
    border-radius: 0 8px 8px 0;
    padding: 0 1px;

    &:hover {
      background: var(--bg-hover);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
  }
}
</style>
