<!--
 * 记账 - 分类选择器（Popover 版）
 * 触发器只占一格：显示已选分类的图标 + 名称；未选分类时若有智能推荐，
 * 则展示推荐分类并带「智能」角标（回车保存即采纳），完全未选时显示「选择分类」。
 * 面板内以网格 chips 点选，选中即关闭；分类较多时面板内滚动。
 * 注：teleported=false —— 让浮层留在组件内部，从而继承小窗口的皮肤 CSS 变量
 *     （.accounting-page.compact 里把应用主题变量重映射为皮肤变量），子组件无需感知换肤。
-->
<template>
  <el-popover
    v-model:visible="visible"
    trigger="click"
    placement="top-start"
    :width="compact ? 250 : 300"
    :teleported="false"
    :popper-style="{ padding: compact ? '8px' : '10px' }"
  >
    <template #reference>
      <button
        type="button"
        class="cat-trigger"
        :class="{ compact, empty: !displayCat, suggestion: isSuggestion }"
        :style="triggerStyle"
      >
        <LucideIcon
          :name="displayCat ? displayCat.icon : 'Tags'"
          :size="compact ? 14 : 15"
          :color="displayCat ? displayCat.color : 'currentColor'"
        />
        <span class="tg-name">{{ displayCat ? displayCat.name : '选择分类' }}</span>
        <span v-if="isSuggestion" class="tg-badge">智能</span>
        <LucideIcon name="ChevronDown" :size="12" class="tg-arrow" />
      </button>
    </template>

    <!-- 浮层内容：分类网格 -->
    <div class="cat-panel" :class="{ compact }">
      <button
        v-for="cat in categories"
        :key="cat.name"
        type="button"
        class="cat-chip"
        :class="{
          active: modelValue === cat.name,
          matched: matched === cat.name && modelValue !== cat.name,
        }"
        :style="chipStyle(cat)"
        @click="pick(cat.name)"
      >
        <LucideIcon :name="cat.icon" :size="compact ? 13 : 14" :color="cat.color" />
        <span class="cat-name">{{ cat.name }}</span>
        <span v-if="matched === cat.name && modelValue !== cat.name" class="chip-badge">智能</span>
      </button>
      <div v-if="!categories.length" class="cat-empty">暂无分类</div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import type { AccountingCategory } from '@/constants/accounting'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    categories: AccountingCategory[]
    /** 自动匹配推荐的分类名 */
    matched?: string | null
    compact?: boolean
  }>(),
  { modelValue: '', matched: null, compact: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/** 浮层显隐（点选后主动关闭） */
const visible = ref(false)

/** 已选中的分类对象 */
const selectedCat = computed(
  () => props.categories.find((c) => c.name === props.modelValue) || null,
)
/** 智能推荐的分类对象 */
const matchedCat = computed(() =>
  props.matched ? props.categories.find((c) => c.name === props.matched) || null : null,
)
/** 触发器展示用分类：优先已选，其次推荐 */
const displayCat = computed(() => selectedCat.value || matchedCat.value)
/** 当前展示的是「推荐」而非「已选」 */
const isSuggestion = computed(() => !selectedCat.value && !!matchedCat.value)

/** 触发器配色：已选用实色描边，推荐用虚线描边 */
const triggerStyle = computed(() => {
  const cat = displayCat.value
  if (!cat) return {}
  if (isSuggestion.value) {
    return { borderColor: cat.color, borderStyle: 'dashed', color: 'var(--text-secondary, #606266)' }
  }
  return {
    borderColor: cat.color,
    background: `color-mix(in srgb, ${cat.color} 12%, transparent)`,
    color: cat.color,
  }
})

/** 面板内 chip 配色：选中态用分类色描边/底色，推荐态仅描边 */
function chipStyle(cat: AccountingCategory) {
  if (props.modelValue === cat.name) {
    return {
      borderColor: cat.color,
      background: `color-mix(in srgb, ${cat.color} 14%, transparent)`,
      color: cat.color,
    }
  }
  if (props.matched === cat.name) {
    return { borderColor: cat.color, background: 'transparent' }
  }
  return {}
}

/** 点选分类：提交并关闭浮层 */
function pick(name: string) {
  emit('update:modelValue', name)
  visible.value = false
}
</script>

<style scoped lang="scss">
/* ===== 触发器 ===== */
.cat-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  max-width: 100%;
  border: 1px solid var(--border-subtle, #dcdfe6);
  border-radius: 8px;
  background: var(--bg-card, #fff);
  color: var(--text-primary, #303133);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;

  &:hover {
    border-color: var(--color-primary, #409eff);
  }

  &.empty {
    color: var(--text-muted, #a8abb2);
  }

  .tg-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tg-badge {
    flex-shrink: 0;
    font-size: 10px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 5px;
    background: var(--color-primary, #409eff);
    color: #fff;
  }

  .tg-arrow {
    flex-shrink: 0;
    opacity: 0.55;
  }

  &.compact {
    height: 28px;
    padding: 0 8px;
    font-size: 12px;
    gap: 5px;
  }
}

/* ===== 浮层内分类网格（teleported=false，但非 .cat-trigger 后代，故写为顶层选择器） ===== */
.cat-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 220px;
  overflow: auto;

  .cat-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid var(--border-subtle, #e4e7ed);
    border-radius: 999px;
    background: var(--bg-card, #fff);
    color: var(--text-primary, #303133);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.18s ease;

    &:hover {
      border-color: var(--color-primary, #409eff);
    }

    &.active {
      font-weight: 600;
    }

    .cat-name {
      white-space: nowrap;
    }

    .chip-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      font-size: 10px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 6px;
      background: var(--color-primary, #409eff);
      color: #fff;
    }
  }

  .cat-empty {
    width: 100%;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted, #a8abb2);
    padding: 10px 0;
  }

  &.compact {
    gap: 6px;
    max-height: 180px;

    .cat-chip {
      padding: 4px 8px;
      font-size: 12px;
    }
  }
}
</style>
