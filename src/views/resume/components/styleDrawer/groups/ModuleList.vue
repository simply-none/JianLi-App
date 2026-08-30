<template>
  <div class="module-list">
    <div v-for="(m, idx) in modules" :key="m.id" class="module-card" :class="{ 'is-hidden': !m.visible }">
      <!-- 卡片头：显隐 / 名称 / 排序 / 展开 -->
      <div class="card-head" @click="toggleExpand(m.id)">
        <el-tooltip :content="m.visible ? '隐藏模块' : '显示模块'" placement="top">
          <button class="icon-btn" @click.stop="toggleVisible(m)">
            <LucideIcon :name="m.visible ? 'Eye' : 'EyeOff'" :size="14" />
          </button>
        </el-tooltip>
        <span class="card-title">{{ MODULE_LABELS[m.id] }}</span>
        <span class="card-spacer" />
        <el-tooltip content="上移" placement="top">
          <button class="icon-btn" :disabled="idx === 0" @click.stop="move(idx, -1)">
            <LucideIcon name="ArrowUp" :size="13" />
          </button>
        </el-tooltip>
        <el-tooltip content="下移" placement="top">
          <button class="icon-btn" :disabled="idx === modules.length - 1" @click.stop="move(idx, 1)">
            <LucideIcon name="ArrowDown" :size="13" />
          </button>
        </el-tooltip>
        <LucideIcon :name="expandedId === m.id ? 'ChevronUp' : 'ChevronDown'" :size="14" class="expand-icon" />
      </div>

      <!-- 卡片体：按模块类型展开对应配置组 + 原子字段行 -->
      <div v-if="expandedId === m.id" class="card-body" @click.stop>
        <!-- 基本信息 -->
        <template v-if="m.id === 'basics' && m.header">
          <div class="group-caption">头部装饰线</div>
          <LineDecorationGroup :model="m.header.line" @change="notify" />
          <div class="g-row">
            <span class="g-label">姓名-意向间距 {{ m.header.intentGap }}px</span>
            <el-slider v-model="m.header.intentGap" size="small" :min="0" :max="24" class="slider" @input="notify" />
          </div>
          <div class="g-row">
            <span class="g-label">联系行间距 {{ m.header.contactGap }}px</span>
            <el-slider v-model="m.header.contactGap" size="small" :min="0" :max="16" class="slider" @input="notify" />
          </div>
          <div class="group-caption">联系字段顺序</div>
          <div class="order-chips">
            <span v-for="(fid, cIdx) in m.header.contactOrder" :key="fid" class="chip">
              {{ fieldLabel(m.id, fid) }}
              <button class="chip-btn" :disabled="cIdx === 0" @click="moveContact(m, cIdx, -1)">
                <LucideIcon name="ArrowUp" :size="11" />
              </button>
              <button class="chip-btn" :disabled="cIdx === m.header!.contactOrder.length - 1" @click="moveContact(m, cIdx, 1)">
                <LucideIcon name="ArrowDown" :size="11" />
              </button>
            </span>
          </div>
          <SeparatorGroup label="联系分隔" :model="m.header.contactSeparator" @change="notify" />
        </template>

        <!-- 条目型模块（教育/工作/项目） -->
        <template v-else-if="m.title && m.entryHeader && m.list">
          <div class="group-caption">章节标题</div>
          <SectionTitleGroup :model="m.title" @change="notify" />
          <div class="group-caption">条目头</div>
          <EntryHeaderGroup :model="m.entryHeader" :field-labels="ENTRY_FIELD_LABELS[m.id] || {}" @change="notify" />
          <div class="group-caption">描述列表</div>
          <ListStyleGroup :model="m.list" @change="notify" />
        </template>

        <!-- 技能特长 -->
        <template v-else-if="m.id === 'skills' && m.dots">
          <div class="group-caption">章节标题</div>
          <SectionTitleGroup :model="m.title!" @change="notify" />
          <div class="group-caption">熟练度圆点</div>
          <SkillsDotsGroup :model="m.dots" @change="notify" />
        </template>

        <!-- 自我评价 -->
        <template v-else-if="m.id === 'evaluation' && m.title">
          <div class="group-caption">章节标题</div>
          <SectionTitleGroup :model="m.title" @change="notify" />
        </template>

        <!-- 原子字段调试行 -->
        <div class="group-caption">原子字段（实时调试）</div>
        <TextStyleRow
          v-for="meta in MODULE_FIELD_META[m.id]"
          :key="meta.id"
          :label="meta.label"
          :model="ensureField(m, meta.id)"
          @change="notify"
        />
      </div>
    </div>
    <div class="module-tip">模块按此顺序渲染，可用 ↑ ↓ 调整；眼睛控制显隐</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import TextStyleRow from './TextStyleRow.vue'
