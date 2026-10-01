<!--
  思维导图 —— 自定义节点（原子组件）。

  职责边界：只管「一个节点长什么样、被点时做什么」，不关心树怎么排、坐标怎么算。
      · 文本显示 / 内联编辑互斥（编辑态渲染 MindNodeEditor）
      · Handle 按布局方向分组：左右类用左右 Handle，`down` 用上下 Handle
      · 有子节点时在「子节点生长的那一侧」浮出一个折叠圆钮（`down` 时在下边缘）
      · 带分支色时描边与色条跟随；带备注时右上角浮一个小标记
      · 带背景色 / 文字色时覆盖层级默认底色与主题默认字色（三者互相独立）
      · 右键把「节点 id + 视口坐标 + 节点锚点矩形」报给 useMindView，菜单本体在 MindNodeMenu.vue
        —— 本组件不渲染菜单：菜单必须 teleport 到 body，而这里是 vue-flow 的
           节点插槽内部（在带 transform 的 viewport 里，菜单会被一起缩放/平移）。

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
    :class="[
      `mind-node--${levelClass}`,
      {
        'is-selected': isSelected,
        'is-primary': isPrimarySelection,
        'is-drop-target': data.dropTarget === true,
        'is-editing': isEditing,
        nodrag: isEditing,
      },
    ]"
    :data-branch="data.branch || undefined"
    :style="nodeStyle"
    @click.stop="onClick"
    @dblclick.stop="onDblClick"
    @contextmenu="onContextMenu"
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

    <!-- 链接徽标：只有真正设了链接才出现；**点它才开链接**，单击节点仍是选中 / 拖动 -->
    <button
      v-if="data.hasLink"
      type="button"
      class="mind-node__link nodrag"
      :title="data.link"
      @click.stop="onOpenLink"
      @dblclick.stop
      @pointerdown.stop
    >
      <LucideIcon name="ExternalLink" :size="9" />
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
    <template v-else>
      <!-- 图标（emoji）：排在文本左侧，宽度已在 `measure.ts` 里计入估算 -->
      <span v-if="data.icon" class="mind-node__icon">{{ data.icon }}</span>
      <span class="mind-node__text">{{ data.text }}</span>
    </template>

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
import { HANDLE, branchVar, fontSizeOf, nodeHandles, toneSoftVar, toneVar } from '../constants'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindView } from '../composables/useMindView'
import type { MindFlowNodeData, MindMenuAnchor } from '../types'
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

const isSelected = computed(() => mind.selectedIds.value.has(props.id))
/**
 * 「主选中」：多选时有且仅有一个节点是主选中（`useMindDoc` 的不变式：
 * 它是**最后进入集合的那个**）。给它一圈更亮的描边，让用户知道
 * 「Tab / Enter / 粘贴」这些单节点操作会落在谁身上。
 */
const isPrimarySelection = computed(
  () => isSelected.value && mind.selectedIds.value.size > 1 && mind.selectedId.value === props.id,
)
const isEditing = computed(() => mind.editingId.value === props.id)

const isRoot = computed(() => props.data.isRoot)
const side = computed(() => props.data.side)

/** 是否左右类布局（`down` 用上下 Handle，折叠钮也换边） */
const horizontal = computed(() => props.data.dir !== 'down')

/**
 * 层级档位类名 —— 只承载**字重 / 描边 / 底色**（字号已改为内联给出，见 `nodeStyle`）。
 * 档位划分与 `constants.fontSizeOf` / `fontWeightOf` 的层级判断保持一致（根 / 一级 / 其余）。
 */
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

/* ---------------------------------------------------- 分支色 / 背景 / 文字 */

/**
 * 节点的**内联样式**（外观色 + 文档级版式）。
 *
 * 一、颜色：三者都只从 data 里拿到 **key**，这里映射成 CSS 变量：
 *   `--mm-node-accent`     分支色实色（描边 + 左缘色条，旧行为）
 *   `--mm-node-bg-user`    背景色低透铺底
 *   `--mm-node-text-user`  文字色实色
 *
 * 变量本身定义在 MindCanvas / palette.scss 的色板作用域里（用主题令牌派生），
 * 因此换主题时节点、色条与连线会一起变，不需要写任何 JS 判断。
 *
 * ⚠️ 用「用户变量 + 层级默认值」的 fallback 链（见下方 CSS 的
 *    `var(--mm-node-bg-user, var(--mm-root-bg))`）而不是直接覆盖 background：
 *    层级默认底色是按层级分档的（根 / 一级 / 更深各不相同），
 *    只有把默认值留在 fallback 位置，才能做到「没设背景色时完全维持原样」。
 *
 * 二、版式（字体 / 字号）：**直接写内联**，不是 CSS 变量。
 *   - `font-size` 由 `fontSizeOf(level, doc.data.fontSize)` 算出。内联样式优先级高于
 *     层级类（原先 `.mind-node--root { font-size: 15px }` 那一组已删掉），
 *     所以「层级档位」只有这一处说了算；
 *   - ⚠️ `utils/measure.ts` 的 `estimateSize` 用的是**同一个函数、同一个基准字号**
 *     ⇒ 「首帧估算 == 实测」这条不变量在改过字号之后依然成立（否则画布会先跳一下）。
 *   - `font-family` **只在文档设过时才写**；未设就不写 ⇒ 节点继承应用的全局字体
 *     （写 `inherit` 也行，但「不写」少一个变量，且与「没设过」在 JSON 里同形）。
 */
