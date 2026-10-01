<!--
  思维导图 —— 画布（**全应用唯一持有 `<VueFlow>` 的地方**）。

  为什么把 vue-flow 关在一个组件里：
      vue-flow 的 store 是按 id 注册的全局单例，一旦在多个组件里各写一遍 `<VueFlow>`，
      配置（可连线 / 可选中等）就会互相打架。所以这里独占画布，对外只暴露 sync / fit。

  store 隔离：显式指定 `:id="MINDMAP_FLOW_ID"`，与「流程图」模块的默认 store 完全分离
      （不指定 id 时两者会共用同一个默认 store，节点会串到对方画布上）。

  主题：所有 `--mm-*` 语义变量在下方**非 scoped** 的样式块里定义。
      非 scoped 是必须的 —— vue-flow 自己渲染的节点 / 边 / 背景网格都在它的内部 DOM 里，
      拿不到本组件 scoped 样式的作用域属性，只能用 `.mind-canvas` 前缀来圈定范围。

  右键：节点的右键由 `MindNode.vue` 上报、菜单本体 `MindNodeMenu.vue` 挂在**这里**
      （与 `MindZoomBar` 并列）。同时 `<VueFlow>` 上挂了 `@contextmenu.prevent` ——
      在画布范围内屏蔽浏览器原生右键菜单；节点自己的处理会 `stopPropagation`，
      所以节点右键仍然能正常弹出我们自己的菜单。
-->
<template>
  <div
    ref="rootRef"
    class="mind-canvas"
    :class="{ 'is-editing': isEditing, 'is-marquee': marquee.active }"
    @pointerdown.capture="onCanvasPointerDown"
    @dblclick="onCanvasDoubleClick"
  >
    <VueFlow
      :id="MINDMAP_FLOW_ID"
      :min-zoom="0.2"
      :max-zoom="2.5"
      :nodes-draggable="true"
      :nodes-connectable="false"
      :edges-updatable="false"
      :elements-selectable="false"
      :nodes-focusable="false"
      :edges-focusable="false"
      :delete-key-code="null"
      :selection-key-code="null"
      :multi-selection-key-code="null"
      :pan-on-drag="true"
      :select-nodes-on-drag="false"
      :auto-connect="false"
      :fit-view-on-init="false"
      :elevate-edges-on-select="false"
      :node-drag-threshold="4"
      @node-drag-start="graph.onNodeDragStart"
      @node-drag="graph.onNodeDrag"
      @node-drag-stop="graph.onNodeDragStop"
      @pane-click="onPaneClick"
      @contextmenu.prevent
    >
      <!-- 网格点用 currentColor 传入，再由 CSS 决定实际颜色 —— 比在属性里写 var() 更稳 -->
      <Background :gap="22" :size="1.5" color="currentColor" />

      <!-- 自定义节点：插槽名固定为 `node-<type>`，与 buildElements 里的 type:'mm' 对应。
           只透传 id / data —— 把整个 nodeProps 铺开会让 position、events 这类对象
           作为属性落到根 div 上（`position="[object Object]"`），脏 DOM 又没意义。 -->
      <template #node-mm="nodeProps">
        <MindNode :id="nodeProps.id" :data="nodeProps.data" />
      </template>
    </VueFlow>

    <!-- 框选矩形（Shift + 拖拽）：纯展示，命中计算在本组件里做完 -->
    <MindSelectionBox
      v-if="marquee.active"
      :left="marquee.left"
      :top="marquee.top"
      :width="marquee.width"
      :height="marquee.height"
    />

    <!-- 分支聚焦浮条：只在聚焦时出现（自己读单例里的 focusRootId） -->
    <MindFocusBar />

    <!-- MiniMap：本机偏好 + 节点数上限双闸（大图不画，避免几百个 rect 拖慢重排） -->
    <MindMiniMap v-if="showMinimap" />

    <!-- 节点右键菜单：teleport 到 body 的浮层，自己按单例里的 menuNodeId 决定开关 -->
    <MindNodeMenu />

    <!-- 缩放条浮在画布右下角；它自己按 store id 取 vue-flow 视口助手，不需要父级传参 -->
    <MindZoomBar />

    <!-- 画布设置（字体 / 字号）浮在画布右上角：右上角此前是空的（聚焦浮条在顶部居中，
         缩略图与缩放条在右下），放在这里不会与任何现有浮层抢位。 -->
    <MindSettingBar />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'

import { MINDMAP_FLOW_ID, MINIMAP_NODE_LIMIT } from '../constants'
import { useMindActions } from '../composables/useMindActions'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindGraph } from '../composables/useMindGraph'
import { useMindView } from '../composables/useMindView'
import { pointInRect, rectsIntersecting, type MindRect } from '../utils/geometry'
import MindFocusBar from './MindFocusBar.vue'
import MindMiniMap from './MindMiniMap.vue'
import MindNode from './MindNode.vue'
import MindNodeMenu from './MindNodeMenu.vue'
import MindSelectionBox from './MindSelectionBox.vue'
import MindSettingBar from './MindSettingBar.vue'
import MindZoomBar from './MindZoomBar.vue'

