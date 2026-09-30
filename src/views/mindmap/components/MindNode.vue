<!--
  思维导图 —— 自定义节点（原子组件）。

  职责边界：只管「一个节点长什么样、被点时做什么」，不关心树怎么排、坐标怎么算。
      · 文本显示 / 内联编辑互斥（编辑态渲染 MindNodeEditor）
      · Handle 按布局方向分组：左右类用左右 Handle，`down` 用上下 Handle
      · 有子节点时在「子节点生长的那一侧」浮出一个折叠圆钮（`down` 时在下边缘）
      · 带分支色时描边与色条跟随；带备注时右上角浮一个小标记

  ⚠️ Handle 的 id 必须取自 constants.HANDLE，且渲染矩阵由 `constants.nodeHandles()` 统一裁定
     （本组件只把它的结果摊成布尔量）。边的 sourceHandle / targetHandle 用的是同一套常量。
     **两边对不上时 vue-flow 不报错、不告警**，只会把锚点兜底成「节点上/下边缘正中」，
     表现为连线绕过节点头顶 —— 排查起来非常费劲，所以必须靠那一条不变量来保证。

  ⚠️ 折叠钮与备注标记都是**绝对定位浮在节点外侧**的，不占布局空间 ——
     这样 estimateSize 的估算宽度才会等于节点的真实宽度（vue-flow 量的是 shrink-wrap 后的盒模型）。

  节点位置：默认由 `utils/layout.ts` 自动排。用户拖过的节点会把坐标写进 `node.pos`
  （见 types.ts 的说明），此后布局尊重这个坐标 —— 本组件不需要知道这件事。

  Handle 渲染矩阵（source = 向下连线，target = 被连线）：
      布局方向   节点       左侧 / 上侧          右侧 / 下侧
      左右类     根         source l-out         source r-out      （根两侧都长，且无父可连）
      左右类     右侧子节点  target l-in          source r-out
      左右类     左侧子节点  source l-out         target r-in
      向下       根         —                    source b-out
      向下       子节点      target t-in          source b-out
-->
<template>
  <div
    class="mind-node"
    :class="[`mind-node--${levelClass}`, { 'is-selected': isSelected, 'is-editing': isEditing, nodrag: isEditing }]"
    :data-branch="data.branch || undefined"
    :style="accentStyle"
    @click.stop="onClick"
    @dblclick.stop="onDblClick"
  >
    <!-- 备注浮标：有备注才出现，点它打开「节点属性」弹窗 -->
    <button
      v-if="data.hasNote"
      type="button"
      class="mind-node__note nodrag"
      title="查看 / 编辑备注"
      @click.stop="onOpenNote"
      @dblclick.stop
      @pointerdown.stop
    >
      <LucideIcon name="StickyNotePlus" :size="10" />
    </button>

    <!-- ---- 左右类布局的 Handle ---- -->
    <template v-if="horizontal">
      <!-- 左侧：根 → 出；左侧子节点 → 出 / 入 -->
      <Handle
        v-if="showLeftSource"
        :id="HANDLE.leftOut"
        type="source"
        :position="Position.Left"
        class="mind-node__handle"
      />
      <Handle
        v-if="showLeftTarget"
        :id="HANDLE.leftIn"
        type="target"
        :position="Position.Left"
        class="mind-node__handle"
      />
    </template>
    <!-- ---- 向下布局：子节点上侧接收连线 ---- -->
    <template v-else>
      <Handle
        v-if="showTopTarget"
        :id="HANDLE.topIn"
        type="target"
        :position="Position.Top"
        class="mind-node__handle"
      />
    </template>

    <button
      v-if="foldOnLeft"
      type="button"
      class="mind-node__fold mind-node__fold--left nodrag"
      :title="data.collapsed ? '展开子节点' : '折叠子节点'"
      @click.stop="onFold"
      @dblclick.stop
      @pointerdown.stop
    >
      {{ data.collapsed ? '+' : '−' }}
    </button>

    <MindNodeEditor
      v-if="isEditing"
      :model-value="data.text"
      @commit="onEditCommit"
      @cancel="onEditCancel"
    />
    <span v-else class="mind-node__text">{{ data.text }}</span>

    <button
      v-if="foldOnRight"
      type="button"
      class="mind-node__fold mind-node__fold--right nodrag"
      :title="data.collapsed ? '展开子节点' : '折叠子节点'"
      @click.stop="onFold"
      @dblclick.stop
      @pointerdown.stop
    >
      {{ data.collapsed ? '+' : '−' }}
    </button>

    <button
      v-if="foldOnBottom"
      type="button"
      class="mind-node__fold mind-node__fold--bottom nodrag"
      :title="data.collapsed ? '展开子节点' : '折叠子节点'"
      @click.stop="onFold"
      @dblclick.stop
      @pointerdown.stop
    >
      {{ data.collapsed ? '+' : '−' }}
    </button>

    <!-- ---- 左右类布局的右侧 Handle ---- -->
    <template v-if="horizontal">
      <Handle
        v-if="showRightSource"
        :id="HANDLE.rightOut"
        type="source"
        :position="Position.Right"
        class="mind-node__handle"
      />
      <Handle
        v-if="showRightTarget"
        :id="HANDLE.rightIn"
        type="target"
        :position="Position.Right"
        class="mind-node__handle"
      />
    </template>
    <!-- ---- 向下布局：父节点下侧发出连线 ---- -->
    <template v-else>
      <Handle
        v-if="showBottomSource"
        :id="HANDLE.bottomOut"
        type="source"
        :position="Position.Bottom"
        class="mind-node__handle"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { Handle, Position } from '@vue-flow/core'

