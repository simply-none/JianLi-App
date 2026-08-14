<template>
  <el-drawer
    v-model="visible"
    title="目录"
    direction="ltr"
    size="300px"
    :append-to-body="false"
  >
    <div class="toc-drawer">
      <!-- 地标快捷区：封面 / 正文起点 / 目录等（epub landmarks），点击直达 -->
      <div v-if="landmarks && landmarks.length" class="toc-landmarks">
        <button
          v-for="(lm, i) in landmarks"
          :key="'lm-' + i"
          class="landmark-chip"
          type="button"
          @click="onSelect(lm)"
        >
          {{ lm.label }}
        </button>
      </div>

      <!-- 目录树：扁平化后按层级缩进展示，当前章节高亮 -->
      <div class="toc-list">
        <div
          v-for="(item, index) in flattenedToc"
          :key="item.href + index"
          class="toc-item"
          :class="{ active: isCurrent(item) }"
          :style="{ paddingLeft: 12 + item.depth * 16 + 'px' }"
          @click="onSelect(item)"
        >
          {{ item.label }}
        </div>
        <div v-if="flattenedToc.length === 0" class="toc-empty">
          暂无目录
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TocItem, FlatTocItem } from '../types';

/** 地标项（epub landmarks，如封面/正文起点/目录） */
interface LandmarkItem {
  /** 链接（href 或 cfi） */
  href: string;
  /** 显示文本 */
  label: string;
  /** 地标类型（cover / text / toc 等），可选 */
  type?: string;
}

const props = defineProps<{
  /** 抽屉可见性（v-model） */
  modelValue: boolean;
  /** 原始目录树（由阅读组件回传） */
  items: TocItem[];
  /** 地标项（封面/正文/目录等），可选 */
  landmarks?: LandmarkItem[];
  /** 当前阅读位置的 href，用于高亮当前章节 */
  currentHref?: string;
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

/** 判断目录项是否为当前所在章节（href 前缀匹配，忽略 #fragment） */
function isCurrent(item: FlatTocItem): boolean {
  const cur = props.currentHref;
  const href = item.href;
  if (!cur || !href) return false;
  if (cur === href) return true;
  const base = href.split('#')[0];
  if (!base) return false;
  return cur === base || cur.startsWith(base);
}

/** 点击目录项或地标：统一 emit select（父组件负责跳转并关闭抽屉） */
function onSelect(item: FlatTocItem | LandmarkItem) {
  emit('select', item as FlatTocItem);
}
</script>

<style scoped lang="scss">
.toc-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;

  /* 地标快捷区：封面/正文等，以 chip 形式横向排列 */
  .toc-landmarks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 4px 12px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 8px;

    .landmark-chip {
      padding: 5px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: 999px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;

      &:hover {
        color: var(--text-primary);
        border-color: var(--color-primary);
      }
    }
  }
}

.toc-list {
  flex: 1;
  overflow: auto;
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

    /* 当前章节高亮 */
    &.active {
      background: var(--color-primary);
      color: #fff;
      font-weight: 500;
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
