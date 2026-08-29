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
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
}

// 状态码徽标：按语义着色（彩色文字 + 同色浅底）
.status-code {
  font-weight: 700;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;

  &.status-2xx {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
  }
  &.status-3xx {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }
  &.status-4xx,
  &.status-5xx,
  &.status-error {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
}

// 耗时 / 大小 / 类型：弱化徽标
.status-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.status-ct {
  font-family: Consolas, Monaco, monospace;
}
</style>
