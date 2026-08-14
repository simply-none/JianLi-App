<template>
  <el-drawer
    v-model="visible"
    title="目录"
    direction="ltr"
    size="300px"
    :append-to-body="false"
  >
    <div class="toc-list">
      <div
        v-for="(item, index) in flattenedToc"
        :key="item.href + index"
        class="toc-item"
        :style="{ paddingLeft: 12 + item.depth * 16 + 'px' }"
        @click="onSelect(item)"
      >
        {{ item.label }}
      </div>
      <div v-if="flattenedToc.length === 0" class="toc-empty">
        暂无目录
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TocItem, FlatTocItem } from '../types';

const props = defineProps<{
  /** 抽屉可见性（v-model） */
  modelValue: boolean;
  /** 原始目录树（由阅读组件回传） */
  items: TocItem[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'select', item: FlatTocItem): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

/** 将多级目录树扁平化，并标注每层深度用于缩进 */
const flattenedToc = computed<FlatTocItem[]>(() => {
  const flatten = (items: TocItem[], depth = 0): FlatTocItem[] => {
    const result: FlatTocItem[] = [];
    for (const item of items) {
      result.push({ ...item, depth });
      if (item.subitems?.length) {
        result.push(...flatten(item.subitems, depth + 1));
      }
    }
    return result;
  };
  return flatten(props.items || []);
});

function onSelect(item: FlatTocItem) {
  emit('select', item);
}
</script>

<style scoped lang="scss">
.toc-list {
  padding: 8px 0;

  .toc-item {
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background-color 0.2s;

    &:hover {
      background: var(--bg-base);
      color: var(--color-primary);
    }
  }

  .toc-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
}
</style>