const nodeStyle = computed<CSSProperties>(() => {
  const style: Record<string, string> = {}
  if (props.data.branch) style['--mm-node-accent'] = branchVar(props.data.branch)
  if (props.data.bg) style['--mm-node-bg-user'] = toneSoftVar(props.data.bg)
  if (props.data.fg) style['--mm-node-text-user'] = toneVar(props.data.fg)
  style.fontSize = `${fontSizeOf(props.data.level, mind.fontSize.value)}px`
  const family = mind.fontFamily.value
  if (family) style.fontFamily = family
  return style as CSSProperties
})

/* --------------------------------------------------------------- 交互 */

function onClick() {
  mind.select(props.id)
}

function onDblClick() {
  mind.beginEdit(props.id)
}

/**
 * 右键：打开节点操作菜单（新增子节点 / 同级 / 复制 / 重命名 / 折叠 / 备注 / 颜色 / 删除）。
 *
 * 三件事的顺序都有理由：
 * 1. **编辑态直接放行**：内联编辑时右键应该给出浏览器原生菜单（要复制 / 粘贴文本），
 *    所以这里不能挂 `.prevent` 修饰符 —— 那会无条件 preventDefault，
 *    连「用户想复制自己刚敲的字」都做不到。改成在函数里判断后再 preventDefault。
 * 2. **先 select 再开菜单**：菜单里的动作（重命名 / 删除）走的是 `selectedId`，
 *    不先选中就会出现「右键 A、删掉的是 B」这类最说不清的 bug。
 * 3. **阻止冒泡**：否则画布的 pane 处理也会收到这次右键（会把菜单立刻关掉）。
 */
function onContextMenu(event: MouseEvent) {
  if (isEditing.value) return
  event.preventDefault()
  event.stopPropagation()
  mind.select(props.id)
  const [x, y] = anchorOf(event)
  view.openNodeMenu(props.id, x, y, nodeRectOf(event))
}

/**
 * 菜单的**节点锚点矩形**（视口坐标）—— 越界翻转时贴着它展开，见 `MindNodeMenu.place()`。
 *
 * 为什么不能拿光标当翻转基准：光标只是落在节点里的某个**随机角落**，
 * 「节点右下角右键」和「同一节点左上角右键」会算出差出整个菜单尺寸的落点，
 * 表现为「菜单一会儿贴着节点、一会儿飞到屏幕另一头」。
 *
 * 取不到时返回 undefined（`@contextmenu` 就挂在 `.mind-node` 上，理论上不会发生），
 * 由 `place()` 退回「以光标为基准」的老行为 —— 宁可不够好，也不能不开菜单。
 */
function nodeRectOf(event: MouseEvent): MindMenuAnchor | undefined {
  const el = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const rect = el?.getBoundingClientRect()
  if (!rect || (rect.width <= 0 && rect.height <= 0)) return undefined
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
}

/**
 * 菜单锚点。正常右键直接用光标坐标。
 *
 * ⚠️ **没有坐标的 contextmenu 必须兜住**：键盘 Menu 键 / Shift+F10 触发的
 *    contextmenu `clientX/Y` 都是 0；另外「上一个浮层在事件派发中途被移除」时
 *    Chromium 重发的事件也可能是 0 坐标。直接拿来定位会让菜单被 clamp
 *    钉在窗口左上角 —— 「右键菜单偏移太远」的另一半元凶。
 *    这里退回到节点卡片自身的位置（卡片右缘偏下一点），保证菜单总是贴着节点。
 */
