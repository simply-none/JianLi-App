<template>
  <KeyValueTable
    :rows="config.headers"
    key-placeholder="请求头名（如 Content-Type）"
    value-placeholder="请求头值（支持 {{变量}}）"
    @update:rows="emit('update:headers', $event)"
  />
</template>

<script setup lang="ts">
/**
 * 请求头页签：编辑 HTTP 请求头
 */
import KeyValueTable from './KeyValueTable.vue'
import type { KeyValueItem, RequestConfig } from '../../types'

/** 组件 props 定义 */
defineProps<{
  /** 当前请求配置（使用 headers 字段） */
  config: RequestConfig;
}>()

/** 事件：headers 更新 */
const emit = defineEmits<{
  (e: 'update:headers', val: KeyValueItem[]): void
}>()
</script>
