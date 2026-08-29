<template>
  <div class="form-data-table">
    <div v-for="(row, index) in rows" :key="row.id" class="fd-row">
      <!-- 启用开关 -->
      <el-checkbox
        :model-value="row.enabled"
        class="fd-check"
        @update:model-value="toggleRow(index)"
      />
      <!-- 行类型：文本 / 文件 -->
      <el-select
        :model-value="row.rowType"
        class="fd-type"
        size="default"
        @update:model-value="changeRowType(index, $event)"
      >
        <el-option label="文本" value="text" />
        <el-option label="文件" value="file" />
      </el-select>
      <!-- 参数名 -->
      <el-input
        :model-value="row.key"
        class="fd-input"
        spellcheck="false"
        placeholder="字段名"
        @update:model-value="updateRow(index, 'key', $event)"
      />
      <!-- 值：文本输入 或 文件路径选择 -->
      <el-input
        v-if="row.rowType === 'text'"
        :model-value="row.value"
        class="fd-input"
        spellcheck="false"
        placeholder="字段值"
        @update:model-value="updateRow(index, 'value', $event)"
      />
      <el-input
        v-else
        :model-value="row.filePath"
        class="fd-input"
        spellcheck="false"
        placeholder="点击右侧按钮选择文件"
        readonly
      >
        <template #append>
          <el-button @click="pickFile(index)">选择文件</el-button>
        </template>
      </el-input>
      <!-- 删除行 -->
      <el-button text type="danger" size="small" @click="removeRow(index)">
        <LucideIcon name="X" :size="14" />
      </el-button>
    </div>
    <el-button text type="primary" size="small" @click="addRow">
      <LucideIcon name="Plus" :size="14" />
      添加字段
    </el-button>
  </div>
</template>

<script setup lang="ts">
/**
 * form-data 请求体编辑表格
 * - 每行可选「文本」或「文件」类型（文件行由主进程读盘发送）
 * - 行可启用/禁用
 */
import type { FormDataRow } from '../../../types'
import { createKv, uid } from '../../../composables/useEnvironment'

/** 组件 props 定义 */
const props = defineProps<{
  /** form-data 行数据 */
  rows: FormDataRow[];
}>()

/** 更新事件（v-model:rows） */
const emit = defineEmits<{
  (e: 'update:rows', val: FormDataRow[]): void
}>()

/**
 * 更新指定行字段并同步
 * @param index 行下标
 * @param field 字段名
 * @param value 新值
 */
function updateRow(index: number, field: 'key' | 'value', value: string): void {
  emit(
    'update:rows',
    props.rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
  )
}

/**
 * 切换行启用状态
 * @param index 行下标
 */
function toggleRow(index: number): void {
  emit(
    'update:rows',
    props.rows.map((r, i) => (i === index ? { ...r, enabled: !r.enabled } : r))
  )
}

/**
 * 切换行的文本/文件类型（切换到文件时保留 filePath，切回文本时保留 value）
 * @param index 行下标
 * @param rowType 新类型
 */
function changeRowType(index: number, rowType: 'text' | 'file'): void {
  emit(
    'update:rows',
    props.rows.map((r, i) => (i === index ? { ...r, rowType } : r))
  )
}

/**
 * 删除行
 * @param index 行下标
 */
function removeRow(index: number): void {
  emit('update:rows', props.rows.filter((_, i) => i !== index))
}

/**
 * 新增文本行
 */
function addRow(): void {
  const row: FormDataRow = { ...createKv(), rowType: 'text', filePath: '' }
  emit('update:rows', [...props.rows, row])
}

/**
 * 选择文件并写入指定行
 * @param index 行下标
 */
async function pickFile(index: number): Promise<void> {
  const res = await window.ipcRenderer.handlePromise('net-request:pick-file', {
    title: '选择上传文件',
  })
  if (res?.success && res.path) {
    emit(
      'update:rows',
      props.rows.map((r, i) => (i === index ? { ...r, filePath: res.path } : r))
    )
  }
}
</script>

<style scoped lang="scss">
.form-data-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fd-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fd-check {
  height: auto;
}

.fd-type {
  width: 92px;
}

.fd-input {
  flex: 1;
}
</style>
