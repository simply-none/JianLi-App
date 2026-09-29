<template>
  <div class="provider-form">
    <!-- 零配置源提示 -->
    <div v-if="summary.zeroConfig" class="zero-hint">
      <LucideIcon name="CircleCheck" :size="14" :stroke-width="1.8" />
      <span>该数据源无需配置，开箱即用。</span>
    </div>

    <!-- 动态表单字段 -->
    <div v-for="field in visibleFields" :key="field.key" class="form-row">
      <div class="row-label">
        <span>{{ field.label }}</span>
        <span v-if="field.required" class="req">*</span>
      </div>

      <!-- 下拉 -->
      <el-select
        v-if="field.type === 'select'"
        :model-value="valueOf(field)"
        size="small"
        class="row-control"
        @update:model-value="(v: string) => setValue(field, v)"
      >
        <el-option
          v-for="opt in field.options || []"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <!-- 文本域（私钥） -->
      <el-input
        v-else-if="field.type === 'textarea'"
        :model-value="valueOf(field)"
        type="textarea"
        :rows="4"
        size="small"
        :placeholder="field.placeholder || secretPlaceholder(field)"
        class="row-control"
        @update:model-value="(v: string) => setValue(field, v)"
      />

      <!-- 密码 -->
      <el-input
        v-else-if="field.type === 'password'"
        :model-value="valueOf(field)"
        type="password"
        show-password
        size="small"
        :placeholder="field.placeholder || secretPlaceholder(field)"
        class="row-control"
        @update:model-value="(v: string) => setValue(field, v)"
      />

      <!-- 数字 -->
      <el-input-number
        v-else-if="field.type === 'number'"
        :model-value="Number(valueOf(field)) || 0"
        :controls="false"
        size="small"
        class="row-control"
        @update:model-value="(v: number | undefined) => setValue(field, v == null ? '' : String(v))"
      />

      <!-- 单行文本 -->
      <el-input
        v-else
        :model-value="valueOf(field)"
        size="small"
        :placeholder="field.placeholder || ''"
        class="row-control"
        @update:model-value="(v: string) => setValue(field, v)"
      />

      <!-- 已配置的敏感字段提示 -->
      <div v-if="field.secret && secretStatus(field)" class="row-hint secret">
        已保存：{{ secretStatus(field)!.preview }}（留空则保持不变）
      </div>
      <div v-else-if="field.help" class="row-hint">{{ field.help }}</div>
    </div>

    <!-- 支持的能力清单 -->
    <div class="cap-section">
      <div class="cap-title">该数据源支持的展示字段</div>
      <div v-for="(grp, gKey) in CAPABILITY_GROUP" :key="gKey" class="cap-group">
        <div class="cap-group-label">{{ grp.label }}</div>
        <div class="cap-tags">
          <span
            v-for="cap in grp.caps"
            :key="cap"
            class="cap-tag"
            :class="{ on: summary.capabilities.includes(cap) }"
          >
            {{ capabilityLabel(cap) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { CAPABILITY_GROUP, capabilityLabel } from '../capability'
import type { ProviderConfigField, ProviderSummary, SecretStatus } from '../types'

/** 组件 Props */
const props = defineProps<{
  /** 数据源快照 */
  summary: ProviderSummary
  /** 当前表单值（key → 值） */
  modelValue: Record<string, string>
  /** 敏感字段状态（键形如 `qweather.privateKey`） */
  secretStatusMap: Record<string, SecretStatus>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: Record<string, string>): void
}>()

/** 条件字段是否生效（when 条件全部满足） */
function isActive(field: ProviderConfigField): boolean {
  if (!field.when) return true
  return Object.entries(field.when).every(([k, v]) => (props.modelValue[k] ?? fieldDefault(k)) === v)
}

/** 取某字段的默认值 */
function fieldDefault(key: string): string {
  const f = props.summary.configSchema.find((x) => x.key === key)
  return f?.default ?? ''
}

/** 当前可见的字段（按 when 条件过滤） */
const visibleFields = computed(() => props.summary.configSchema.filter(isActive))

/** 取字段当前值（无值时回退默认值） */
function valueOf(field: ProviderConfigField): string {
  const v = props.modelValue[field.key]
  if (v !== undefined) return v
  return field.default ?? ''
}

/** 写入字段值 */
function setValue(field: ProviderConfigField, v: string): void {
  emit('update:modelValue', { ...props.modelValue, [field.key]: v })
}

/** 取敏感字段的已存状态 */
function secretStatus(field: ProviderConfigField): SecretStatus | undefined {
  if (!field.secret) return undefined
  const st = props.secretStatusMap[`${props.summary.id}.${field.key}`]
  return st?.configured ? st : undefined
}

/** 敏感字段占位提示 */
function secretPlaceholder(field: ProviderConfigField): string {
  return secretStatus(field) ? '留空则保持已保存的值' : '请输入'
}
</script>

<style scoped lang="scss">
.provider-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.zero-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
  color: #67c23a;
  background: rgba(103, 194, 58, 0.08);
  border: 1px solid rgba(103, 194, 58, 0.2);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .row-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--el-text-color-primary);

    .req {
      color: var(--el-color-danger);
    }
  }

  .row-control {
    width: 100%;
  }

  .row-hint {
    font-size: 0.72rem;
    line-height: 1.5;
    color: var(--el-text-color-secondary);

    &.secret {
      color: var(--el-color-warning);
    }
  }
}

.cap-section {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px dashed var(--el-border-color-lighter);

  .cap-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 10px;
  }

  .cap-group {
    margin-bottom: 10px;

    .cap-group-label {
      font-size: 0.74rem;
      color: var(--el-text-color-secondary);
      margin-bottom: 6px;
    }

    .cap-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

      .cap-tag {
        padding: 2px 9px;
        border-radius: 999px;
        font-size: 0.7rem;
        color: var(--el-text-color-disabled);
        background: var(--el-fill-color-light);
        border: 1px solid var(--el-border-color-lighter);

        &.on {
          color: var(--el-color-primary);
          background: var(--el-color-primary-light-9);
          border-color: var(--el-color-primary-light-7);
        }
      }
    }
  }
}
</style>
