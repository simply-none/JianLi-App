<template>
  <el-drawer
    v-model="visible"
    title="书签"
    direction="ltr"
    size="320px"
    :append-to-body="false"
  >
    <div class="bookmark-drawer">
      <div class="bookmark-hint">
        点击书签跳转，右侧可删除。当前阅读位置可在底部「书签」按钮快速添加。
      </div>
      <div class="bookmark-list">
        <div
          v-for="item in items"
          :key="item.id"
          class="bookmark-item"
          :class="{ active: item.cfi === currentCfi }"
          @click="onJump(item)"
        >
          <div class="bookmark-main">
            <div class="bookmark-label">{{ item.label || '未命名书签' }}</div>
            <div class="bookmark-meta">进度 {{ Math.round(item.percent) }}%</div>
          </div>
          <div class="bookmark-actions">
            <el-button size="small" text @click.stop="onDelete(item)">
              <LucideIcon name="Trash2" :size="13" />
            </el-button>
          </div>
        </div>
        <div v-if="items.length === 0" class="bookmark-empty">
          暂无书签
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

const props = defineProps<{
  /** 抽屉可见性（v-model） */
  modelValue: boolean;
  /** 书签列表（按阅读顺序升序） */
  items: BookmarkRecord[];
  /** 当前阅读位置的 cfi，用于高亮当前书签 */
  currentCfi?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'jump', item: BookmarkRecord): void;
  (e: 'delete', item: BookmarkRecord): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

/** 点击书签：通知父组件跳转（父组件负责关闭抽屉） */
function onJump(item: BookmarkRecord) {
  emit('jump', item);
}

/** 点击删除：通知父组件执行删除 */
function onDelete(item: BookmarkRecord) {
  emit('delete', item);
}
</script>

<style scoped lang="scss">
.bookmark-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;

  .bookmark-hint {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
    padding: 0 4px 12px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 8px;
  }
}

.bookmark-list {
  flex: 1;
  overflow: auto;
  padding: 8px 0;

  .bookmark-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--radius-card, 6px);
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: var(--bg-hover, var(--bg-base));
    }

    &.active {
      background: var(--color-primary);
      .bookmark-label,
      .bookmark-meta {
        color: #fff;
      }
    }

    .bookmark-main {
      min-width: 0;
    }

    .bookmark-label {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bookmark-meta {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
    }

    .bookmark-actions {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
  }

  .bookmark-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
}
</style>
