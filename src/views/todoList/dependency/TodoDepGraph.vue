<script setup lang="ts">
/**
 * 待办依赖关系图（B 任务依赖图）
 * - 第 4 个视图 Tab，复用 todoList store / 详情弹窗 / 筛选态，零主进程改动、零新 IPC。
 * - 依赖方向：父任务 → 子任务（parentIds → 一条父到子的边）。
 * - 布局：复用 flow 的 useLayout（dagre 两段式），与 VisualPipeline 同一实例模式（useVueFlow 不传 id）。
 * - 关键路径：未完成任务的最长依赖链，红色高亮（computeCriticalPath）。
 * - 节点点击 → emit('view', todo) 复用 index.vue 的 openView 打开详情弹窗。
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { useLayout } from '../../flow/useLayout';
import { useTodoStore } from '@/store/useTodo';
import type { TodoItem } from '../types';
import { buildGraph, computeCriticalPath, toParentIdArray, type DepNode, type DepEdge } from './composables/useTodoDepGraph';
import TodoDepNode from './components/TodoDepNode.vue';
import LucideIcon from '@/components/LucideIcon.vue';

const emit = defineEmits<{ (e: 'view', todo: TodoItem): void }>();

const store = useTodoStore();
const { setNodes, setEdges, getNodes, getEdges, fitView, zoomIn, zoomOut } = useVueFlow();
const { layout: runDagreLayout } = useLayout();

const showCriticalPath = ref(true);

/** 图数据源：复用筛选态（关键词/优先级/状态/到期/标签），并补齐被引用到的父/子任务，保证边不断裂 */
const graphSource = computed<TodoItem[]>(() => {
  const base = store.filteredTodos;
  const need = new Set(base.map((t) => t.key));
  for (const t of base) {
    for (const p of toParentIdArray(t.parentIds)) need.add(p);
    store.childrenOf(t.key).forEach((c) => need.add(c.key));
  }
  return store.activeTodos.filter((t) => need.has(t.key));
});

const hasContent = computed(() => graphSource.value.length > 0);

/** 关键路径集合（结构变化即重算） */
const critical = computed(() => {
  const { nodes, edges } = buildGraph(graphSource.value, store.effectiveStatus);
  return computeCriticalPath(nodes, edges);
});

function buildStructure() {
  const { nodes, edges } = buildGraph(graphSource.value, store.effectiveStatus);
  setNodes(nodes as DepNode[]);
  setEdges(edges as DepEdge[]);
}

/** 应用关键路径高亮（不动坐标，避免重排抖动） */
function applyCriticalStyles(show: boolean) {
  for (const n of getNodes.value) {
    const d = n.data as { __critical?: boolean };
    d.__critical = show && critical.value.nodes.has(n.id);
  }
  for (const e of getEdges.value) {
    const on = show && critical.value.edges.has(e.id);
    e.style = on
      ? { stroke: '#ef4444', strokeWidth: 2.2 }
      : { stroke: '#b1b1b7', strokeWidth: 1.4 };
    e.animated = on;
  }
}

/** 两段式布局：先入节点 → 等 VueFlow 量出尺寸 → dagre 排布 → 适配视图 */
function layoutAndFit() {
  const laid = runDagreLayout(getNodes.value, getEdges.value, 'LR');
  for (const n of laid) {
    const t = getNodes.value.find((x) => x.id === n.id);
    if (t) t.position = n.position;
  }
  fitView({ padding: 0.16, duration: 300 });
}

/** 仅在依赖图可见时构建（display:none 下量不到尺寸，会导致布局塌缩） */
function scheduleBuild() {
  if (store.view !== 'graph') return;
  nextTick().then(() => {
    buildStructure();
    applyCriticalStyles(showCriticalPath.value);
    window.setTimeout(() => layoutAndFit(), 60);
  });
}

function onNodeClick(e: { node?: { id: string } }) {
  const id = e?.node?.id;
  if (!id) return;
  const todo = store.activeTodos.find((t) => t.key === id);
  if (todo) emit('view', todo);
}

// 视图切换到图 / 数据变化 → 重建（仅可见时）
watch(
  [() => store.view, graphSource],
  () => scheduleBuild(),
  { deep: false },
);

// 关键路径开关 → 仅换样式
watch(showCriticalPath, (v) => {
  if (store.view === 'graph') applyCriticalStyles(v);
});

onMounted(() => {
  if (store.view === 'graph') scheduleBuild();
});

function autoLayout() {
  if (store.view !== 'graph') return;
  layoutAndFit();
}
</script>

