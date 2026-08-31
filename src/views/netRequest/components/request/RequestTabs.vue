<template>
  <el-tabs v-model="activeTab" class="request-tabs">
    <el-tab-pane name="params">
      <template #label>
        <span class="tab-label">
          Params
          <span v-if="enabledCount(config.params)" class="tab-badge">{{ enabledCount(config.params) }}</span>
        </span>
      </template>
      <ParamsTab
        :config="config"
        @update:params="emit('update:params', $event)"
      />
    </el-tab-pane>
    <el-tab-pane name="body" label="Body">
      <BodyTab
        :config="config"
        @update:body-type="emit('update:bodyType', $event)"
        @update:raw-type="emit('update:rawType', $event)"
        @update:raw-body="emit('update:rawBody', $event)"
        @update:form-data="emit('update:formData', $event)"
        @update:url-encoded="emit('update:urlEncoded', $event)"
        @update:binary-file-path="emit('update:binaryFilePath', $event)"
      />
    </el-tab-pane>
    <el-tab-pane name="headers">
      <template #label>
        <span class="tab-label">
          Headers
          <span v-if="enabledCount(config.headers)" class="tab-badge">{{ enabledCount(config.headers) }}</span>
        </span>
      </template>
      <HeadersTab
        :config="config"
        @update:headers="emit('update:headers', $event)"
      />
    </el-tab-pane>
    <el-tab-pane name="auth">
      <template #label>
        <span class="tab-label">
          Auth
          <span v-if="config.auth.type !== 'none'" class="tab-badge tab-badge-active">开</span>
        </span>
      </template>
      <AuthTab :config="config" @update:auth="emit('update:auth', $event)" />
    </el-tab-pane>
    <el-tab-pane name="scripts">
      <template #label>
        <span class="tab-label">
          设置/脚本
          <span v-if="config.scripts.pre || config.scripts.post" class="tab-badge tab-badge-active">开</span>
        </span>
      </template>
      <ScriptTab
        :config="config"
        :test-results="testResults"
        @update:settings="emit('update:settings', $event)"
        @update:scripts="emit('update:scripts', $event)"
      />
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
/**
 * 请求编辑区页签容器：Params / Body / Headers / Auth / 设置与脚本
 * 每个页签内字段变更以事件向上冒泡，由父组件统一维护 RequestConfig
 */
import { ref } from 'vue'
import ParamsTab from './ParamsTab.vue'
import BodyTab from './BodyTab.vue'
import HeadersTab from './HeadersTab.vue'
import AuthTab from './AuthTab.vue'
import ScriptTab from './ScriptTab.vue'
import type {
  AuthConfig,
  BodyType,
  FormDataRow,
  KeyValueItem,
  RawType,
  RequestConfig,
  RequestSettings,
  ScriptConfig,
  TestResult,
} from '../../types'

/** 组件 props 定义 */
defineProps<{
  /** 当前请求配置 */
  config: RequestConfig;
  /** 后置脚本断言结果 */
  testResults: TestResult[];
}>()

/** 事件：config 各字段更新（命名规则 update:<field>） */
const emit = defineEmits<{
  (e: 'update:params', val: KeyValueItem[]): void
  (e: 'update:headers', val: KeyValueItem[]): void
  (e: 'update:bodyType', val: BodyType): void
  (e: 'update:rawType', val: RawType): void
  (e: 'update:rawBody', val: string): void
  (e: 'update:formData', val: FormDataRow[]): void
  (e: 'update:urlEncoded', val: KeyValueItem[]): void
  (e: 'update:binaryFilePath', val: string): void
  (e: 'update:auth', val: AuthConfig): void
  (e: 'update:settings', val: RequestSettings): void
  (e: 'update:scripts', val: ScriptConfig): void
}>()

/** 当前激活页签 */
const activeTab = ref('params')

/**
 * 统计启用且有内容的行数（页签角标）
 * @param items 键值对行
 * @returns 启用行数
 */
function enabledCount(items: KeyValueItem[]): number {
  return (items || []).filter((i) => i.enabled && i.key.trim()).length
}
</script>

<style scoped lang="scss">
@use '../../styles/shared' as *;

.request-tabs {
  flex-shrink: 0;
  padding: 0 10px;
  @include nr-panel;

  // 页签头部精简
  :deep(.el-tabs__header) {
    margin-bottom: 8px;
  }
  :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
  }
  :deep(.el-tabs__item) {
    height: 38px;
    font-size: 13px;
  }

  :deep(.el-tabs__content) {
    overflow: auto;
    max-height: 34vh;
    padding: 2px 2px 8px;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tab-badge {
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  text-align: center;

  &-active {
    background: var(--el-color-primary-light-8);
    color: var(--el-color-primary);
    font-weight: 600;
  }
}
</style>
