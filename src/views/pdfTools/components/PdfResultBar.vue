<template>
  <!-- 操作结果反馈条：成功显示输出路径(可点开目录)，失败显示错误 -->
  <div v-if="result" class="result-bar" :class="result.success ? 'ok' : 'err'">
    <LucideIcon :name="result.success ? 'CircleCheck' : 'CircleAlert'" :size="16" />
    <div class="result-text">
      <template v-if="result.success">
        <span>操作成功</span>
        <span v-if="result.pages" class="meta">· {{ result.pages }} 页</span>
        <span v-if="result.count" class="meta">· {{ result.count }} 个文件</span>
        <span
          v-if="result.outputPath"
          class="path"
          @click="openFolder(result.outputPath)"
          >{{ short(result.outputPath) }}</span
        >
        <span
          v-else-if="result.files && result.files.length"
          class="path"
          @click="openFolder(dirOf(result.files[0]))"
          >已生成 {{ result.files.length }} 个文件 · 点击打开目录</span
        >
      </template>
      <span v-else class="err-msg">{{ result.error || '操作失败' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue';
import type { PdfActionResult } from '../types';

defineProps<{ result: PdfActionResult | null }>();

function dirOf(p: string): string {
  return p.replace(/[^\\/]+$/, '');
}
function short(p: string): string {
  if (p.length <= 48) return p;
  return '…' + p.slice(p.length - 46);
}
function openFolder(p: string): void {
  const dir = dirOf(p);
  // 复用主进程 open-folder IPC 在资源管理器/访达中打开目录
  (window as any).ipcRenderer.send('open-folder', dir);
}
</script>

<style scoped>
.result-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-card);
  font-size: 13px;
  margin-top: 12px;
}
.result-bar.ok {
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
  color: var(--color-success);
}
.result-bar.err {
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
  color: var(--color-error);
}
.result-text {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.meta {
  opacity: 0.85;
}
.path {
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.path:hover {
  color: var(--color-primary);
}
.err-msg {
  color: inherit;
}
</style>
