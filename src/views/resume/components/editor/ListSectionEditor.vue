<template>
  <div class="list-section-editor">
    <!-- 条目卡片列表 -->
    <div v-for="(item, idx) in items" :key="idx" class="item-card">
      <div class="item-head">
        <span class="item-index">{{ idx + 1 }}</span>
        <span class="item-summary">{{ summarize(item) || `未填写${title}` }}</span>
        <div class="item-actions">
          <el-tooltip content="上移" placement="top">
            <el-button text size="small" :disabled="idx === 0" @click="move(idx, -1)">
              <LucideIcon name="ChevronUp" :size="14" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="下移" placement="top">
            <el-button text size="small" :disabled="idx === items.length - 1" @click="move(idx, 1)">
              <LucideIcon name="ChevronDown" :size="14" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="删除" placement="top">
            <el-button text size="small" type="danger" @click="remove(idx)">
              <LucideIcon name="Trash2" :size="14" />
            </el-button>
          </el-tooltip>
        </div>
      </div>
      <div class="item-fields">
        <el-row v-for="(row, rIdx) in fieldRows" :key="rIdx" :gutter="10">
          <el-col v-for="f in row" :key="f.key" :span="f.span">
            <el-form-item :label="f.label">
              <el-input
                v-if="(f.type || 'input') === 'input'"
                :model-value="item[f.key]"
                :placeholder="f.placeholder || ''"
                :maxlength="f.maxlength || 100"
                @update:model-value="setField(idx, f.key, $event)"
              />
              <el-input
                v-else
                :model-value="item[f.key]"
                type="textarea"
                :rows="f.rows || 3"
                :placeholder="f.placeholder || ''"
                @update:model-value="setField(idx, f.key, $event)"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </div>
    </div>

    <!-- 空态提示 -->
    <div v-if="items.length === 0" class="empty-tip">暂无{{ title }}，点击下方按钮添加</div>

    <!-- 添加条目 -->
    <el-button class="add-btn" plain size="small" @click="addItem">
      <LucideIcon name="Plus" :size="14" />
      <span>添加{{ title }}</span>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'

/** 单个字段定义 */
export interface FieldDef {
  /** 字段键名（对应条目对象属性） */
  key: string
  /** 字段标签 */
  label: string
  /** 占位提示 */
  placeholder?: string
  /** 输入类型：input 单行 / textarea 多行，默认 input */
  type?: 'input' | 'textarea'
  /** 栅格占比（el-col span，合计不超 24），默认 12 */
  span?: number
  /** textarea 行数，默认 3 */
  rows?: number
  /** 最大输入长度 */
  maxlength?: number
}

/**
 * 通用列表章节编辑器（教育背景/工作经历/项目经验复用）
 * 条目为任意对象数组，通过 fields 定义每个条目的表单字段，
 * 支持 添加/删除/上移/下移，变更通过 update:items 通知父组件。
 */
const props = defineProps<{
  /** 章节标题（如「教育背景」） */
  title: string
  /** 字段定义列表（按行分组，span 合计 ≤ 24） */
  fields: FieldDef[]
  /** 条目数组（结构由 fields 决定，弱类型以兼容各章节条目） */
  items: any[]
  /** 折叠头摘要字段键（如 company / school） */
  mainKey?: string
}>()

const emit = defineEmits<{
  /** 条目数组变更时触发 */
  (e: 'update:items', value: any[]): void
}>()

/** 字段按 span 自动分组成行（每行 span 合计 ≤ 24） */
const fieldRows = computed<FieldDef[][]>(() => {
  const rows: FieldDef[][] = []
  let cur: FieldDef[] = []
  let acc = 0
  for (const f of props.fields) {
    const span = f.span || 12
    if (acc + span > 24) {
      rows.push(cur)
      cur = []
      acc = 0
    }
    cur.push(f)
    acc += span
  }
  if (cur.length > 0) rows.push(cur)
  return rows
})

/**
 * 更新指定条目的字段值
 * @param idx 条目下标
 * @param key 字段键
 * @param value 新值
 */
function setField(idx: number, key: string, value: any) {
  const next = props.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it))
  emit('update:items', next)
}

/**
 * 移动条目顺序
 * @param idx 条目下标
 * @param dir 方向（-1 上移 / 1 下移）
 */
function move(idx: number, dir: -1 | 1) {
  const target = idx + dir
  if (target < 0 || target >= props.items.length) return
  const next = [...props.items]
  ;[next[idx], next[target]] = [next[target], next[idx]]
  emit('update:items', next)
}

/**
 * 删除条目
 * @param idx 条目下标
 */
function remove(idx: number) {
  emit('update:items', props.items.filter((_, i) => i !== idx))
}

/**
 * 生成条目折叠头摘要文本（主字段 + 时间字段）
 * @param item 条目对象
 * @returns 摘要文本
 */
function summarize(item: Record<string, any>): string {
  const parts: string[] = []
  const main = props.mainKey && item[props.mainKey] ? String(item[props.mainKey]) : ''
  const timeKeys = ['startTime', 'endTime'].filter((k) => item[k])
  if (main) parts.push(main)
  if (timeKeys.length === 2) parts.push(`${item.startTime} ~ ${item.endTime}`)
  return parts.join('　')
}

/**
 * 新增一条空白条目（各字段按 fields 定义初始化为空串）
 */
function addItem() {
  const blank: Record<string, any> = {}
  for (const f of props.fields) blank[f.key] = ''
  emit('update:items', [...props.items, blank])
}
</script>

<style scoped>
.item-card {
  border: 1px solid var(--skin-border, #e4e4e7);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--skin-card, #ffffff);
}
.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.item-index {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--skin-btn-bg, #f0f0f0);
  color: var(--skin-text-primary, #333);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.item-summary {
  flex: 1;
  font-size: 12px;
  color: var(--skin-text-secondary, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-actions {
  display: flex;
  align-items: center;
  gap: 0;
}
.item-fields :deep(.el-form-item) {
  margin-bottom: 6px;
}
.empty-tip {
  text-align: center;
  font-size: 12px;
  color: #999;
  padding: 12px 0;
}
.add-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
</style>