const mind = useMindDoc()
const actions = useMindActions()
const view = useMindView()
const graph = useMindGraph()

/** 画布根容器（框选要用它做坐标基准：clientX/Y → 容器内像素） */
const rootRef = ref<HTMLElement>()

/** 内联编辑时把画布的拖拽光标整体收掉，避免出现「文本框里却是抓手」 */
const isEditing = computed(() => Boolean(mind.editingId.value))

/**
 * MiniMap 是否渲染。
 *
 * 两道闸：① 本机偏好（localStorage，见 MINIMAP_STORAGE_KEY）；
 *        ② 节点数上限 —— 超过 MINIMAP_NODE_LIMIT 就不画，几十上百个 `<rect>`
 *           会跟着每次重排一起更新，在大图上是一笔白花的开销。
 */
const showMinimap = computed(
  () => view.minimapOpen.value && mind.nodeCount.value <= MINIMAP_NODE_LIMIT,
)

/** 点空白处取消选中 */
function onPaneClick() {
  mind.clearSelection()
}

/* ------------------------------------------------------- 双击空白处新建 */

/**
 * 双击空白处「就近新建」。
 *
 * 挂在外层容器上而不是 `<VueFlow>` 上：vue-flow 只把 `pane-click` 这类
 * **语义事件**暴露出来，没有 `pane-dblclick`。节点内部的 `@dblclick.stop`
 * 会把节点上的双击拦在节点里，所以冒泡到这里的一定是空白处的双击。
 *
 * 落点：离光标**最近**的节点（`nearestNodeId`，按矩形最近边缘算）——
 * 双击紧贴某个节点时就挂到它下面，符合直觉；空画布时回落到根节点。
 */
function onCanvasDoubleClick(event: MouseEvent) {
  const el = event.target as HTMLElement | null
  // 只处理画布内部（缩放条 / 缩略图 / 素材浮层上的双击不算）
  if (!el?.closest('.vue-flow')) return
  // 节点自己的双击是「改名」，绝不能在这里再建一个
  if (el.closest('.vue-flow__node')) return
  if (mind.editingId.value) return
  event.preventDefault()

  const point = graph.toFlowPoint(event.clientX, event.clientY)
  const target = graph.nearestNodeId(point) ?? mind.tree.value.id
  // addChild 内部已经 syncPrimary + beginEdit，新节点会直接进入内联命名
  mind.addChild(target)
}

/* --------------------------------------------------- Shift + 拖拽框选 */

/**
 * 框选矩形（**相对 `.mind-canvas` 的像素坐标**，与画布坐标不是一回事）。
 * `active` 为假时组件不渲染，这里保留上一帧的几何只是省一次对象分配。
 */
const marquee = ref({ active: false, left: 0, top: 0, width: 0, height: 0 })

/** 拖拽起点（视口坐标）；非空即代表框选进行中 */
let marqueeStart: { clientX: number; clientY: number } | null = null
/** 是否真的拖出了距离（决定「框选」还是「Shift + 单击」） */
let marqueeMoved = false

/** 画布容器的视口矩形（框选的坐标基准） */
function canvasRect(): DOMRect | undefined {
  return rootRef.value?.getBoundingClientRect()
}

/**
 * 容器内的像素矩形 → 画布坐标矩形。
 *
 * 用 `toFlowPoint`（= `screenToFlowCoordinate`）换算**两个对角点**再取包围盒，
 * 而不是「减平移、除缩放」自己算 —— 缩放/平移的换算规则只有 vue-flow 说了算，
 * 自己实现一份迟早与它漂移（坑 36：这里非常容易混用两套坐标）。
 */
function toFlowRect(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): MindRect {
  const p1 = graph.toFlowPoint(a.clientX, a.clientY)
  const p2 = graph.toFlowPoint(b.clientX, b.clientY)
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  }
}

/**
 * 画布上的 pointerdown（**捕获阶段**）。
 *
 * 为什么要捕获 + stopPropagation：`panOnDrag` 的「拖拽平移」与框选抢同一个手势，
 * 而 pan 的监听在 vue-flow 内部的 pane 上（是 `.mind-canvas` 的后代）。
 * 只有在本容器上于**捕获阶段**先拦下，vue-flow 才收不到这次 pointerdown、
 * 不会开始平移；节点也同理不会开始拖动。
 *
 * 不按 Shift 时**完全放行**（连 preventDefault 都不做），保证原有交互一字不改。
 */