function anchorOf(event: MouseEvent): [number, number] {
  if (event.clientX || event.clientY) return [event.clientX, event.clientY]
  const el = event.target instanceof Element ? event.target.closest('.mind-node') : null
  const rect = el?.getBoundingClientRect()
  if (rect) return [rect.right + 4, rect.top + 12]
  return [24, 24]
}

function onFold() {
  mind.toggleFold(props.id)
}

function onOpenNote() {
  mind.select(props.id)
  view.openNodePanel(props.id)
}

/**
 * 打开链接：`window.open(url, '_blank')`。
 *
 * 与 `QrDropZone.vue` 完全一致的做法，**零主进程改动**
 * （`remoteControl` 那条 `open-url` 是远程控制专用通道，不复用）。
 *
 * ⚠️ 这里再挡一次协议白名单：归一化时已经挡过（`utils/tree.ts` 的 `normalizeLink`），
 *    但徽标是一个「把字符串交给浏览器执行」的出口，值得第二次校验 ——
 *    数据可能来自导入、或将来某个没走 normalize 的写入口。
 */
function onOpenLink() {
  const url = props.data.link
  if (!url || !/^https?:\/\//i.test(url)) return
  window.open(url, '_blank')
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
  /* 背景 / 文字色走「用户变量 + 层级默认值」的 fallback 链，未设置时与原来完全一致 */
  background: var(--mm-node-bg-user, var(--mm-node-bg));
  color: var(--mm-node-text-user, var(--mm-node-text));
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

/*
  ---- 层级：根节点主色描边、一级节点淡主色底、更深的层级统一留白 ----

  ⚠️ 这里**刻意不再写 `font-size`**：字号是「文档级可调」的（画布右上角「设置」），
     由 `nodeStyle` 用 `fontSizeOf(level, doc.data.fontSize)` 以内联样式给出，
     而内联优先级高于类选择器 ⇒ 留在这里就是**死代码**，还会误导人「改这里能改字号」。
  （层级 → 字重的对应仍留在下面，与 `constants.fontWeightOf(level)` 一致。）
*/
.mind-node--root {
  border-color: var(--mm-node-accent, var(--mm-root-border));
  background: var(--mm-node-bg-user, var(--mm-root-bg));
  font-weight: 600;
  text-align: center;
}

.mind-node--l1 {
  border-color: var(--mm-node-accent, var(--mm-l1-border));
  background: var(--mm-node-bg-user, var(--mm-l1-bg));
  font-weight: 600;
}

.mind-node--l2 {
  font-weight: 400;
}

.mind-node.is-selected {
  border-color: var(--mm-selected-border);
  box-shadow: 0 0 0 3px var(--mm-selected-glow);
}

/*
  主选中（多选里最后点的那个）用**更亮的一圈**区分：
  灰色多选环容易让人分不清「Tab 会加到谁下面」。三圈叠加的优先级靠后写。
*/
.mind-node.is-primary {
  box-shadow: 0 0 0 3px var(--mm-selected-glow), 0 0 0 6px var(--mm-selected-glow);
}

/* 拖动中的「换父候选」高亮：用虚线环，与实线选中环区分开（它只是候选，还没发生） */
.mind-node.is-drop-target {
  border-color: var(--mm-selected-border);
  box-shadow: 0 0 0 3px var(--mm-selected-glow);
  outline: 2px dashed var(--mm-selected-border);
  outline-offset: 3px;
}

.mind-node.is-editing {
  min-width: 150px;
  border-color: var(--mm-selected-border);
  box-shadow: 0 0 0 3px var(--mm-selected-glow);
  cursor: text;
}

/* 节点图标（emoji）：宽度与 constants.NODE_ICON_WIDTH 对应（18px 盒 + 6px 间距 = 24px） */
.mind-node__icon {
  flex: none;
  width: 18px;
  font-size: 15px;
  line-height: 1;
  text-align: center;
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
    color: var(--mm-node-text-user, var(--mm-node-text));
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

/* ---- 备注浮标（右上角） ---- */
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
    color: var(--mm-node-text-user, var(--mm-node-text));
  }
}

/*
  ---- 链接徽标（左上角） ----
  与备注浮标错开：备注占右上、链接占左上，两个都设了也不会叠在一起。
  与浮标一样是绝对定位，**不占布局空间** —— estimateSize 的估算宽度才等于真实宽度。
*/
.mind-node__link {
  position: absolute;
  left: -7px;
  top: -7px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border: 1px solid var(--mm-link-border);
  border-radius: 50%;
  background: var(--mm-link-bg);
  color: var(--mm-link-text);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: var(--mm-link-bg-hover);
    color: var(--mm-node-text-user, var(--mm-node-text));
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
