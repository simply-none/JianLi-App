<template>
  <!-- 快速面板中的条目（原子组件）：列表排版 / 图文网格排版两种形态 -->
  <div class="quick-item" :class="[`is-${layout}`, { 'is-active': active }]">
    <template v-if="layout === 'grid'">
      <div class="item-media">
        <img v-if="item.image" :src="item.image" class="media-image" alt="剪贴板图片" />
        <span v-else class="media-text">{{ preview }}</span>
      </div>
      <span class="item-time">{{ formatTime(item.create_time) }}</span>
    </template>

    <template v-else>
      <img v-if="item.image" :src="item.image" class="item-thumb" alt="剪贴板图片" />
      <span v-else class="item-text">{{ preview }}</span>
      <span class="item-time">{{ formatTime(item.create_time) }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatTime } from '../clipboard/utils/clipboardFormat'
import type { ClipboardItem } from '../clipboard/types'

const props = withDefaults(
  defineProps<{
    item: ClipboardItem
    active?: boolean
    /** 排版方式：list 单行列表，grid 图文网格 */
    layout?: 'list' | 'grid'
  }>(),
  { layout: 'list' }
)

// 面板只展示摘要：换行折叠为空格并截断（网格模式下多留一些字数，由 CSS 截断到三行）
const preview = computed(() => {
  const text = (props.item.text ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return '（无文本内容）'
  const max = props.layout === 'grid' ? 120 : 60
  return text.length > max ? text.slice(0, max) + '…' : text
})
</script>

<style scoped lang="scss">
.quick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition: background 0.15s ease;

  &.is-active {
    background: var(--color-primary-light);
  }

  .item-thumb {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-base);
  }

  .item-text {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-time {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-muted);
  }

  // —— 图文网格排版 ——
  &.is-grid {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 6px;

    .item-media {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 76px;
      overflow: hidden;
      border-radius: 8px;
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);

      .media-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .media-text {
        padding: 6px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--text-secondary);
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        word-break: break-word;
      }
    }

    .item-time {
      text-align: center;
    }
  }
}
</style>