function onCanvasPointerDown(event: PointerEvent) {
  if (!event.shiftKey || event.button !== 0) return
  const el = event.target as HTMLElement | null
  if (!el?.closest('.vue-flow')) return
  // 内联编辑中不抢手势：用户可能正在框选文本
  if (mind.editingId.value) return

  event.preventDefault()
  event.stopPropagation()

  const rect = canvasRect()
  if (!rect) return
  marqueeStart = { clientX: event.clientX, clientY: event.clientY }
  marqueeMoved = false
  marquee.value = {
    active: true,
    left: event.clientX - rect.left,
    top: event.clientY - rect.top,
    width: 0,
    height: 0,
  }
  window.addEventListener('pointermove', onMarqueeMove)
  window.addEventListener('pointerup', onMarqueeUp, { once: true })
}

function onMarqueeMove(event: PointerEvent) {
  const start = marqueeStart
  const rect = canvasRect()
  if (!start || !rect) return
  const x1 = start.clientX - rect.left
  const y1 = start.clientY - rect.top
  const x2 = event.clientX - rect.left
  const y2 = event.clientY - rect.top
  // 3px 死区：手抖不该把一次「Shift + 单击」变成 0 面积框选（那会清空选中）
  if (!marqueeMoved && Math.hypot(x2 - x1, y2 - y1) > 3) marqueeMoved = true
  marquee.value = {
    active: true,
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

function onMarqueeUp(event: PointerEvent) {
  window.removeEventListener('pointermove', onMarqueeMove)
  const start = marqueeStart
  marqueeStart = null
  marquee.value = { active: false, left: 0, top: 0, width: 0, height: 0 }
  if (!start) return

  // 没拖出距离 ⇒ 当作「Shift + 单击」：命中节点就选中它，否则清空选中
  if (!marqueeMoved) {
    const point = graph.toFlowPoint(event.clientX, event.clientY)
    const hit = graph.visibleRects().find(item => pointInRect(point, item.rect))
    if (hit) mind.select(hit.id)
    else mind.clearSelection()
    return
  }

  // 真框选：把选框换算成画布坐标，取所有与之相交的可见节点（替换选中集合）
  const ids = rectsIntersecting(toFlowRect(start, event), graph.visibleRects())
  mind.setSelection(ids)
}

/**
 * 重排入口：把 `revision`（结构变了）、`focusToken`（只是要定位）
 * 与 `focusRootId`（换了聚焦子树）**拼成一个键**。
 *
 * 拼在一起不是图省事：搜索命中一个被折叠藏起来的节点时，「展开祖先」（改 revision）
 * 与「定位到它」（改 focusToken）发生在同一次点击里。拼成一个键，Vue 只会触发**一次**
 * 回调；否则会跑两遍同步，其中一遍还可能抢在重排之前定位到旧坐标上。
 * `focusRootId` 同理 —— 进入/退出聚焦必须重排一次（换的是整棵渲染树）。
 *
 * 只有「打开 / 新建 / 切布局 / 进出聚焦」这类整体换代才重新适应画布，其余编辑保持
 * 用户的浏览位置 —— 靠 useMindView 的一次性 fit 信号来区分，而不是每次都 fitView。
 */
watch(
  () => `${mind.revision.value}:${view.focusToken.value}:${view.focusRootId.value}`,
  () => {
    graph.sync({ fit: view.consumeFit(), focus: view.consumeFocus() })
  },
)

onMounted(async () => {
  // 恢复最近一次保存的文档；没有历史记录时保持空白图（bootstrap 内部只真正恢复一次）
  await actions.bootstrap()
  // 挂载时无条件排一次：路由切走再回来时组件是新的，必须重新走一遍
  // 「估算 → 实测 → 重排」链路，否则画布会停在上一轮的旧坐标上。
  // 顺手清掉可能残留的信号，避免下一次编辑时画布莫名其妙跳一下。
  view.consumeFit()
  view.consumeFocus()
  await graph.sync({ fit: true })
})

defineExpose({
  sync: graph.sync,
  fit: () => graph.fitView({ padding: 0.2, duration: 220 }),
})
</script>

<style lang="scss">
/*
  分支色板：与「节点属性」弹窗共用，放在 styles/palette.scss 里统一维护。

  ⚠️ 必须用 `@use`，且**写在所有规则之前** —— `@use` 不允许出现在其它规则之后
     （包括下面两条 plain-CSS `@import`），否则 Sass 直接报
     「@use rules must be written before any other rules.」。

  为什么前移不改变层叠：palette 只声明 `--mm-branch-*`；两个 vue-flow 样式文件
  既不声明也不消费任何 `--mm-*`，与 palette 无同名覆盖、也无先后依赖。

  另：Sass 的 `@import` 已标记弃用、Dart Sass 3.0 将移除，故改用 `@use`。
*/
@use '../styles/palette.scss';

/* vue-flow 基础样式与默认主题：本页可能先于「流程图」页被访问，必须自己引一遍
   （这两条是 plain-CSS `@import`，Sass 原样保留、不触发弃用警告，保持原样） */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

/*
  思维导图的语义色板。
  只使用主题令牌 + color-mix() 派生，不写死任何颜色 —— 26 套主题自动全部适配。

  ⚠️ useMindGraph 里边的 `stroke: var(--mm-line)` / `var(--mm-branch-*)` 也依赖这里：
     SVG 的内联样式同样能解析 var()，所以边与分支色跟着主题走，不需要在 JS 里读主题。
*/
.mind-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);

  /* 连线 */
  --mm-line: color-mix(in srgb, var(--text-muted) 55%, transparent);

  /* 节点 */
  --mm-node-bg: var(--bg-card);
  --mm-node-border: var(--border-subtle);
  --mm-node-border-hover: color-mix(in srgb, var(--color-primary) 40%, transparent);
  --mm-node-text: var(--text-primary);
  --mm-node-shadow: var(--shadow-card);

  /* 根节点与一级节点：主色淡淡铺底，形成视觉层次 */
  --mm-root-bg: color-mix(in srgb, var(--color-primary) 16%, var(--bg-card));
  --mm-root-border: color-mix(in srgb, var(--color-primary) 55%, transparent);
  --mm-l1-bg: color-mix(in srgb, var(--color-primary) 8%, var(--bg-card));
  --mm-l1-border: color-mix(in srgb, var(--color-primary) 30%, var(--border-subtle));

  /* 选中态与折叠钮 */
  --mm-selected-border: var(--color-primary);
  --mm-selected-glow: color-mix(in srgb, var(--color-primary) 30%, transparent);
  --mm-fold-bg: var(--bg-active-btn);
  --mm-fold-text: var(--text-secondary);

  /* 备注标记 */
  --mm-note-bg: color-mix(in srgb, var(--color-warning) 22%, var(--bg-card));
  --mm-note-bg-hover: color-mix(in srgb, var(--color-warning) 40%, var(--bg-card));
  --mm-note-border: color-mix(in srgb, var(--color-warning) 45%, transparent);
  --mm-note-text: var(--color-warning);

  /* 链接标记（用「信息色」这一族，与备注的警示色区分开） */
  --mm-link-bg: color-mix(in srgb, var(--color-info) 22%, var(--bg-card));
  --mm-link-bg-hover: color-mix(in srgb, var(--color-info) 40%, var(--bg-card));
  --mm-link-border: color-mix(in srgb, var(--color-info) 45%, transparent);
  --mm-link-text: var(--color-info);

  /* 框选矩形（Shift + 拖拽） */
  --mm-selection-fill: color-mix(in srgb, var(--color-primary) 12%, transparent);
  --mm-selection-border: color-mix(in srgb, var(--color-primary) 55%, transparent);

  /* 分支聚焦浮条 */
  --mm-focusbar-bg: color-mix(in srgb, var(--color-primary) 14%, var(--bg-card));

  /* 背景网格点 */
  --mm-grid-dot: color-mix(in srgb, var(--text-muted) 40%, transparent);
}

