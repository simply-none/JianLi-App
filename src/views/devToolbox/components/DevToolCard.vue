<template>
  <!-- 开发工具卡片：仪表盘单个入口，点击打开对应工具 -->
  <div class="dev-tool-card" @click="$emit('click')">
    <div class="accent-bar" :style="{ background: meta.accent }"></div>
    <div class="card-icon" :style="{ color: meta.accent }">
      <LucideIcon :name="meta.icon" :size="22" />
    </div>
    <div class="card-body">
      <div class="card-title">{{ meta.title }}</div>
      <div class="card-desc">{{ meta.desc }}</div>
    </div>
    <LucideIcon name="ChevronRight" :size="18" class="card-arrow" />
  </div>
</template>

<script setup lang="ts">
/**
 * 开发工具箱 - 工具卡片组件
 * 结构与 pdfTools 的 PdfToolCard 保持一致（accent 竖条 + 图标 + 标题/描述 + 箭头），
 * 按模块约定放在 devToolbox 自己的 components 下。
 */
import LucideIcon from '@/components/LucideIcon.vue';
import type { DevToolMeta } from '../catalog';

/** 组件入参：单个工具元信息 */
defineProps<{ meta: DevToolMeta }>();
/** 组件事件：点击卡片时触发（由父组件打开对应工具） */
defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.dev-tool-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: border-color 0.18s ease, transform 0.18s ease;
}
.dev-tool-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
  transform: translateY(-2px);
}
.accent-bar {
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
  flex: none;
}
.card-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  flex: none;
}
.card-body {
  min-width: 0;
  flex: 1;
}
.card-title {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 15px;
}
.card-desc {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}
.card-arrow {
  color: var(--text-muted);
  flex: none;
}
</style>