import LineDecorationGroup from './LineDecorationGroup.vue'
import SeparatorGroup from './SeparatorGroup.vue'
import SectionTitleGroup from './SectionTitleGroup.vue'
import EntryHeaderGroup from './EntryHeaderGroup.vue'
import ListStyleGroup from './ListStyleGroup.vue'
import SkillsDotsGroup from './SkillsDotsGroup.vue'
import { MODULE_FIELD_META, ENTRY_FIELD_LABELS } from './moduleMeta'
import { MODULE_LABELS } from '../../../engine/defaultConfig'
import type { ModuleId, ModuleStyle, TextStyle } from '../../../engine/types'

/**
 * 模块列表（排版核心区）
 * 每个模块一张卡片：显隐/上下移排序/手风琴展开；
 * 展开后按模块类型渲染组件配置组，末尾统一列出原子字段调试行。
 * 直接 mutate 传入的 modules 数组（reactive draft 子树）并通知父级。
 */
const props = defineProps<{
  /** 模块配置数组（draft 内引用，直接修改） */
  modules: ModuleStyle[]
}>()

const emit = defineEmits<{
  /** 配置变更通知 */
  (e: 'change'): void
}>()

/** 当前展开的模块 id（手风琴） */
const expandedId = ref<ModuleId | null>(null)

/** 通知父级配置变更 */
function notify() {
  emit('change')
}

/**
 * 切换手风琴展开
 * @param id 模块 id
 */
function toggleExpand(id: ModuleId) {
  expandedId.value = expandedId.value === id ? null : id
}

/**
 * 切换模块显隐
 * @param m 模块配置
 */
function toggleVisible(m: ModuleStyle) {
  m.visible = !m.visible
  notify()
}

/**
 * 移动模块顺序
 * @param idx 模块下标
 * @param dir 方向（-1 上移 / 1 下移）
 */
function move(idx: number, dir: -1 | 1) {
  const target = idx + dir
  if (target < 0 || target >= props.modules.length) return
  const arr = props.modules
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
  notify()
}

/**
 * 移动联系方式字段顺序
 * @param m 基本信息模块配置
 * @param idx 字段下标
 * @param dir 方向
 */
function moveContact(m: ModuleStyle, idx: number, dir: -1 | 1) {
  const order = m.header!.contactOrder
  const target = idx + dir
  if (target < 0 || target >= order.length) return
  const arr = [...order]
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
  m.header!.contactOrder = arr
  notify()
}

/**
 * 取字段完整样式对象（不存在或为 Partial 时补全一次并写回，之后幂等返回同一引用，
 * 避免每次渲染都新建对象触发递归更新）
 * @param m 模块配置
 * @param fid 字段 id
 * @returns 完整 TextStyle 引用
 */
function ensureField(m: ModuleStyle, fid: string): TextStyle {
  if (!m.fields) m.fields = {}
  const existing = m.fields[fid]
  // 已是完整对象（含 visible 布尔标记）时直接返回，不重复写回
  if (existing && typeof existing.visible === 'boolean') {
    return existing as TextStyle
  }
  const full: TextStyle = {
    visible: true,
    size: 'base',
    weight: 400,
    ink: 900,
    letterSpacing: 0,
    italic: false,
    ...(existing || {}),
  }
  m.fields[fid] = full
  return full
}

/**
 * 取字段显示名
 * @param mid 模块 id
 * @param fid 字段 id
 * @returns 显示名
 */
function fieldLabel(mid: ModuleId, fid: string): string {
  return MODULE_FIELD_META[mid]?.find((f) => f.id === fid)?.label || fid
}
</script>

<style scoped>
.module-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.module-card {
  border: 1px solid var(--skin-border, #e4e4e7);
  border-radius: 8px;
  background: var(--skin-card, #fff);
  overflow: hidden;
}
.module-card.is-hidden .card-title {
  opacity: 0.45;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  cursor: pointer;
}
.card-head:hover {
  background: var(--skin-btn-bg, #f7f7f8);
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--skin-text-primary, #333);
}
.card-spacer {
  flex: 1;
}
.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  padding: 3px;
  border-radius: 4px;
  display: inline-flex;
}
.icon-btn:hover:not(:disabled) {
  background: var(--skin-border, #e4e4e7);
}
.icon-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.expand-icon {
  color: #999;
  flex-shrink: 0;
}
.card-body {
  padding: 4px 10px 10px;
  border-top: 1px solid var(--skin-border, #e4e4e7);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.group-caption {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
.g-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.g-label {
  font-size: 12px;
  color: var(--skin-text-secondary, #666);
  flex-shrink: 0;
  min-width: 96px;
}
.slider {
  flex: 1;
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
.module-tip {
  font-size: 11px;
  color: #bbb;
  text-align: center;
  padding: 4px 0;
}
</style>
