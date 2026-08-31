<template>
  <div class="kv-table">
    <!-- 工具条：批量编辑切换 -->
    <div class="kv-toolbar">
      <el-button size="small" text type="primary" @click="toggleBatch">
        {{ batchMode ? '退出批量编辑' : '批量编辑' }}
      </el-button>
      <span v-if="batchMode" class="kv-batch-tip">每行一条，格式：键 : 值</span>
    </div>

    <!-- 批量编辑模式 -->
    <el-input
      v-if="batchMode"
      :model-value="batchText"
      type="textarea"
      :rows="6"
      spellcheck="false"
      placeholder="Content-Type : application/json"
      @update:model-value="batchText = $event"
    />
    <div v-else class="kv-rows">
      <div v-for="(row, index) in rows" :key="row.id" class="kv-row">
        <!-- 启用开关 -->
        <el-checkbox
          :model-value="row.enabled"
          class="kv-check"
          @update:model-value="toggleRow(index)"
        />
        <!-- 键 -->
        <el-input
          :ref="(el: any) => (keyRefs[index] = el)"
          :model-value="row.key"
          class="kv-input"
          spellcheck="false"
          :placeholder="keyPlaceholder"
          @update:model-value="updateRow(index, 'key', $event)"
          @keyup.enter="focusValue(index)"
        />
        <!-- 值 -->
        <el-input
          :ref="(el: any) => (valueRefs[index] = el)"
          :model-value="row.value"
          class="kv-input"
          spellcheck="false"
          :placeholder="valuePlaceholder"
          @update:model-value="updateRow(index, 'value', $event)"
          @keyup.enter="addRow"
        >
          <template #suffix>
            <el-icon v-if="isVarRow(row)" class="kv-var-icon" title="使用了 {{变量}} 占位符">
              <LucideIcon name="Braces" :size="12" />
            </el-icon>
          </template>
        </el-input>
        <!-- 删除行 -->
        <el-button class="kv-delete" text type="danger" size="small" @click="removeRow(index)">
          <LucideIcon name="X" :size="14" />
        </el-button>
      </div>
      <!-- 新增行按钮 -->
      <el-button class="kv-add" text type="primary" size="small" @click="addRow">
        <LucideIcon name="Plus" :size="14" />
        添加
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 通用键值对表格（查询参数 / 请求头 / urlencoded 复用）
 * - 行可启用/禁用（禁用行不参与请求，对齐 Postman 复选框）
 * - 回车快速流转：键输入框回车 → 聚焦值输入框；值输入框回车 → 新增行
 * - 支持批量编辑：每行「键 : 值」格式，整体覆盖当前列表
 */
import { ref } from 'vue'
import type { KeyValueItem } from '../../types'
import { createKv, uid } from '../../composables/useEnvironment'

/** 组件 props 定义 */
const props = defineProps<{
  /** 行数据（v-model:rows 双向绑定） */
  rows: KeyValueItem[];
  /** 键输入框占位提示，默认「键」 */
  keyPlaceholder?: string;
  /** 值输入框占位提示，默认「值」 */
  valuePlaceholder?: string;
}>()

/** 更新事件（v-model:rows） */
const emit = defineEmits<{
  (e: 'update:rows', val: KeyValueItem[]): void
}>()

/** 输入框 ref 表（回车聚焦流转用） */
const keyRefs = ref<Record<number, any>>({})
const valueRefs = ref<Record<number, any>>({})

/** 是否处于批量编辑模式 */
const batchMode = ref(false)
/** 批量编辑的文本内容 */
const batchText = ref('')

/**
 * 判断行值是否使用了 {{变量}} 占位符（仅做角标提示）
 * @param row 键值对行
 * @returns 是否包含占位符
 */
function isVarRow(row: KeyValueItem): boolean {
  return /\{\{.+\}\}/.test(row.value) || /\{\{.+\}\}/.test(row.key)
}

/**
 * 更新指定行字段并向上同步
 * @param index 行下标
 * @param field 更新的字段名
 * @param value 新值
 */
function updateRow(index: number, field: 'key' | 'value', value: string): void {
  const next = props.rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
  emit('update:rows', next)
}

/**
 * 切换行的启用状态
 * @param index 行下标
 */
function toggleRow(index: number): void {
  const next = props.rows.map((r, i) =>
    i === index ? { ...r, enabled: !r.enabled } : r
  )
  emit('update:rows', next)
}

/**
 * 删除指定行
 * @param index 行下标
 */
function removeRow(index: number): void {
  emit('update:rows', props.rows.filter((_, i) => i !== index))
}

/**
 * 新增一行并聚焦其键输入框
 */
function addRow(): void {
  emit('update:rows', [...props.rows, createKv()])
  setTimeout(() => {
    const el = keyRefs.value[props.rows.length]
    el?.focus?.()
  }, 50)
}

/**
 * 聚焦指定行的值输入框（键回车后流转）
 * @param index 行下标
 */
function focusValue(index: number): void {
  valueRefs.value[index]?.focus?.()
}

/**
 * 切换批量编辑模式：进入时把当前行序列化为文本，退出时解析文本覆盖列表
 */
function toggleBatch(): void {
  if (!batchMode.value) {
    // 进入：启用行输出「键 : 值」
    batchText.value = props.rows
      .filter((r) => r.key || r.value)
      .map((r) => `${r.key} : ${r.value}`)
      .join('\n')
    batchMode.value = true
  } else {
    // 退出：解析文本，保留原行 id 尽量复用
    const lines = batchText.value.split('\n').filter((l) => l.trim())
    const oldRows = [...props.rows]
    const next: KeyValueItem[] = lines.map((line, i) => {
      const idx = line.indexOf(':')
      const key = idx >= 0 ? line.slice(0, idx).trim() : line.trim()
      const value = idx >= 0 ? line.slice(idx + 1).trim() : ''
      const reused = oldRows.find((r) => r.key === key && r.value === value)
      return reused ? { ...reused } : { id: uid(), key, value, enabled: true }
    })
    emit('update:rows', next.length ? next : [createKv()])
    batchMode.value = false
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/shared' as *;

.kv-table {
  width: 100%;
}

.kv-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.kv-batch-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.kv-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

// 行悬停高亮，弱化输入框边框让表格更整洁
.kv-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 4px;
  border-radius: 6px;
  transition: background 0.12s;

  &:hover {
    background: var(--el-fill-color-lighter);
  }

  // :deep(.el-input__wrapper) {
  //   box-shadow: 0 0 0 1px transparent inset;

  //   &:hover {
  //     box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
  //   }

  //   &.is-focus {
  //     box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  //   }
  // }

  :deep(.el-input__inner) {
    font-family: $nr-mono;
    font-size: 12.5px;
    height: 26px;
    line-height: 26px;
  }
}

.kv-check {
  height: auto;
  margin-right: -2px;
}

.kv-input {
  flex: 1;
  min-width: 0;
}

.kv-var-icon {
  color: var(--el-color-warning);
  cursor: help;
}

.kv-delete {
  padding: 4px;
  opacity: 0;
  transition: opacity 0.12s;

  .kv-row:hover & {
    opacity: 1;
  }
}

.kv-add {
  align-self: flex-start;
  margin-top: 2px;
}
</style>
