<template>
  <div class="action-panel">
    <div class="panel-header">
      <span class="panel-title">交互步骤</span>
      <span class="panel-tip">每页等待完成后、数据抽取前按序执行（搜索/翻页前置操作等）</span>
      <el-button size="small" type="primary" plain @click="addStep">添加步骤</el-button>
    </div>

    <div v-if="!actions.length" class="empty-tip">暂无交互步骤</div>

    <div v-for="(step, index) in actions" :key="index" class="action-row">
      <el-select v-model="step.type" class="input-type" size="small" title="动作类型">
        <el-option-group label="操作">
          <el-option label="输入 input" value="input" />
          <el-option label="点击 click" value="click" />
          <el-option label="双击 doubleClick" value="doubleClick" />
          <el-option label="悬停 hover" value="hover" />
          <el-option label="下拉选择 select" value="select" />
          <el-option label="按键 press" value="press" />
        </el-option-group>
        <el-option-group label="浏览">
          <el-option label="滚动到底 scroll" value="scroll" />
          <el-option label="滚动到元素 scrollTo" value="scrollTo" />
          <el-option label="后退 back" value="back" />
          <el-option label="刷新 reload" value="reload" />
          <el-option label="切换到新标签页 newTab" value="newTab" />
          <el-option label="切换到目标标签页 switchTab" value="switchTab" />
        </el-option-group>
        <el-option-group label="等待">
          <el-option label="固定等待 wait" value="wait" />
          <el-option label="等待元素出现 waitSelector" value="waitSelector" />
          <el-option label="等待跳转 waitNavigation" value="waitNavigation" />
        </el-option-group>
      </el-select>
      <el-input
        v-if="needSelector(step.type)"
        v-model="step.selector"
        class="input-selector"
        size="small"
        placeholder="元素选择器"
      />
      <el-input
        v-if="step.type === 'input'"
        v-model="step.value"
        class="input-value"
        size="small"
        placeholder="输入内容"
      />
      <el-input
        v-if="step.type === 'press'"
        v-model="step.value"
        class="input-value"
        size="small"
        placeholder="键名，如 Enter"
      />
      <el-input
        v-if="step.type === 'select'"
        v-model="step.value"
        class="input-value"
        size="small"
        placeholder="选项 value 值"
      />
      <el-input
        v-if="step.type === 'switchTab'"
        v-model="step.value"
        class="input-value"
        size="small"
        placeholder="URL 或标题关键字（支持正则）"
      />
      <el-input-number
        v-if="step.type === 'wait'"
        v-model="step.ms"
        class="input-ms"
        size="small"
        :min="100"
        :max="60000"
        :step="100"
        title="等待时长（ms）"
      />
      <el-input-number
        v-if="step.type === 'waitSelector' || step.type === 'waitNavigation' || step.type === 'newTab'"
        v-model="step.ms"
        class="input-ms"
        size="small"
        :min="1000"
        :max="60000"
        :step="1000"
        title="超时时长（ms），超时不阻断"
      />
      <div class="row-ops">
        <el-button
          size="small"
          text
          title="上移（步骤按从上到下顺序执行）"
          :disabled="index === 0"
          @click="moveStep(index, -1)"
        >↑</el-button>
        <el-button
          size="small"
          text
          title="下移"
          :disabled="index === actions.length - 1"
          @click="moveStep(index, 1)"
        >↓</el-button>
        <el-button size="small" text type="primary" title="在下方插入一条空步骤" @click="insertStep(index)">
          插入
        </el-button>
        <el-button size="small" text type="danger" @click="removeStep(index)">删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 交互步骤面板
 * ------------------------------------------------------------------
 * 配置每页抽取前的模拟人类浏览操作序列，分三组：
 * 操作（输入/点击/双击/悬停/下拉选择/按键）、
 * 浏览（滚动/后退/刷新/切换新标签页）、
 * 等待（固定等待/等待元素出现/等待跳转）。
 * 步骤全部执行完后才在最终页面上提取数据。
 */
import type { ActionStep } from '../../types'

/** 组件属性（引用透传，原地修改） */
const props = defineProps<{
  /** 交互步骤数组 */
  actions: ActionStep[];
}>()

/** 需要填写选择器的动作类型 */
const SELECTOR_TYPES = ['input', 'click', 'doubleClick', 'hover', 'select', 'waitSelector', 'scrollTo']

/**
 * 判断动作类型是否需要选择器输入框
 * @param type 动作类型
 * @returns 需要选择器时返回 true
 */
function needSelector(type: string): boolean {
  return SELECTOR_TYPES.includes(type)
}

/**
 * 添加一条空白交互步骤（默认输入，追加到末尾）
 */
function addStep(): void {
  props.actions.push({ type: 'input', selector: '', value: '' })
}

/**
 * 上移/下移步骤（步骤按从上到下顺序执行）
 * @param index 步骤下标
 * @param direction -1 上移 / 1 下移
 */
function moveStep(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= props.actions.length) return
  const list = props.actions
  ;[list[index], list[target]] = [list[target], list[index]]
}

/**
 * 在指定步骤下方插入一条空白步骤
 * @param index 插入位置（该步骤之后）
 */
function insertStep(index: number): void {
  props.actions.splice(index + 1, 0, { type: 'input', selector: '', value: '' })
}

/**
 * 删除指定位置步骤
 * @param index 步骤下标
 */
function removeStep(index: number): void {
  props.actions.splice(index, 1)
}
</script>

<style scoped>
.action-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.panel-title {
  font-weight: 600;
  font-size: 13px;
}
.panel-tip {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.empty-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.action-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.input-type {
  width: 130px;
}
.input-selector {
  flex: 1;
}
.input-value {
  flex: 1;
}
.input-ms {
  width: 160px;
}
.row-ops {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.row-ops .el-button {
  margin-left: 0;
  padding: 0 4px;
}
</style>
