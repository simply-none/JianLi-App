<template>
  <div class="rule-editor">
    <div class="editor-header">
      <span class="header-title">字段规则</span>
      <span class="header-tip">选择器支持 CSS 与 P 选择器：text/文本、xpath//xx、aria/标签、&gt;&gt;&gt; 穿透 Shadow DOM</span>
      <el-button size="small" type="primary" plain @click="addRule">添加字段</el-button>
    </div>

    <div v-if="!rules.length" class="empty-tip">暂无字段规则，请点击「添加字段」</div>

    <div v-for="(rule, index) in rules" :key="index" class="rule-row">
      <div class="rule-main">
        <el-input
          v-model="rule.field"
          class="input-field"
          size="small"
          placeholder="字段名"
          title="结果记录中的键名"
        />
        <el-input
          v-model="rule.selector"
          class="input-selector"
          size="small"
          placeholder="选择器，如 .title 或 text/评分"
          title="支持 CSS / text/ / xpath// / aria/ / >>>"
        />
        <el-select v-model="rule.attr" class="input-attr" size="small" title="取值属性">
          <el-option v-for="a in attrOptions" :key="a.value" :label="a.label" :value="a.value" />
        </el-select>
        <el-button size="small" text type="danger" @click="removeRule(index)">删除</el-button>
      </div>
      <div class="rule-extra">
        <el-checkbox v-model="rule.optional" size="small" title="元素不存在时该字段留空">允许缺失</el-checkbox>
        <el-checkbox v-if="!itemMode" v-model="rule.multiple" size="small" title="命中多个元素时取全部（产出数组）">多值</el-checkbox>
        <el-select
          :model-value="getTransformTypes(rule)"
          class="input-transform"
          size="small"
          multiple
          collapse-tags
          placeholder="变换（可选）"
          title="取值后的处理管道，按序执行"
          @update:model-value="(types: string[]) => setTransformTypes(rule, types)"
        >
          <el-option v-for="(t, i) in transformPresets" :key="i" :label="t.label" :value="t.type" />
        </el-select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 字段规则编辑器
 * ------------------------------------------------------------------
 * 编辑采集字段规则列表（字段名/选择器/取值属性/多值/变换管道），
 * 直接修改传入的规则数组（引用透传，父组件即配置对象）。
 * 变换下拉为常用预设；replace/split 等高级变换可在 JSON 编辑器中手工填写。
 */
import type { FieldRule, TransformStep } from '../../types'
import { createEmptyRule } from '../../config/defaults'

/** 组件属性 */
const props = defineProps<{
  /** 字段规则数组（引用透传，原地修改） */
  rules: FieldRule[];
  /** 是否列表模式（列表模式隐藏多值选项） */
  itemMode?: boolean;
}>()

/** 取值属性选项 */
const attrOptions = [
  { label: '文本 text', value: 'text' },
  { label: '内HTML html', value: 'html' },
  { label: '外HTML outerHTML', value: 'outerHTML' },
  { label: '链接 href', value: 'href' },
  { label: '图片 src', value: 'src' },
  { label: '值 value', value: 'value' },
  { label: 'title 属性', value: 'title' },
  { label: 'alt 属性', value: 'alt' },
  { label: 'data-* 属性', value: 'data-value' },
]

/** 常用变换预设（replace/split 等高级变换可在 JSON 编辑器中手工配置） */
const transformPresets = [
  { label: 'trim 去空格', type: 'trim' },
  { label: 'number 转数字', type: 'number' },
  { label: 'date 转日期', type: 'date' },
]

/**
 * 读取规则当前启用的变换类型列表（供多选框回显）
 * @param rule 字段规则
 * @returns 变换类型数组
 */
function getTransformTypes(rule: FieldRule): string[] {
  return (rule.transforms || []).map((t) => t.type)
}

/**
 * 按选中的变换类型重建规则的变换管道（顺序固定为 presets 顺序）
 * @param rule 字段规则（原地修改）
 * @param types 选中的变换类型数组
 */
function setTransformTypes(rule: FieldRule, types: string[]): void {
  const steps: TransformStep[] = []
  for (const preset of transformPresets) {
    if (!types.includes(preset.type)) continue
    if (preset.type === 'date') {
      steps.push({ type: 'date', format: 'YYYY-MM-DD HH:mm:ss' })
    } else {
      steps.push({ type: preset.type } as TransformStep)
    }
  }
  rule.transforms = steps
}

/**
 * 添加一条空白规则
 */
function addRule(): void {
  props.rules.push(createEmptyRule())
}

/**
 * 删除指定位置规则
 * @param index 规则下标
 */
function removeRule(index: number): void {
  props.rules.splice(index, 1)
}
</script>

<style scoped>
.rule-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.editor-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-title {
  font-weight: 600;
  font-size: 13px;
}
.header-tip {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.empty-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 8px 0;
}
.rule-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.rule-main {
  display: flex;
  gap: 6px;
  align-items: center;
}
.input-field {
  width: 140px;
}
.input-selector {
  flex: 1;
}
.input-attr {
  width: 130px;
}
.rule-extra {
  display: flex;
  gap: 12px;
  align-items: center;
}
.input-transform {
  width: 240px;
}
</style>