import LucideIcon from '@/components/LucideIcon.vue'
import { HANDLE, branchVar, nodeHandles } from '../constants'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindView } from '../composables/useMindView'
import type { MindFlowNodeData } from '../types'
import MindNodeEditor from './MindNodeEditor.vue'

/**
 * 这是 vue-flow 通过 `#node-mm` 插槽传下来的节点负载。
 * 只声明用得到的两个字段：id 用于回写状态，data 用于渲染。
 */
const props = defineProps<{
  id: string
  data: MindFlowNodeData
}>()

const mind = useMindDoc()
const view = useMindView()

const isSelected = computed(() => mind.selectedId.value === props.id)
const isEditing = computed(() => mind.editingId.value === props.id)

const isRoot = computed(() => props.data.isRoot)
const side = computed(() => props.data.side)

/** 是否左右类布局（`down` 用上下 Handle，折叠钮也换边） */
const horizontal = computed(() => props.data.dir !== 'down')

/** 字号 / 字重档位，与 constants.fontSizeOf 的层级保持一致 */
const levelClass = computed(() => {
  if (isRoot.value) return 'root'
  return props.data.level <= 1 ? 'l1' : 'l2'
})

/* --------------------------------------------------------------- Handle */

/**
 * 该节点要渲染哪些 Handle —— **唯一的判定处是 `constants.nodeHandles()`**，
 * 这里只把它的结果摊成模板用的布尔量。
 *
 * 为什么不让模板自己写条件：Handle id 必须与 `edgeHandles()` 给出的边两端 id 完全一致。
 * 一旦不一致，vue-flow **既不报错也不告警**，只是把锚点兜底成「节点上/下边缘正中」，
 * 表现成「连线绕过节点头顶」这种很难归因的视觉问题（本项目已踩过一次：
 * 旧代码把 `showLeftTarget` / `showRightTarget` 的条件写反了）。
 * 集中到 `nodeHandles()` 之后，「节点渲染的 Handle」与「边请求的 Handle」有了共同来源，
 * 也有了一条可断言的约束。
 */
const handles = computed(() => nodeHandles(isRoot.value, side.value, props.data.dir))

const showLeftSource = computed(() => handles.value.source.includes(HANDLE.leftOut))
const showLeftTarget = computed(() => handles.value.target.includes(HANDLE.leftIn))
const showRightSource = computed(() => handles.value.source.includes(HANDLE.rightOut))
const showRightTarget = computed(() => handles.value.target.includes(HANDLE.rightIn))
/** 向下布局：子节点上侧接收连线 */
const showTopTarget = computed(() => handles.value.target.includes(HANDLE.topIn))
/** 向下布局：所有节点都可向下发出连线（实际只有有子节点的会画出来） */
const showBottomSource = computed(() => handles.value.source.includes(HANDLE.bottomOut))

/* ----------------------------------------------------------- 折叠按钮 */

/**
 * 折叠钮放在「子节点生长的那一侧」：右侧节点放右边、左侧节点放左边、
 * 根节点放右边；`down` 布局统一放**下边缘**。
 */
