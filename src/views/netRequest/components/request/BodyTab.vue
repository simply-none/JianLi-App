<template>
  <div class="body-tab">
    <!-- 请求体类型切换 -->
    <el-radio-group
      :model-value="config.bodyType"
      size="small"
      class="body-type-group"
      @update:model-value="emit('update:bodyType', $event as BodyType)"
    >
      <el-radio-button value="none">无</el-radio-button>
      <el-radio-button value="form-data">form-data</el-radio-button>
      <el-radio-button value="x-www-form-urlencoded">x-www-form-urlencoded</el-radio-button>
      <el-radio-button value="raw">raw</el-radio-button>
      <el-radio-button value="binary">binary</el-radio-button>
    </el-radio-group>

    <!-- form-data：文本行 + 文件行 -->
    <FormDataTable
      v-if="config.bodyType === 'form-data'"
      :rows="config.formData"
      @update:rows="emit('update:formData', $event)"
    />

    <!-- x-www-form-urlencoded -->
    <KeyValueTable
      v-else-if="config.bodyType === 'x-www-form-urlencoded'"
      :rows="config.urlEncoded"
      key-placeholder="字段名"
      value-placeholder="字段值（支持 {{变量}}）"
      @update:rows="emit('update:urlEncoded', $event)"
    />

    <!-- raw：语言选择 + 文本编辑 + 格式化 -->
    <div v-else-if="config.bodyType === 'raw'" class="raw-box">
      <div class="raw-toolbar">
        <el-radio-group
          :model-value="config.rawType"
          size="small"
          @update:model-value="emit('update:rawType', $event as RawType)"
        >
          <el-radio-button value="json">JSON</el-radio-button>
          <el-radio-button value="text">Text</el-radio-button>
          <el-radio-button value="xml">XML</el-radio-button>
          <el-radio-button value="html">HTML</el-radio-button>
        </el-radio-group>
        <el-button
          v-if="config.rawType === 'json'"
          size="small"
          text
          type="primary"
          @click="formatJson"
        >
          <LucideIcon name="Code" :size="14" />
          格式化
        </el-button>
      </div>
      <el-input
        :model-value="config.rawBody"
        type="textarea"
        :rows="10"
        class="raw-editor"
        spellcheck="false"
        :placeholder="rawPlaceholder"
        @update:model-value="emit('update:rawBody', $event)"
      />
    </div>

    <!-- binary：文件选择 -->
    <div v-else-if="config.bodyType === 'binary'" class="binary-box">
      <el-input
        :model-value="config.binaryFilePath"
        spellcheck="false"
        placeholder="选择要上传的二进制文件"
        readonly
      >
        <template #append>
          <el-button @click="pickBinaryFile">选择文件</el-button>
        </template>
      </el-input>
    </div>

    <!-- none：提示 -->
    <div v-else class="body-none-tip">该请求不携带请求体</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 请求体页签：按类型切换不同的编辑器
 * - form-data：FormDataTable（文本行+文件行）
 * - x-www-form-urlencoded：KeyValueTable
 * - raw：JSON/Text/XML/HTML 文本编辑（JSON 支持一键格式化）
 * - binary：单文件选择
 */
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import FormDataTable from './body/FormDataTable.vue'
import KeyValueTable from './KeyValueTable.vue'
import type { BodyType, FormDataRow, KeyValueItem, RawType, RequestConfig } from '../../types'

/** 组件 props 定义 */
const props = defineProps<{
  /** 当前请求配置（body 相关字段） */
  config: RequestConfig;
}>()

/** 事件：body 各字段更新 */
const emit = defineEmits<{
  (e: 'update:bodyType', val: BodyType): void
  (e: 'update:rawType', val: RawType): void
  (e: 'update:rawBody', val: string): void
  (e: 'update:formData', val: FormDataRow[]): void
  (e: 'update:urlEncoded', val: KeyValueItem[]): void
  (e: 'update:binaryFilePath', val: string): void
}>()

/** raw 编辑器占位提示（按子类型区分） */
const rawPlaceholder = computed(() => {
  if (props.config.rawType === 'json') return '{\n  "name": "example"\n}'
  if (props.config.rawType === 'xml') return '<root><name>example</name></root>'
  if (props.config.rawType === 'html') return '<html><body>example</body></html>'
  return '请求体文本内容（支持 {{变量}}）'
})

/**
 * 格式化 raw JSON 文本（解析失败提示且保留原内容）
 */
function formatJson(): void {
  try {
    const formatted = JSON.stringify(JSON.parse(props.config.rawBody || '{}'), null, 2)
    emit('update:rawBody', formatted)
  } catch (err: any) {
    ElMessage.warning('JSON 解析失败：' + (err?.message || err))
  }
}

/**
 * 选择 binary 上传文件（走主进程文件对话框）
 */
async function pickBinaryFile(): Promise<void> {
  const res = await window.ipcRenderer.handlePromise('net-request:pick-file', {
    title: '选择上传文件',
  })
  if (res?.success && res.path) {
    emit('update:binaryFilePath', res.path)
  }
}
</script>

<style scoped lang="scss">
.body-tab {
  width: 100%;
}

.body-type-group {
  margin-bottom: 10px;
}

.raw-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.raw-editor {
  :deep(textarea) {
    font-family: Consolas, Monaco, monospace;
    font-size: 13px;
  }
}

.binary-box {
  width: 100%;
}

.body-none-tip {
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
