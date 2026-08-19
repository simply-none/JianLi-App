<template>
  <span class="tag-chip" :style="chipStyle" :title="name">
    <span class="tag-dot" :style="{ backgroundColor: color }"></span>
    <span class="tag-text">{{ name }}</span>
    <LucideIcon
      v-if="closable"
      name="X"
      :size="12"
      class="tag-close"
      @click.stop="$emit('close')"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

const props = withDefaults(
  defineProps<{
    /** 标签 id（优先），为空时回退到 name/color */
    id?: string | number;
    name?: string;
    color?: string;
    closable?: boolean;
  }>(),
  { closable: false }
);

defineEmits<{ (e: 'close'): void }>();

const { tagName, tagColor } = useThemeConversation();

const name = computed(() => props.name ?? tagName(props.id));
const color = computed(() => props.color ?? tagColor(props.id));

const chipStyle = computed(() => ({
  // 用标签自身颜色渲染，不同标签样式不同
  backgroundColor: color.value + '1A',
  color: color.value,
  borderColor: color.value + '55',
}));
</script>

<style scoped lang="scss">
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px 1px 6px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  user-select: none;
  cursor: default;

  .tag-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-text {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tag-close {
    cursor: pointer;
    opacity: 0.6;
    margin-left: 1px;

    &:hover {
      opacity: 1;
    }
  }
}
</style>
