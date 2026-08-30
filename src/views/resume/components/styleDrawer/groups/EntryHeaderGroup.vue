<template>
  <div class="entry-header-group">
    <div class="group-caption">条目头字段（顺序可调，如 学校 · 专业 · 学历）</div>
    <!-- 字段顺序 chips：上移/下移调整渲染顺序 -->
    <div class="order-chips">
      <span v-for="(fid, idx) in model.fieldOrder" :key="fid" class="chip">
        {{ fieldLabels[fid] || fid }}
        <button class="chip-btn" :disabled="idx === 0" title="前移" @click="moveField(idx, -1)">
          <LucideIcon name="ArrowUp" :size="11" />
        </button>
        <button class="chip-btn" :disabled="idx === model.fieldOrder.length - 1" title="后移" @click="moveField(idx, 1)">
          <LucideIcon name="ArrowDown" :size="11" />
        </button>
      </span>
    </div>
    <SeparatorGroup label="字段分隔" :model="model.separator" @change="notify" />

    <div class="group-caption">条目头基础样式（各字段可在「字段」区覆盖）</div>
    <TextStyleRow label="条目头" :model="model.textStyle" @change="notify" />

    <div class="group-caption">日期</div>
    <div class="g-row">
      <span class="g-label">位置</span>
      <el-radio-group v-model="model.datePlacement" size="small" @change="notify">
        <el-radio-button value="right">同行右端</el-radio-button>
        <el-radio-button value="inline">条目头后</el-radio-button>
        <el-radio-button value="hide">隐藏</el-radio-button>
      </el-radio-group>
      <span class="g-label">连接符</span>
      <el-select v-model="model.dateConnector" size="small" class="conn-select" @change="notify">
        <el-option value="–" label="– 短横" />
        <el-option value="~" label="~ 波浪" />
        <el-option value="至" label="至" />
        <el-option value=" " label="空格" />
      </el-select>
    </div>
    <TextStyleRow label="日期" :model="model.dateStyle" @change="notify" />
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue'
import TextStyleRow from './TextStyleRow.vue'
import SeparatorGroup from './SeparatorGroup.vue'
import type { EntryHeaderStyle } from '../../../engine/types'

/**
 * 条目头配置组
 * 字段顺序（chips 前后移）+ 分隔符 + 基础样式 + 日期（位置/连接符/样式）。
 * 模板与函数统一动态访问 props.model（不缓存引用），mutate 后通知父级。
 */
const props = defineProps<{
  /** 条目头配置（draft 内引用） */
  model: EntryHeaderStyle
  /** 条目头字段 id → 显示名映射 */
  fieldLabels: Record<string, string>
}>()

const emit = defineEmits<{
  /** 配置变更通知 */
  (e: 'change'): void
}>()

/** 通知父级配置变更 */
function notify() {
  emit('change')
}

/**
 * 移动字段顺序
 * @param idx 字段下标
 * @param dir 方向（-1 前移 / 1 后移）
 */
function moveField(idx: number, dir: -1 | 1) {
  const order = props.model.fieldOrder
  const target = idx + dir
  if (target < 0 || target >= order.length) return
  const arr = [...order]
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
  props.model.fieldOrder = arr
  notify()
}
</script>

<style scoped>
.entry-header-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.group-caption {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
.order-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  padding: 2px 6px;
  border: 1px solid var(--skin-border, #e4e4e7);
  border-radius: 6px;
  background: var(--skin-btn-bg, #f7f7f8);
}
.chip-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  padding: 2px;
  border-radius: 3px;
  display: inline-flex;
}
.chip-btn:hover:not(:disabled) {
  background: var(--skin-border, #e4e4e7);
}
.chip-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.g-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.g-label {
  font-size: 12px;
  color: var(--skin-text-secondary, #666);
}
.conn-select {
  width: 96px;
}
</style>
