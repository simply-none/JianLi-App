<template>
  <KeyValueTable
    :rows="config.params"
    key-placeholder="参数名（如 page）"
    value-placeholder="参数值（支持 {{变量}}）"
    @update:rows="emit('update:params', $event)"
  />
</template>

<script setup lang="ts">
/**
 * 查询参数页签：编辑 URL 查询参数（启用行会在发送时拼到 URL）
 */
import KeyValueTable from './KeyValueTable.vue'
import type { KeyValueItem, RequestConfig } from '../../types'

/** 组件 props 定义 */
defineProps<{
  /** 当前请求配置（使用 params 字段） */
  config: RequestConfig;
}>()

/** 事件：params 更新 */
const emit = defineEmits<{
  (e: 'update:params', val: KeyValueItem[]): void
}>()
</script>
