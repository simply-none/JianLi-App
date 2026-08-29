<template>
  <div class="url-bar">
    <!-- 请求方法选择（彩色标识） -->
    <el-select
      :model-value="config.method"
      class="method-select"
      :class="'method-' + config.method.toLowerCase()"
      :popper-options="{ strategy: 'fixed' }"
      @update:model-value="emit('update:method', $event)"
    >
      <el-option
        v-for="m in METHODS"
        :key="m"
        :label="m"
        :value="m"
        :class="'method-option-' + m.toLowerCase()"
      />
    </el-select>
    <!-- 请求地址 -->
    <el-input
      :model-value="config.url"
      class="url-input"
      spellcheck="false"
      placeholder="https://api.example.com/users 或 {{baseUrl}}/users"
      clearable
      @update:model-value="emit('update:url', $event)"
      @keyup.enter="emit('send')"
    />
    <!-- 发送 / 保存 -->
    <el-button type="primary" :loading="loading" @click="emit('send')">发送</el-button>
    <el-button @click="emit('save')">
      <LucideIcon name="Save" :size="14" />
      保存
    </el-button>
  </div>
</template>

<script setup lang="ts">
/**
 * 请求地址栏：方法选择 + URL 输入 + 发送 + 保存到集合
 * URL 支持 {{环境变量}} 占位符（发送时替换，此处原样展示）
 */
import type { RequestConfig, RequestMethod } from '../../types'

/** 支持的全部请求方法 */
const METHODS: RequestMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
]

/** 组件 props 定义 */
defineProps<{
  /** 当前请求配置（仅使用 method/url 字段） */
  config: RequestConfig;
  /** 是否正在请求中（发送按钮 loading） */
  loading: boolean;
}>()

/** 事件：method/url 更新、发送、保存 */
const emit = defineEmits<{
  (e: 'update:method', val: RequestMethod): void
  (e: 'update:url', val: string): void
  (e: 'send'): void
  (e: 'save'): void
}>()
</script>

<style scoped lang="scss">
@use '../../styles/shared' as *;

.url-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  flex-shrink: 0;
  @include nr-panel;

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
  }
}

.method-select {
  width: 112px;
  flex-shrink: 0;

  // 各方法的彩色标识（Postman 风格）
  :deep(.el-input__inner) {
    font-weight: 700;
    letter-spacing: 0.4px;
  }
  &.method-get :deep(.el-input__inner) {
    color: var(--el-color-success);
  }
  &.method-post :deep(.el-input__inner) {
    color: var(--el-color-warning);
  }
  &.method-put :deep(.el-input__inner) {
    color: var(--el-color-primary);
  }
  &.method-delete :deep(.el-input__inner) {
    color: var(--el-color-danger);
  }
  &.method-patch :deep(.el-input__inner) {
    color: var(--el-color-primary-light-3);
  }
  &.method-head :deep(.el-input__inner) {
    color: var(--el-color-info);
  }
  &.method-options :deep(.el-input__inner) {
    color: var(--el-text-color-secondary);
  }
}

.url-input {
  flex: 1;

  :deep(.el-input__inner) {
    font-family: $nr-mono;
    font-size: 13px;
  }
}

// 发送按钮：主操作突出
.url-bar > .el-button--primary {
  min-width: 78px;
  font-weight: 600;
}
</style>
