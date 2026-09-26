<script setup lang="ts">
/**
 * 可视化流水线（数据库操作 · 第 13 个操作入口）
 *
 * 形 = Vue Flow 节点 DAG（FROM → WHERE → GROUP BY → SELECT → INSERT）
 * 数 = 节点级数据探针（行数/耗时徽标）+ 底部实时 SQL + 结果表
 * 编译与执行见 ./compiler.ts 与 ./api.ts；本组件只做状态编排。
 */
import { ref, computed, watch, onMounted } from "vue";
import { VueFlow, useVueFlow, MarkerType } from "@vue-flow/core";
import type { Connection, NodeMouseEvent } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Play, StepForward, LayoutGrid, Save, FolderOpen } from "@lucide/vue";

import SqlClauseNode from "./components/SqlClauseNode.vue";
import NodeLibrary from "./components/NodeLibrary.vue";
import PropertyPanel from "./components/PropertyPanel.vue";
import SqlPreviewBar from "./components/SqlPreviewBar.vue";
import PipelineResultTable from "./components/PipelineResultTable.vue";
import WriteConfirmDialog from "./components/WriteConfirmDialog.vue";

import type { NodeKind, PipelineNodeData } from "./types";
import { defaultNodeData } from "./types";
import { compilePipeline, probeCountSql, nodeFragment, connectionError } from "./compiler";
import { listTables, tableColumns, probeNode, runCompiled } from "./api";
import { useLayout } from "../../flow/useLayout";

const LS_KEY = "sql-pipeline-templates";

const { addNodes, addEdges, removeNodes, getNodes, getEdges, screenToFlowCoordinate, fitView } = useVueFlow();

// dagre 自动布局（useLayout 内部也要 useVueFlow，必须在 setup 期调用以共享同一实例）
const { layout: runDagreLayout } = useLayout();

// ---- 画布状态 ----
const selectedId = ref<string | null>(null);
const allowWrite = ref(false);
const probing = ref(false);
const running = ref(false);

const resultRows = ref<any[]>([]);
const resultMs = ref(0);
const resultError = ref("");
const writeNotice = ref("");

const confirmOpen = ref(false);
const pendingEstimated = ref<number | null>(null);

const tables = ref<string[]>([]);
const columns = ref<string[]>([]);

/** 选中节点数据（PropertyPanel 直接编辑其字段） */
const selectedData = computed<PipelineNodeData | null>(() => {
  const node = getNodes.value.find((n) => n.id === selectedId.value);
  return node ? (node.data as PipelineNodeData) : null;
});

// ---- 编译（节点/连线/属性变化即重算，驱动实时 SQL 与节点片段） ----
const compiled = computed(() =>
  compilePipeline({
    nodes: getNodes.value.map((n) => ({ id: n.id, data: n.data as PipelineNodeData })),
    edges: getEdges.value.map((e) => ({ source: e.source, target: e.target })),
  })
);

const previewSql = computed(() => compiled.value.select?.sql ?? "");

/** 把编译片段与选中态同步进节点 data，SqlClauseNode 只负责展示 */
watch(
  [compiled, selectedId],
  () => {
    for (const node of getNodes.value) {
      const data = node.data as PipelineNodeData & { __fragment?: string; __selected?: boolean };
      const frag = nodeFragment(data);
      if (data.__fragment !== frag) data.__fragment = frag;
      const sel = node.id === selectedId.value;
      if (data.__selected !== sel) data.__selected = sel;
    }
  },
  { immediate: true, deep: false }
);

// ---- 节点操作 ----
function addNodeByKind(kind: NodeKind) {
  if (kind === "from" && getNodes.value.some((n) => (n.data as PipelineNodeData).kind === "from")) {
    resultError.value = "FROM 节点只能有一个";
    return;
  }
  const position = screenToFlowCoordinate({ x: window.innerWidth / 2, y: 220 });
  const id = `n${Date.now().toString(36)}`;
  addNodes({
    id,
    type: "sqlClause",
    position: { x: position.x - 110 + getNodes.value.length * 24, y: position.y + getNodes.value.length * 16 },
    data: defaultNodeData(kind),
  });
  selectedId.value = id;
}

