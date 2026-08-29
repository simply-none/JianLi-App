<template>
  <div class="auth-tab">
    <!-- 认证类型切换 -->
    <el-radio-group
      :model-value="config.auth.type"
      size="small"
      class="auth-type-group"
      @update:model-value="patchAuth({ type: $event as AuthType })"
    >
      <el-radio-button value="none">无认证</el-radio-button>
      <el-radio-button value="bearer">Bearer Token</el-radio-button>
      <el-radio-button value="basic">Basic Auth</el-radio-button>
      <el-radio-button value="api-key">API Key</el-radio-button>
    </el-radio-group>

    <!-- Bearer -->
    <el-input
      v-if="config.auth.type === 'bearer'"
      :model-value="config.auth.token"
      spellcheck="false"
      placeholder="Token（支持 {{变量}}，发送时自动加 Authorization: Bearer {token}）"
      @update:model-value="patchAuth({ token: $event })"
    />

    <!-- Basic -->
    <div v-else-if="config.auth.type === 'basic'" class="auth-basic">
      <el-input
        :model-value="config.auth.username"
        spellcheck="false"
        placeholder="用户名"
        @update:model-value="patchAuth({ username: $event })"
      />
      <el-input
        :model-value="config.auth.password"
        type="password"
        show-password
        spellcheck="false"
        placeholder="密码"
        @update:model-value="patchAuth({ password: $event })"
      />
    </div>

    <!-- API Key -->
    <div v-else-if="config.auth.type === 'api-key'" class="auth-apikey">
      <el-input
        :model-value="config.auth.apiKeyName"
        spellcheck="false"
        placeholder="参数名（如 X-API-Key）"
        class="apikey-name"
        @update:model-value="patchAuth({ apiKeyName: $event })"
      />
      <el-input
        :model-value="config.auth.apiKeyValue"
        spellcheck="false"
        placeholder="参数值（支持 {{变量}}）"
        @update:model-value="patchAuth({ apiKeyValue: $event })"
      />
      <el-radio-group
        :model-value="config.auth.apiKeyIn"
        size="small"
        @update:model-value="patchAuth({ apiKeyIn: $event as 'header' | 'query' })"
      >
        <el-radio-button value="header">加入 Header</el-radio-button>
        <el-radio-button value="query">加入 Query</el-radio-button>
      </el-radio-group>
    </div>

    <!-- none：提示 -->
    <div v-else class="auth-none-tip">未启用认证，请求头中将不携带凭据</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 认证页签：Bearer / Basic / API Key 快捷认证
 * 认证信息不会写入 Headers 表格，而是在发送时动态合并（与 Postman 行为一致）
 */
import type { AuthConfig, AuthType, RequestConfig } from '../../types'

/** 组件 props 定义 */
const props = defineProps<{
  /** 当前请求配置（使用 auth 字段） */
  config: RequestConfig;
}>()

/** 事件：auth 配置更新（部分字段打补丁） */
const emit = defineEmits<{
  (e: 'update:auth', val: AuthConfig): void
}>()

/**
 * 对 auth 配置做局部更新并向上同步
 * @param patch 待合并的字段
 */
function patchAuth(patch: Partial<AuthConfig>): void {
  emit('update:auth', { ...props.config.auth, ...patch })
}
</script>

<style scoped lang="scss">
.auth-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-basic,
.auth-apikey {
  display: flex;
  gap: 8px;
  align-items: center;

  .apikey-name {
    width: 220px;
  }
}

.auth-none-tip {
  padding: 16px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
