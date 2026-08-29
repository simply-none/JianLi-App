<template>
  <aside class="category-side">
    <div
      v-for="cat in categories"
      :key="cat.key"
      class="cat-item"
      :class="{ 'is-active': modelValue === cat.key }"
      @click="$emit('update:modelValue', cat.key)"
    >
      <LucideIcon :name="cat.icon" :size="16" class="cat-icon" />
      <span class="cat-label">{{ cat.label }}</span>
      <span class="cat-count">{{ cat.count }}</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * 下载分类侧栏（全部/视频/音乐/... + 各分类任务计数）
 */
import { computed } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import { CATEGORY_META } from "../utils/format";
import type { DownloadTaskItem } from "../api/downloaderApi";

/** 组件 props */
const props = defineProps<{
  /** 必填，当前选中的分类 key（'all' 或分类名） */
  modelValue: string;
  /** 必填，全量任务列表（用于计数） */
  tasks: DownloadTaskItem[];
}>();

/** 选中分类变化事件 */
defineEmits<{ (e: "update:modelValue", key: string): void }>();

/** 分类列表（全部 + 固定分类，other 分类任务数为 0 时也显示） */
const categories = computed(() => {
  const keys = ["all", "video", "audio", "document", "archive", "software", "image", "other"];
  return keys.map((key) => ({
    key,
    label: key === "all" ? "全部" : CATEGORY_META[key].label,
    icon: key === "all" ? "Download" : CATEGORY_META[key].icon,
    count: key === "all" ? props.tasks.length : props.tasks.filter((t) => t.category === key).length,
  }));
});
</script>

<style scoped lang="scss">
.category-side {
  width: 150px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  overflow-y: auto;

  &::-webkit-scrollbar { width: 3px; }
  &:hover::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); }
}

.cat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-btn);
  cursor: pointer;
  user-select: none;
  color: var(--text-secondary);
  font-size: 0.84rem;
  transition: background 0.15s, color 0.15s;

  .cat-icon { opacity: 0.7; flex-shrink: 0; }

  .cat-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cat-count {
    font-size: 0.72rem;
    color: var(--text-muted);
    background: var(--bg-hover);
    border-radius: 8px;
    padding: 1px 7px;
    min-width: 20px;
    text-align: center;
  }

  &:hover { background: var(--bg-hover); }

  &.is-active {
    background: var(--color-primary-light);
    color: var(--color-primary-solid);
    font-weight: 600;

    .cat-icon { opacity: 1; color: var(--color-primary); }
    .cat-count { background: transparent; color: var(--color-primary-solid); }
  }
}
</style>
