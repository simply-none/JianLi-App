<template>
  <div class="palette-empty">
    <template v-if="loading">
      <LucideIcon name="LoaderCircle" :size="22" class="palette-empty__icon is-spin" />
      <p>搜索中…</p>
    </template>

    <template v-else-if="query">
      <LucideIcon name="SearchX" :size="22" class="palette-empty__icon" />
      <p>没有匹配「{{ query }}」的结果</p>
      <p class="palette-empty__hint">试试 @ 只搜笔记，# 只搜待办，/ 只搜功能</p>
    </template>

    <template v-else>
      <LucideIcon name="Command" :size="22" class="palette-empty__icon" />
      <p>开始输入，或 ↑↓ 选择上面的推荐项</p>
      <p class="palette-empty__hint">@ 笔记 · # 待办 · / 功能</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'

defineProps<{
  loading: boolean
  query: string
}>()
</script>

<style scoped lang="scss">
.palette-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  text-align: center;
  color: var(--text-muted);

  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
  }

  &__icon {
    opacity: 0.5;
  }

  &__hint {
    font-size: 11px;
    opacity: 0.7;
  }

  .is-spin {
    animation: palette-spin 0.9s linear infinite;
  }
}

@keyframes palette-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