const foldOnRight = computed(
  () => props.data.hasChildren && horizontal.value && (isRoot.value || side.value === 'right'),
)
const foldOnLeft = computed(
  () => props.data.hasChildren && horizontal.value && !isRoot.value && side.value === 'left',
)
const foldOnBottom = computed(() => props.data.hasChildren && !horizontal.value)

/* --------------------------------------------------------------- 分支色 */

/**
 * 分支色只传 key，这里映射成 CSS 变量。
 * 变量本身定义在 MindCanvas 的非 scoped 样式块里（用主题令牌派生），
 * 因此换主题时节点、色条与连线会一起变，不需要写任何 JS 判断。
 */
const accentStyle = computed<CSSProperties | undefined>(() => {
  const branch = props.data.branch
  if (!branch) return undefined
  return { '--mm-node-accent': branchVar(branch) } as CSSProperties
})

/* --------------------------------------------------------------- 交互 */

function onClick() {
  mind.select(props.id)
}

function onDblClick() {
  mind.beginEdit(props.id)
}

function onFold() {
  mind.toggleFold(props.id)
}

function onOpenNote() {
  mind.select(props.id)
  view.openNodePanel(props.id)
}

function onEditCommit(value: string) {
  mind.renameNode(props.id, value)
  mind.endEdit()
}

function onEditCancel() {
  mind.endEdit()
}
</script>

<style scoped lang="scss">
.mind-node {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 72px;
  max-width: 264px;
  min-height: 34px;
  padding: 8px 14px;
  border: 1px solid var(--mm-node-accent, var(--mm-node-border));
  border-radius: 10px;
  background: var(--mm-node-bg);
  color: var(--mm-node-text);
  box-shadow: var(--mm-node-shadow);
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;

  &:hover {
    border-color: var(--mm-node-accent, var(--mm-node-border-hover));
  }
}

/* ---- 分支色条：只在设了分支色时出现（靠 data-branch 属性选择器判断） ---- */
.mind-node[data-branch]::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 22%;
  bottom: 22%;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--mm-node-accent);
  pointer-events: none;
}

/* ---- 层级：根节点主色描边、一级节点淡主色底、更深的层级统一留白 ---- */
.mind-node--root {
  border-color: var(--mm-node-accent, var(--mm-root-border));
  background: var(--mm-root-bg);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.mind-node--l1 {
  border-color: var(--mm-node-accent, var(--mm-l1-border));
  background: var(--mm-l1-bg);
  font-size: 13.5px;
  font-weight: 600;
}

.mind-node--l2 {
  font-size: 13px;
  font-weight: 400;
}

.mind-node.is-selected {
  border-color: var(--mm-selected-border);
  box-shadow: 0 0 0 3px var(--mm-selected-glow);
}

.mind-node.is-editing {
  min-width: 150px;
  border-color: var(--mm-selected-border);
  box-shadow: 0 0 0 3px var(--mm-selected-glow);
  cursor: text;
}

.mind-node__text {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.4;
}

/* ---- 折叠钮 ---- */
.mind-node__fold {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--mm-node-border);
  border-radius: 50%;
  background: var(--mm-fold-bg);
  color: var(--mm-fold-text);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;

  &:hover {
    border-color: var(--mm-selected-border);
    background: var(--mm-selected-glow);
    color: var(--mm-node-text);
  }
}

.mind-node__fold--right {
  right: -9px;
}

.mind-node__fold--left {
  left: -9px;
}

/* 向下布局：折叠钮挪到下边缘（top 置 auto，transform 换成水平居中） */
.mind-node__fold--bottom {
  top: auto;
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
}

/* ---- 备注浮标 ---- */
.mind-node__note {
  position: absolute;
  right: -7px;
  top: -7px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border: 1px solid var(--mm-note-border);
  border-radius: 50%;
  background: var(--mm-note-bg);
  color: var(--mm-note-text);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: var(--mm-note-bg-hover);
    color: var(--mm-node-text);
  }
}

/*
  隐藏 Handle 视觉、只保留「连线锚点」。
  尺寸压到 2px 并清掉默认主题的圆形底 —— vue-flow 对左右 Handle 的定位是
  `translate(±50%, -50%)`（上下同理），所以 2px 的盒中心正好落在节点边框上。
  ⚠️ 必须带 !important：flow.vue 里有一份全局 `.vue-flow__handle { ... !important }`，
     用户先访问过「流程图」页时那份样式会一直挂在文档上，不加 !important 会被它染成灰色药丸。
*/
.mind-node__handle {
  width: 2px !important;
  height: 2px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
</style>
