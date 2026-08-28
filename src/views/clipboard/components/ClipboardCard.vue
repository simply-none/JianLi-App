<template>
  <!-- 单条剪贴板卡片（原子组件）：选中态 + 内容预览 + 复制/删除操作 -->
  <article class="clipboard-card" :class="{ 'is-selected': selected }">
    <span class="card-accent" />

    <header class="card-head">
      <button
        type="button"
        class="card-check"
        :class="{ 'is-checked': selected }"
        :aria-pressed="selected ? 'true' : 'false'"
        title="选择"
        @click.stop="$emit('toggle-select', item.id)"
      >
        <LucideIcon name="Check" :size="12" class="check-icon" />
      </button>

      <div class="card-meta">
        <span class="card-time" :title="formatFullTime(item.create_time)">
          {{ formatTime(item.create_time) }}
        </span>
        <span class="meta-sep">·</span>
        <span class="card-len">{{ countChars(item.text) }} 字</span>
      </div>

      <div class="card-actions">
        <button
          type="button"
          class="icon-btn"
          :class="{ 'is-done': copied }"
          :title="copied ? '已复制' : '复制'"
          @click.stop="onCopy"
        >
          <LucideIcon :name="copied ? 'Check' : 'Copy'" :size="14" />
        </button>
        <button type="button" class="icon-btn is-danger" title="删除" @click.stop="$emit('delete', item)">
          <LucideIcon name="Trash2" :size="14" />
        </button>
      </div>
    </header>

    <ClipboardCardContent :text="item.text" :keyword="keyword" />
  </article>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import ClipboardCardContent from './ClipboardCardContent.vue'
import { countChars, formatFullTime, formatTime } from '../utils/clipboardFormat'
import type { ClipboardItem } from '../types'

const props = defineProps<{
  item: ClipboardItem
  selected?: boolean
  /** 当前搜索关键词，透传给内容区做高亮 */
  keyword?: string
}>()

const emit = defineEmits<{
  (e: 'copy', text: string): void
  (e: 'delete', item: ClipboardItem): void
  (e: 'toggle-select', id?: number): void
}>()

// 复制成功后的短时反馈（图标切换为对勾），1.2s 后自动复位
const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

function onCopy() {
  emit('copy', props.item.text)
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
.clipboard-card {
  position: relative;
  padding: 12px 14px 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.18);
    transform: translateY(-1px);
  }

  // 选中态：主色描边 + 主色底纹 + 外圈光环
  &.is-selected {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  // 左侧类型色条：默认收起，hover/选中时展开
  .card-accent {
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--color-primary);
    opacity: 0;
    transform: scaleY(0.3);
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }

  &:hover .card-accent,
  &.is-selected .card-accent {
    opacity: 1;
    transform: scaleY(1);
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  // 自定义复选框：替掉原生 checkbox，样式跟随主题
  .card-check {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent;
    border: 1.5px solid var(--border-subtle);
    border-radius: 6px;
    color: transparent;
    cursor: pointer;
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;

    &:hover {
      border-color: var(--color-primary);
    }

    &.is-checked {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;
    }
  }

  .card-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);

    .card-time {
      cursor: default;
    }

    .meta-sep {
      opacity: 0.6;
    }

    .card-len {
      white-space: nowrap;
    }
  }

  .card-actions {
    flex-shrink: 0;
    display: flex;
    gap: 6px;
  }

  // 常显图标按钮：默认弱化，hover 时强化
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;

    &:hover {
      background: var(--bg-hover);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    &.is-danger:hover {
      background: var(--tag-bg-danger);
      border-color: var(--color-error);
      color: var(--color-error);
    }

    &.is-done {
      border-color: var(--color-success);
      color: var(--color-success);
    }
  }
}
</style>
