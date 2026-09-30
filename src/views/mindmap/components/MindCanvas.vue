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
-->
<template>
  <div class="mind-canvas" :class="{ 'is-editing': isEditing }">
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
      @node-drag-stop="graph.onNodeDragStop"
      @pane-click="onPaneClick"
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

    <!-- 缩放条浮在画布右下角；它自己按 store id 取 vue-flow 视口助手，不需要父级传参 -->
    <MindZoomBar />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'

import { MINDMAP_FLOW_ID } from '../constants'
import { useMindActions } from '../composables/useMindActions'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindGraph } from '../composables/useMindGraph'
import { useMindView } from '../composables/useMindView'
import MindNode from './MindNode.vue'
import MindZoomBar from './MindZoomBar.vue'

const mind = useMindDoc()
const actions = useMindActions()
const view = useMindView()
const graph = useMindGraph()

/** 内联编辑时把画布的拖拽光标整体收掉，避免出现「文本框里却是抓手」 */
const isEditing = computed(() => Boolean(mind.editingId.value))

/** 点空白处取消选中 */
function onPaneClick() {
  mind.clearSelection()
}

/**
 * 重排入口：把 `revision`（结构变了）与 `focusToken`（只是要定位）**拼成一个键**。
 *
 * 拼在一起不是图省事：搜索命中一个被折叠藏起来的节点时，「展开祖先」（改 revision）
 * 与「定位到它」（改 focusToken）发生在同一次点击里。拼成一个键，Vue 只会触发**一次**
 * 回调；否则会跑两遍同步，其中一遍还可能抢在重排之前定位到旧坐标上。
 *
 * 只有「打开 / 新建 / 切布局」这类整体换代才重新适应画布，其余编辑保持用户的浏览位置 ——
 * 靠 useMindView 的一次性 fit 信号来区分，而不是每次都 fitView。
 */
watch(
  () => `${mind.revision.value}:${view.focusToken.value}`,
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

/* 连线：主题切换时平滑过渡 */
.mind-canvas .vue-flow__edge-path {
  transition: stroke 0.2s;
}
</style>
