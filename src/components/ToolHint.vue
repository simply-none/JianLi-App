<template>
  <!-- 操作提示条：轻量信息条，展示某功能的使用说明 / 输入格式提示 -->
  <div class="tool-hint" :class="`tool-hint--${type}`">
    <LucideIcon :name="hintIcon" :size="14" class="hint-icon" />
    <div class="hint-body">
      <!-- 支持单行文本或字符串数组（多条提示逐行列出） -->
      <template v-if="Array.isArray(text)">
        <div v-for="(line, i) in text" :key="i" class="hint-line">{{ line }}</div>
      </template>
      <span v-else class="hint-line">{{ text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 通用操作提示组件（跨模块共享）
 * 在功能页面 / 面板顶部展示使用说明，降低「输入格式不对 / 不知道怎么用」的困惑。
 * 视觉沿用主题变量（--bg-base / --text-muted 等），随明暗主题自动切换。
 * 使用方：开发工具箱各面板、快捷键注册页等。
 */
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

/** 组件入参 */
const props = withDefaults(
  defineProps<{
    /** 必填：提示文本，字符串（单条）或字符串数组（多条逐行展示） */
    text: string | string[];
    /** 可选：提示类型，决定图标与配色。info=信息 / warn=注意 / tip=技巧，默认 info */
    type?: 'info' | 'warn' | 'tip';
  }>(),
  { type: 'info' }
);

/** 根据类型选择图标：信息用 Info、注意用 TriangleAlert、技巧用 Lightbulb（均已在 LucideIcon 注册） */
const hintIcon = computed(() =>
  props.type === 'warn' ? 'TriangleAlert' : props.type === 'tip' ? 'Lightbulb' : 'Info'
);
</script>

<style lang="scss" scoped>
.tool-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  flex-shrink: 0;
  /* 默认（info）配色 */
  background: var(--bg-base, var(--el-fill-color-light));
  border: 1px solid var(--border-subtle, var(--el-border-color-lighter));
  color: var(--text-secondary, var(--el-text-color-regular));
}
.hint-icon {
  flex: none;
  margin-top: 2px;
  color: var(--color-primary, var(--el-color-primary));
}
.hint-body {
  min-width: 0;
  flex: 1;
}
.hint-line {
  color: var(--text-secondary, var(--el-text-color-regular));
}
.hint-line + .hint-line {
  margin-top: 2px;
}
/* 注意（warn）：琥珀色强调 */
.tool-hint--warn {
  background: color-mix(in srgb, var(--color-warning, #e6a23c) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-warning, #e6a23c) 30%, transparent);
}
.tool-hint--warn .hint-icon {
  color: var(--color-warning, #e6a23c);
}
/* 技巧（tip）：绿色强调 */
.tool-hint--tip {
  background: color-mix(in srgb, var(--color-success, #67c23a) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-success, #67c23a) 30%, transparent);
}
.tool-hint--tip .hint-icon {
  color: var(--color-success, #67c23a);
}
</style>