<template>
  <div class="todo-dep-graph">
    <!-- 上手横幅 -->
    <div class="tdg-banner">
      <LucideIcon name="Network" :size="14" class="tdg-badge" />
      <span class="tdg-banner-text">
        箭头由<strong>父任务</strong>指向<strong>子任务</strong>；红色高亮为<strong>关键路径</strong>（最长未完成依赖链）。点击任意节点查看详情。
      </span>
    </div>

    <!-- 画布 -->
    <div class="tdg-canvas-wrap">
      <VueFlow
        class="tdg-flow"
        :min-zoom="0.3"
        :max-zoom="2"
        :default-edge-options="{ type: 'smoothstep', markerEnd: MarkerType.ArrowClosed }"
        @node-click="onNodeClick"
      >
        <Background :gap="18" :size="1.2" pattern-color="#dde1e8" />
        <template #node-todoDep="nodeProps">
          <TodoDepNode :id="nodeProps.id" :data="nodeProps.data" />
        </template>
      </VueFlow>

      <!-- 悬浮工具栏 -->
      <div class="tdg-toolbar">
        <button class="tdg-tb-btn" title="重新自动排布" @click="autoLayout">
          <LucideIcon name="LayoutGrid" :size="13" />
        </button>
        <button class="tdg-tb-btn" title="放大" @click="zoomIn()">
          <LucideIcon name="ZoomIn" :size="13" />
        </button>
        <button class="tdg-tb-btn" title="缩小" @click="zoomOut()">
          <LucideIcon name="ZoomOut" :size="13" />
        </button>
        <button class="tdg-tb-btn" title="适配视图" @click="fitView({ padding: 0.16 })">
          <LucideIcon name="Maximize" :size="13" />
        </button>
        <label class="tdg-toggle" :class="{ on: showCriticalPath }" title="高亮关键路径（最长未完成依赖链）">
          <input v-model="showCriticalPath" type="checkbox" />
          <LucideIcon name="Route" :size="13" />
          <span>关键路径</span>
        </label>
      </div>

      <!-- 图例 -->
      <div class="tdg-legend">
        <span class="lg-item"><i class="lg-dot" style="background:#22c55e" />已完成</span>
        <span class="lg-item"><i class="lg-dot" style="background:#3b82f6" />进行中</span>
        <span class="lg-item"><i class="lg-dot" style="background:#6b7280" />未开始</span>
        <span class="lg-item"><i class="lg-dot" style="background:#ef4444" />阻塞 / 逾期</span>
        <span class="lg-item"><i class="lg-dot" style="background:#9ca3af" />已取消</span>
        <span class="lg-item"><i class="lg-line" />关键路径</span>
      </div>

      <!-- 空态 -->
      <div v-if="!hasContent" class="tdg-empty">
        <LucideIcon name="Network" :size="28" class="tdg-empty-icon" />
        <p>当前筛选条件下没有可展示的待办</p>
        <p class="tdg-empty-sub">建立「父任务」关联（在待办编辑里设置父任务）后，依赖关系会在这里呈现</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
/* Vue Flow 基础样式（本模块独立引入，与 flow / visual 页面一致） */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
</style>

<style scoped lang="scss">
.todo-dep-graph {
  /* 父容器 .todo-content 是 block（非 flex），flex:1 不生效 ⇒ 必须显式 height:100%，
     否则横幅以下整块塌缩为 0 高（画布/工具栏/图例全部不可见） */
  height: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tdg-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 7px 12px;
  border-radius: 8px;
  background: var(--color-primary-light, rgba(59, 130, 246, 0.1));
  font-size: 12px;
  color: var(--text-primary, #1f2937);
  line-height: 1.5;

  strong {
    color: var(--color-primary, #3b82f6);
  }
}

.tdg-badge {
  color: var(--color-primary, #3b82f6);
  flex-shrink: 0;
}

.tdg-canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-subtle, #e3e6eb);
  border-radius: 10px;
  background: #f5f5f7;
  overflow: hidden;
}

.tdg-flow {
  width: 100%;
  height: 100%;
}

/* 悬浮工具栏 */
.tdg-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #e3e6eb);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.tdg-tb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;

  &:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--color-primary, #3b82f6);
  }
}

.tdg-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  border: 1px solid transparent;

  input {
    margin: 0;
    accent-color: #ef4444;
  }

  &.on {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-weight: 600;
  }
}

/* 图例 */
.tdg-legend {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #e3e6eb);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-size: 11px;
  color: var(--text-secondary, #6b7280);
}

.lg-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.lg-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lg-line {
  width: 16px;
  height: 0;
  border-top: 2px solid #ef4444;
  flex-shrink: 0;
}

/* 空态 */
.tdg-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  color: var(--text-muted, #9ca3af);
  pointer-events: none;

  p {
    margin: 0;
    font-size: 13px;
  }

  .tdg-empty-sub {
    font-size: 11px;
    color: var(--text-muted, #9ca3af);
    max-width: 320px;
  }

  .tdg-empty-icon {
    color: var(--border-strong, #cbd5e1);
  }
}
</style>