function onConnect(connection: Connection) {
  const srcKind = (getNodes.value.find((n) => n.id === connection.source)?.data as PipelineNodeData)?.kind;
  const dstKind = (getNodes.value.find((n) => n.id === connection.target)?.data as PipelineNodeData)?.kind;
  const err = connectionError(srcKind, dstKind);
  if (err) {
    resultError.value = err;
    return;
  }
  addEdges({
    id: `e${connection.source}-${connection.target}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    markerEnd: MarkerType.ArrowClosed,
  });
}

function removeSelected() {
  if (!selectedId.value) return;
  removeNodes([selectedId.value]);
  selectedId.value = null;
}

function onNodeClick({ node }: NodeMouseEvent) {
  selectedId.value = node.id;
  loadColumnsForSelected();
}

function updateSelected(patch: Partial<PipelineNodeData>) {
  const node = getNodes.value.find((n) => n.id === selectedId.value);
  if (node) Object.assign(node.data, patch);
}

async function loadColumnsForSelected() {
  const data = selectedData.value;
  const table = data?.kind === "from" ? data.table : data?.kind === "insert" ? data.targetTable : "";
  columns.value = table ? await tableColumns(table) : [];
}

watch(selectedData, loadColumnsForSelected);

// ---- 探针 ----
async function probeSelected(nodeId?: unknown) {
  const id = typeof nodeId === "string" ? nodeId : selectedId.value;
  if (!id) return;
  const target = probeCountSql(id, {
    nodes: getNodes.value.map((n) => ({ id: n.id, data: n.data as PipelineNodeData })),
    edges: getEdges.value.map((e) => ({ source: e.source, target: e.target })),
  });
  const node = getNodes.value.find((n) => n.id === id);
  if (!node) return;
  const data = node.data as PipelineNodeData;
  if (!target) {
    data.probe = { status: "error", error: "无法编译探针查询" };
    return;
  }
  probing.value = true;
  data.probe = { status: "running" };
  const res = await probeNode(target.sql, target.params);
  data.probe = res.ok ? { status: "ok", rows: res.rows, ms: res.ms } : { status: "error", error: res.error };
  probing.value = false;
}

// ---- 运行 ----
function openConfirm() {
  if (!compiled.value.ok) return;
  if (compiled.value.insertSql && !allowWrite.value) {
    resultError.value = "写操作已禁用：请打开工具栏「允许写操作」开关";
    return;
  }
  pendingEstimated.value = null;
  const selectNode = getNodes.value.find((n) => (n.data as PipelineNodeData).kind === "select");
  if (selectNode) {
    const probe = (selectNode.data as PipelineNodeData).probe;
    if (probe?.status === "ok") pendingEstimated.value = probe.rows ?? null;
  }
  confirmOpen.value = true;
}

async function doRun() {
  confirmOpen.value = false;
  running.value = true;
  resultError.value = "";
  writeNotice.value = "";
  const start = performance.now();
  const res = await runCompiled(compiled.value);
  resultMs.value = Math.round((performance.now() - start) * 10) / 10;
  running.value = false;
  if (!res.success) {
    resultError.value = res.error || "执行失败";
    resultRows.value = [];
    return;
  }
  resultRows.value = Array.isArray(res.data) ? res.data : [];
  if (compiled.value.insertSql) writeNotice.value = `已写回 ${compiled.value.targetTable}（事务提交，失败将自动回滚）`;
}

async function runPipeline() {
  if (!compiled.value.ok) {
    resultError.value = compiled.value.errors.join("；");
    return;
  }
  if (compiled.value.insertSql) {
    openConfirm();
    return;
  }
  await doRun();
}

// ---- 布局 ----
function autoLayout() {
  const laid = runDagreLayout(getNodes.value, getEdges.value, "LR");
  for (const node of laid) {
    const target = getNodes.value.find((n) => n.id === node.id);
    if (target) target.position = node.position;
  }
  fitView({ padding: 0.15 });
}

// ---- 模板（localStorage，轻量持久化；后续可迁 SQLite） ----
function saveTemplate() {
  const payload = {
    nodes: getNodes.value.map((n) => ({ id: n.id, type: n.type, position: n.position, data: { ...n.data, probe: undefined, __selected: undefined } })),
    edges: getEdges.value.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
  };
  const name = `流水线 ${new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
  const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  all[name] = payload;
  localStorage.setItem(LS_KEY, JSON.stringify(all));
  writeNotice.value = `模板「${name}」已保存（本地）`;
  resultError.value = "";
}

function loadTemplate() {
  const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  const names = Object.keys(all);
  if (names.length === 0) {
    resultError.value = "暂无已保存模板";
    return;
  }
  const name = names[names.length - 1];
  const payload = all[name];
  removeNodes(getNodes.value.map((n) => n.id));
  addNodes(payload.nodes.map((n: any) => ({ ...n, data: { ...n.data, probe: { status: "idle" } } })));
  addEdges((payload.edges || []).map((e: any) => ({ ...e, markerEnd: MarkerType.ArrowClosed })));
  resultError.value = "";
  writeNotice.value = `已载入模板「${name}」`;
}

// ---- 初始化 ----
onMounted(async () => {
  tables.value = await listTables();
  addNodeByKind("from");
  const fromNode = getNodes.value.find((n) => (n.data as PipelineNodeData).kind === "from");
  if (fromNode && tables.value.length > 0) {
    (fromNode.data as PipelineNodeData).table = tables.value.includes("订单记录") ? "订单记录" : tables.value[0];
  }
  addNodeByKind("where");
  addNodeByKind("select");
  // 默认演示链：FROM → WHERE → SELECT
  const byKind = (k: NodeKind) => getNodes.value.find((n) => (n.data as PipelineNodeData).kind === k);
  const f = byKind("from");
  const w = byKind("where");
  const s = byKind("select");
  if (f && w && s) {
    addEdges([
      { id: `e${f.id}-${w.id}`, source: f.id, target: w.id, sourceHandle: "out", targetHandle: "in", markerEnd: MarkerType.ArrowClosed },
      { id: `e${w.id}-${s.id}`, source: w.id, target: s.id, sourceHandle: "out", targetHandle: "in", markerEnd: MarkerType.ArrowClosed },
    ]);
  }
  fitView({ padding: 0.15 });
});
</script>

<template>
  <div class="visual-pipeline">
    <div class="vp-toolbar">
      <button class="run-btn" :disabled="running" @click="runPipeline">
        <Play class="tb-icon" />
        {{ running ? "运行中…" : compiled.insertSql ? "运行并写回" : "运行流水线" }}
      </button>
      <button class="tb-btn" :disabled="!selectedId || probing" title="统计流经选中节点的行数" @click="probeSelected">
        <StepForward class="tb-icon" />
        单步探查
      </button>
      <button class="tb-btn" @click="autoLayout">
        <LayoutGrid class="tb-icon" />
        自动整理
      </button>
      <button class="tb-btn" @click="saveTemplate">
        <Save class="tb-icon" />
        保存模板
      </button>
      <button class="tb-btn" @click="loadTemplate">
        <FolderOpen class="tb-icon" />
        载入模板
      </button>

      <span class="tb-gap" />

      <label class="write-switch" title="关闭时运行会跳过写回">
        <input v-model="allowWrite" type="checkbox" />
        <span>允许写操作</span>
      </label>
    </div>

    <div class="vp-main">
      <div class="vp-canvas-wrap">
        <div class="vp-library">
          <NodeLibrary @add="addNodeByKind" />
        </div>

        <VueFlow
          class="vp-flow"
          :max-zoom="2"
          :min-zoom="0.5"
          @node-click="onNodeClick"
          @pane-click="selectedId = null"
          @connect="onConnect"
        >
          <Background :gap="18" />
          <template #node-sqlClause="nodeProps">
            <SqlClauseNode :id="nodeProps.id" :data="nodeProps.data" @probe="probeSelected" />
          </template>
        </VueFlow>

        <div class="vp-preview">
          <SqlPreviewBar :sql="previewSql" :errors="compiled.errors" />
        </div>
      </div>

      <div class="vp-side">
        <div class="vp-prop">
          <PropertyPanel
            :nodeData="selectedData"
            :nodeId="selectedId"
            :tables="tables"
            :columns="columns"
            :probing="probing"
            @update="updateSelected"
            @probe="probeSelected"
            @remove="removeSelected"
          />
        </div>
        <div class="vp-result">
          <PipelineResultTable
            :rows="resultRows"
            :ms="resultMs"
            :error="resultError"
            :writeNotice="writeNotice"
          />
        </div>
      </div>
    </div>

    <WriteConfirmDialog
      :open="confirmOpen"
      :statements="compiled.insertSql ? [compiled.insertSql] : []"
      :targetTable="compiled.targetTable || ''"
      :estimatedRows="pendingEstimated"
      :running="running"
      @confirm="doRun"
      @cancel="confirmOpen = false"
    />
  </div>
</template>

<style lang="scss">
/* Vue Flow 基础样式（本模块独立引入，避免依赖 flow 页面是否加载） */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
</style>

<style scoped lang="scss">
.visual-pipeline {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.vp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tb-gap {
  flex: 1;
}

.run-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: none;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.tb-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.tb-icon {
  width: 13px;
  height: 13px;
}

.write-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;

  input {
    accent-color: var(--color-warning);
  }
}

.vp-main {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

.vp-canvas-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-hover);
  overflow: hidden;
}

.vp-library {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

.vp-flow {
  width: 100%;
  height: 100%;
}

.vp-preview {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 10;
  pointer-events: none;
}

.vp-side {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.vp-prop {
  flex: 1;
  min-height: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
}

.vp-result {
  flex: 1;
  min-height: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 8px 12px;
  box-sizing: border-box;
}
</style>
