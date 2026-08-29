<template>
  <div class="script-tab">
    <!-- 请求设置：超时 / 重定向 / SSL -->
    <div class="settings-box">
      <div class="settings-title">请求设置</div>
      <div class="settings-row">
        <span class="settings-label">超时时间（ms）</span>
        <el-input-number
          :model-value="config.settings.timeout"
          :min="1000"
          :step="1000"
          size="small"
          @update:model-value="patchSettings({ timeout: Number($event) || 30000 })"
        />
        <el-checkbox
          :model-value="config.settings.followRedirects"
          label="跟随重定向"
          @update:model-value="patchSettings({ followRedirects: !!$event })"
        />
        <el-checkbox
          :model-value="config.settings.validateSsl"
          label="校验 SSL 证书"
          @update:model-value="patchSettings({ validateSsl: !!$event })"
        />
      </div>
    </div>

    <!-- 前置脚本 -->
    <div class="script-box">
      <div class="settings-title">前置脚本</div>
      <div class="script-tip">
        发送前执行。可用 API：$env.get(key) / $env.set(key, value) / $env.replace(str)；
        $request.url / $request.headers（对象，可改）/ $request.params
      </div>
      <el-input
        :model-value="config.scripts.pre"
        type="textarea"
        :rows="6"
        class="script-editor"
        spellcheck="false"
        placeholder="// 例：$request.headers['Authorization'] = 'Bearer ' + $env.get('token')"
        @update:model-value="patchScripts({ pre: $event })"
      />
    </div>

    <!-- 后置脚本 -->
    <div class="script-box">
      <div class="settings-title">后置脚本（断言）</div>
      <div class="script-tip">
        收到响应后执行。可用 API：$response.status / $response.body / $response.headers / $response.time；
        $test('断言名', 条件, '失败说明')
      </div>
      <el-input
        :model-value="config.scripts.post"
        type="textarea"
        :rows="6"
        class="script-editor"
        spellcheck="false"
        placeholder="// 例：$test('状态码为 200', $response.status === 200)"
        @update:model-value="patchScripts({ post: $event })"
      />
    </div>

    <!-- 断言结果 -->
    <div v-if="testResults.length" class="test-results">
      <div class="settings-title">断言结果（{{ passedCount }}/{{ testResults.length }} 通过）</div>
      <div
        v-for="(r, i) in testResults"
        :key="i"
        class="test-item"
        :class="r.passed ? 'test-pass' : 'test-fail'"
      >
        <LucideIcon :name="r.passed ? 'CircleCheck' : 'CircleX'" :size="14" />
        <span class="test-name">{{ r.name }}</span>
        <span v-if="!r.passed" class="test-message">{{ r.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 脚本页签：请求设置 + 前置/后置脚本编辑 + 断言结果展示
 * 脚本在渲染端以 new Function 受控执行（见 useRequest.ts）
 */
import { computed } from 'vue'
import type { RequestConfig, RequestSettings, ScriptConfig, TestResult } from '../../types'

/** 组件 props 定义 */
const props = defineProps<{
  /** 当前请求配置（settings/scripts 字段） */
  config: RequestConfig;
  /** 最近一次断言结果 */
  testResults: TestResult[];
}>()

/** 事件：settings / scripts 更新 */
const emit = defineEmits<{
  (e: 'update:settings', val: RequestSettings): void
  (e: 'update:scripts', val: ScriptConfig): void
}>()

/** 断言通过数 */
const passedCount = computed(() => props.testResults.filter((r) => r.passed).length)

/**
 * 局部更新请求设置
 * @param patch 待合并字段
 */
function patchSettings(patch: Partial<RequestSettings>): void {
  emit('update:settings', { ...props.config.settings, ...patch })
}

/**
 * 局部更新脚本配置
 * @param patch 待合并字段
 */
function patchScripts(patch: Partial<ScriptConfig>): void {
  emit('update:scripts', { ...props.config.scripts, ...patch })
}
</script>

<style scoped lang="scss">
.script-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.settings-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.script-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  line-height: 1.6;
}

.script-editor {
  :deep(textarea) {
    font-family: Consolas, Monaco, monospace;
    font-size: 13px;
  }
}

.test-results {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
}

.test-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;

  &.test-pass .test-name {
    color: var(--el-color-success);
  }
  &.test-fail .test-name {
    color: var(--el-color-danger);
  }
}

.test-message {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