/* 网格点：Background 以 fill="currentColor" 渲染，这里给容器定 color */
.mind-canvas .vue-flow__background {
  color: var(--mm-grid-dot);
}

/*
  节点光标。
  ⚠️ flow.vue 里有一份全局 `.vue-flow__node.draggable { cursor: inherit }`，
     只访问过「流程图」页就会把这里的抓手光标吃掉；本条以小范围 + 更高特异性压回去。
*/
.mind-canvas .vue-flow__node,
.mind-canvas .vue-flow__node.draggable {
  cursor: grab;
}

.mind-canvas .vue-flow__node.draggable:active {
  cursor: grabbing;
}

/* 编辑态：节点整体不再可拖，光标保持默认箭头 */
.mind-canvas.is-editing .vue-flow__node,
.mind-canvas.is-editing .vue-flow__node.draggable {
  cursor: default;
}

/*
  框选进行中：整块画布改成十字光标、禁掉选中高亮 ——
  否则拖动时会把画布里的文字一起蓝选中，看起来像卡住。
  `.is-marquee` 由 pointerdown 时加上、pointerup 时去掉，全程不改画布 DOM 结构。
*/
.mind-canvas.is-marquee {
  cursor: crosshair;
  user-select: none;
}

.mind-canvas.is-marquee .vue-flow__node,
.mind-canvas.is-marquee .vue-flow__node.draggable {
  cursor: crosshair;
}

/* 连线：主题切换时平滑过渡 */
.mind-canvas .vue-flow__edge-path {
  transition: stroke 0.2s;
}
</style>
