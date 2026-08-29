<template>
  <div class="response-actions">
    <!-- 复制 cURL -->
    <el-button size="small" text type="primary" @click="copyCurl">
      <LucideIcon name="Code" :size="13" />
      复制 cURL
    </el-button>
    <!-- 复制响应体 -->
    <el-button size="small" text type="primary" @click="copyBody">
      <LucideIcon name="Copy" :size="13" />
      复制响应
    </el-button>
    <!-- 导出响应为 JSON 文件（下载） -->
    <el-button size="small" text type="primary" @click="exportBody">
      <LucideIcon name="Download" :size="13" />
      导出响应
    </el-button>
  </div>
</template>

<script setup lang="ts">
/**
 * 响应操作条：复制 cURL / 复制响应体 / 导出响应体为文件
 */
import { ElMessage } from 'element-plus'
import type { ResponseRecord } from '../../types'
import { copyAsCurl } from '../../composables/useRequest'

/** 组件 props 定义 */
const props = defineProps<{
  /** 响应记录 */
  record: ResponseRecord | null;
}>()

/**
 * 复制最近一次请求的 cURL 命令
 */
function copyCurl(): void {
  const curl = copyAsCurl()
  if (!curl) {
    ElMessage.warning('请先发送一次请求')
    return
  }
  window.ipcRenderer.clipboard.writeText(curl)
  ElMessage.success('已复制 cURL 命令')
}

/**
 * 复制响应体文本（JSON 会格式化后复制）
 */
function copyBody(): void {
  if (!props.record) return
  const text =
    typeof props.record.body === 'object'
      ? JSON.stringify(props.record.body, null, 2)
      : String(props.record.body ?? '')
  window.ipcRenderer.clipboard.writeText(text)
  ElMessage.success('已复制响应内容')
}

/**
 * 导出响应体为本地 JSON/TXT 文件（浏览器下载）
 */
function exportBody(): void {
  if (!props.record) return
  const isObj = typeof props.record.body === 'object'
  const text = isObj
    ? JSON.stringify(props.record.body, null, 2)
    : String(props.record.body ?? '')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `response_${Date.now()}.${isObj ? 'json' : 'txt'}`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.response-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
