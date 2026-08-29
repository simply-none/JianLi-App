<template>
  <div class="status-bar">
    <!-- 状态码（彩色） -->
    <span class="status-code" :class="statusClass">
      {{ record.error ? '错误' : record.status + ' ' + record.statusText }}
    </span>
    <!-- 耗时 -->
    <span class="status-item">
      <LucideIcon name="Clock" :size="13" />
      {{ formatTime(record.time) }}
    </span>
    <!-- 大小 -->
    <span class="status-item">
      <LucideIcon name="HardDrive" :size="13" />
      {{ formatSize(record.size) }}
    </span>
    <!-- content-type -->
    <span v-if="record.contentType" class="status-item status-ct">
      {{ record.contentType.split(';')[0] }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * 响应状态条：状态码（按 2xx/3xx/4xx/5xx 着色）、耗时、响应大小、content-type
 */
import { computed } from 'vue'
import type { ResponseRecord } from '../../types'

/** 组件 props 定义 */
const props = defineProps<{
  /** 响应记录 */
  record: ResponseRecord;
}>()

/** 状态码着色 class */
const statusClass = computed(() => {
  if (props.record.error) return 'status-error'
  const s = props.record.status
  if (s >= 200 && s < 300) return 'status-2xx'
  if (s >= 300 && s < 400) return 'status-3xx'
  if (s >= 400 && s < 500) return 'status-4xx'
  return 'status-5xx'
})

/**
 * 格式化耗时展示
 * @param time 毫秒
 * @returns 如 320ms / 1.25s
 */
function formatTime(time: number): string {
  if (!time) return '-'
  return time >= 1000 ? (time / 1000).toFixed(2) + 's' : time + 'ms'
}

/**
 * 格式化响应大小
 * @param size 字节
 * @returns 如 1.2KB / 3.4MB / 512B
 */
function formatSize(size: number): string {
  if (!size) return '-'
  if (size < 1024) return size + 'B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + 'KB'
  return (size / 1024 / 1024).toFixed(2) + 'MB'
}
</script>

<style scoped lang="scss">
.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}

.status-code {
  font-weight: 700;

  &.status-2xx {
    color: var(--el-color-success);
  }
  &.status-3xx {
    color: var(--el-color-warning);
  }
  &.status-4xx,
  &.status-5xx,
  &.status-error {
    color: var(--el-color-danger);
  }
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
}

.status-ct {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}
</style>
