<script setup lang="ts">
/**
 * 可视化流水线（数据库操作 · 第 13 个操作入口）
 *
 * 定位：**教用户看懂数据库操作**。
 * 节点 = 真实 SQL 子句（数据源/筛选/分组/输出/写回），图 → SQL 确定性编译。
 * 界面语言以「人话」为主、SQL 关键字为辅，让不懂 SQL 的人也能拼出一条查询。
 *
 * 交互契约（与子组件）：
 * - 画布节点 ✕ SQL 行：双向高亮 —— hoverNodeId / activeLineNo 两个 ref 互为驱动
 * - 落点：新节点固定落在链尾右下方，不再依赖 window.innerWidth
 */
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { VueFlow, useVueFlow, MarkerType } from "@vue-flow/core";
import type { Connection, NodeMouseEvent } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import {
  Play,
  StepForward,
  LayoutGrid,
  Save,
  FolderOpen,
  Lock,
  Wand2,
  X,
  AlertTriangle,
  CheckCircle2,
} from "@lucide/vue";

import SqlClauseNode from "./components/SqlClauseNode.vue";
import NodeLibrary from "./components/NodeLibrary.vue";
import PropertyPanel from "./components/PropertyPanel.vue";
import SqlPreviewBar from "./components/SqlPreviewBar.vue";
import PipelineResultTable from "./components/PipelineResultTable.vue";
import WriteConfirmDialog from "./components/WriteConfirmDialog.vue";

import type { NodeKind, PipelineNodeData } from "./types";
import { defaultNodeData, KIND_META } from "./types";
import { compilePipeline, probeCountSql, nodeFragment, nodeSummary, connectionError } from "./compiler";
import { listTables, tableColumns, probeNode, runCompiled } from "./api";
import { useLayout } from "../../flow/useLayout";

const LS_KEY = "sql-pipeline-templates";

const { addNodes, addEdges, removeNodes, getNodes, getEdges, screenToFlowCoordinate, fitView } = useVueFlow();

// dagre 自动布局（useLayout 内部也要 useVueFlow，必须在 setup 期调用以共享同一实例）
const { layout: runDagreLayout } = useLayout();

// ---- 画布状态 ----
const selectedId = ref<string | null>(null);
/** C2：鼠标悬停的节点 —— 驱动 SQL 中对应行高亮 */
const hoverNodeId = ref<string | null>(null);
/** C2：鼠标悬停的 SQL 行号 —— 驱动画布上对应节点高亮 */
const activeLineNo = ref<number | null>(null);

const allowWrite = ref(false);
const probing = ref(false);
const running = ref(false);

const resultRows = ref<any[]>([]);
const resultMs = ref(0);
const resultError = ref("");
const writeNotice = ref("");
/** 非阻塞提示（如拦截重复 FROM），与 resultError 分开，避免被 runPipeline 覆盖 */
const softTip = ref("");
const tipTimer = ref<number | null>(null);

const confirmOpen = ref(false);
const pendingEstimated = ref<number | null>(null);

const tables = ref<string[]>([]);
const columns = ref<string[]>([]);

/** 选中节点数据（PropertyPanel 直接编辑其字段） */
const selectedData = computed<PipelineNodeData | null>(() => {
  const node = getNodes.value.find((n) => n.id === selectedId.value);
  return node ? (node.data as PipelineNodeData) : null;
});

// ---- 编译（节点/连线/属性变化即重算） ----
const compiled = computed(() =>
  compilePipeline({
    nodes: getNodes.value.map((n) => ({ id: n.id, data: n.data as PipelineNodeData })),
    edges: getEdges.value.map((e) => ({ source: e.source, target: e.target })),
  })
);

/** 底部 SQL 预览用：lineMap 已带来源节点；编译失败时也要尽量给出可展示的片段 */
const previewLines = computed(() => compiled.value.lineMap);

/** 当前悬停 SQL 行对应的节点 id（用于反向高亮画布） */
const hoverLineNodeId = computed(() => {
  if (activeLineNo.value == null) return null;
  return previewLines.value.find((l) => l.no === activeLineNo.value)?.nodeId ?? null;
});

/** 传给 SQL 条的高亮节点：优先鼠标悬停的节点，其次悬停行推导出的节点 */
const highlightedNodeId = computed(() => hoverNodeId.value || hoverLineNodeId.value);

/** 画布节点序号：按链路顺序编号，让「节点的③」与「SQL 里的③」一一对应 */
const nodeOrder = computed<Record<string, number>>(() => {
  const nodes = getNodes.value.map((n) => ({ id: n.id, data: n.data as PipelineNodeData }));
  const sorted = [...nodes].sort((a, b) => KIND_META[a.data.kind].order - KIND_META[b.data.kind].order);
  const map: Record<string, number> = {};
  sorted.forEach((n, i) => (map[n.id] = i + 1));
  return map;
});

/** 把编译片段、选中态、悬停态、序号同步进节点 data */
watch(
  [compiled, selectedId, hoverNodeId, nodeOrder, activeLineNo],
  () => {
    // 当前悬停的 SQL 行对应的节点（用于反向高亮）
    const lineNodeId = hoverLineNodeId.value;

    for (const node of getNodes.value) {
      const data = node.data as PipelineNodeData & {
        __fragment?: string;
        __summary?: string;
        __selected?: boolean;
        __linked?: boolean;
        __order?: number;
      };
      const frag = nodeFragment(data);
      if (data.__fragment !== frag) data.__fragment = frag;
      const sum = nodeSummary(data);
      if (data.__summary !== sum) data.__summary = sum;
      const ord = nodeOrder.value[node.id];
      if (data.__order !== ord) data.__order = ord;
      const sel = node.id === selectedId.value;
      if (data.__selected !== sel) data.__selected = sel;
      // 悬停 SQL 行 → 该行来源节点高亮；悬停节点 → 自身高亮
      const linked = node.id === hoverNodeId.value || node.id === lineNodeId;
      if (data.__linked !== linked) data.__linked = linked;
    }
  },
  { immediate: true, deep: false }
);

// ---- 提示条 ----
function showTip(text: string) {
  softTip.value = text;
  if (tipTimer.value) window.clearTimeout(tipTimer.value);
  tipTimer.value = window.setTimeout(() => (softTip.value = ""), 4000);
}

// ---- 节点操作 ----
function addNodeByKind(kind: NodeKind) {
  // A3：重复 FROM 不再报错，改为「指出已有节点在哪」
  const existingFrom = getNodes.value.find((n) => (n.data as PipelineNodeData).kind === "from");
  if (kind === "from" && existingFrom) {
    selectedId.value = existingFrom.id;
    hoverNodeId.value = existingFrom.id;
    window.setTimeout(() => (hoverNodeId.value = null), 1600);
    const t = (existingFrom.data as PipelineNodeData).table;
    showTip(
      t
        ? `数据源已有「${t}」—— 已帮你选中它，改表直接改这里就行`
        : "数据源节点已经有一个了 —— 已帮你选中它，选表直接改这里就行"
    );
    return;
  }

  // A2：落点 = 链尾节点右下方；无节点时落在画布可视区中部
  const nodes = getNodes.value;
  let x = 0;
  let y = 0;
  if (nodes.length === 0) {
    const p = screenToFlowCoordinate({ x: window.innerWidth / 2, y: 220 });
    x = p.x;
    y = p.y;
  } else {
    // 取「最靠后」的节点作为锚点：先按 kind order，再按 y
    const sorted = [...nodes].sort((a, b) => {
      const oa = KIND_META[(a.data as PipelineNodeData).kind].order;
      const ob = KIND_META[(b.data as PipelineNodeData).kind].order;
      if (oa !== ob) return oa - ob;
      return a.position.y - b.position.y;
    });
    const anchor = sorted[sorted.length - 1];
    x = anchor.position.x + 280;
    y = anchor.position.y + 40;
  }

  const id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  addNodes({ id, type: "sqlClause", position: { x, y }, data: defaultNodeData(kind) });
  selectedId.value = id;

  // 自动连到链尾（若当前链尾 kind 的 order 恰好紧邻），降低新手「忘了连线」的门槛
  const prev = nodes
    .filter((n) => {
      const k = (n.data as PipelineNodeData).kind;
      return KIND_META[k].order < KIND_META[kind].order && k !== "insert";
    })
    .sort((a, b) => {
      const oa = KIND_META[(a.data as PipelineNodeData).kind].order;
      const ob = KIND_META[(b.data as PipelineNodeData).kind].order;
      return ob - oa;
    })[0];
  if (prev) {
    const srcKind = (prev.data as PipelineNodeData).kind;
    if (!connectionError(srcKind, kind)) {
      const dupe = getEdges.value.some((e) => e.source === prev.id && e.target === id);
      if (!dupe) {
        addEdges({
          id: `e${prev.id}-${id}`,
          source: prev.id,
          target: id,
          sourceHandle: "out",
          targetHandle: "in",
          markerEnd: MarkerType.ArrowClosed,
        });
      }
    }
  }

  void nextTick(() => fitView({ padding: 0.2, duration: 300 }));
}

function onConnect(connection: Connection) {
  const srcKind = (getNodes.value.find((n) => n.id === connection.source)?.data as PipelineNodeData)?.kind;
  const dstKind = (getNodes.value.find((n) => n.id === connection.target)?.data as PipelineNodeData)?.kind;
  const err = connectionError(srcKind, dstKind);
  if (err) {
    resultError.value = err;
    return;
  }
  resultError.value = "";
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

// ---- A4：一键修复 ----
const fixableIssues = computed(() => compiled.value.issues.filter((i) => i.fix));

function applyFix() {
  const extraFrom = compiled.value.issues.find((i) => i.fix === "remove-extra-from");
  if (!extraFrom) return;
  const fromNodes = getNodes.value.filter((n) => (n.data as PipelineNodeData).kind === "from");
  if (fromNodes.length <= 1) return;
  // 保留第一个（链首），删除其余
  const keep = fromNodes[0];
  const drop = fromNodes.slice(1).map((n) => n.id);
  removeNodes(drop);
  if (drop.includes(selectedId.value || "")) selectedId.value = keep.id;
  resultError.value = "";
  showTip(`已清理 ${drop.length} 个多余的「数据源」节点`);
  void nextTick(() => fitView({ padding: 0.2, duration: 300 }));
}

/** 点错误里的节点定位 */
function focusIssueNode(nodeId?: string) {
  if (!nodeId) return;
  selectedId.value = nodeId;
  hoverNodeId.value = nodeId;
  window.setTimeout(() => (hoverNodeId.value = null), 1600);
  loadColumnsForSelected();
}

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
    data.probe = { status: "error", error: "暂时算不出来：先把这个节点配好" };
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
    resultError.value = "还没打开「允许写回」开关 —— 打开后才能执行写入";
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
  if (compiled.value.insertSql) {
    writeNotice.value = `已写回「${compiled.value.targetTable}」（整体一次提交，出错会自动撤销）`;
  }
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
  fitView({ padding: 0.15, duration: 300 });
}

// ---- 模板（localStorage，轻量持久化；后续可迁 SQLite） ----
function saveTemplate() {
  const payload = {
    nodes: getNodes.value.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.data, probe: undefined, __selected: undefined, __linked: undefined },
    })),
    edges: getEdges.value.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
  const name = `流水线 ${new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
  const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  all[name] = payload;
  localStorage.setItem(LS_KEY, JSON.stringify(all));
  showTip(`布局「${name}」已保存（存在本机）`);
  resultError.value = "";
}

function loadTemplate() {
  const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  const names = Object.keys(all);
  if (names.length === 0) {
    showTip("还没有保存过布局");
    return;
  }
  const name = names[names.length - 1];
  const payload = all[name];
  removeNodes(getNodes.value.map((n) => n.id));
  addNodes(payload.nodes.map((n: any) => ({ ...n, data: { ...n.data, probe: { status: "idle" } } })));
  addEdges((payload.edges || []).map((e: any) => ({ ...e, markerEnd: MarkerType.ArrowClosed })));
  resultError.value = "";
  showTip(`已载入布局「${name}」`);
  void nextTick(() => fitView({ padding: 0.15, duration: 300 }));
}

// ---- 初始化 ----
/** A1：打开就是一条完整、排好版、能直接跑的流水线 */
function buildStarterGraph() {
  const byKind = (k: NodeKind) => {
    const d = defaultNodeData(k);
    const id = `${k}-${Math.random().toString(36).slice(2, 7)}`;
    return { id, type: "sqlClause", position: { x: 0, y: 0 }, data: d };
  };
  const f = byKind("from");
  const w = byKind("where");
  const g = byKind("groupBy");
  const s = byKind("select");
  (f.data as PipelineNodeData).table = tables.value.includes("订单记录") ? "订单记录" : tables.value[0] || "";
  addNodes([f, w, g, s]);
  addEdges([
    { id: `e${f.id}-${w.id}`, source: f.id, target: w.id, sourceHandle: "out", targetHandle: "in", markerEnd: MarkerType.ArrowClosed },
    { id: `e${w.id}-${g.id}`, source: w.id, target: g.id, sourceHandle: "out", targetHandle: "in", markerEnd: MarkerType.ArrowClosed },
    { id: `e${g.id}-${s.id}`, source: g.id, target: s.id, sourceHandle: "out", targetHandle: "in", markerEnd: MarkerType.ArrowClosed },
  ]);
  return f.id;
}

onMounted(async () => {
  tables.value = await listTables();
  const fromId = buildStarterGraph();
  selectedId.value = fromId;
  // 等 VueFlow 量出节点尺寸后再排布（dagre 需要 dimensions）
  await nextTick();
  window.setTimeout(() => {
    autoLayout();
    loadColumnsForSelected();
  }, 60);
});
</script>

<template>
  <div class="visual-pipeline">
    <!-- B1：上手横幅（与其他分页一致的教学入口） -->
    <div class="vp-banner">
      <span class="vb-badge">怎么用</span>
      <span class="vb-text">
        ① 左侧「积木箱」点一下加一个步骤 &nbsp;·&nbsp; ② 在右侧填好每步要什么 &nbsp;·&nbsp; ③ 点「运行流水线」看结果
      </span>
      <span class="vb-hint">每一步都对应下面 SQL 里的一行，可以对着看</span>
    </div>

    <!-- E1：工具栏分组 —— 主操作 / 辅助 / 布局 / 危险开关 -->
    <div class="vp-toolbar">
      <button class="run-btn" :disabled="running" @click="runPipeline">
        <Play class="tb-icon" />
        {{ running ? "运行中…" : compiled.insertSql ? "运行并写回" : "运行流水线" }}
      </button>

      <span class="tb-divider" />

      <button
        class="tb-btn"
        :disabled="!selectedId || probing"
        :title="selectedId ? '看看数据走到这一步还剩多少行' : '先在画布上点一个节点'"
        @click="probeSelected"
      >
        <StepForward class="tb-icon" />
        {{ probing ? "计算中…" : "预览这步行数" }}
      </button>
      <button class="tb-btn" title="把节点按执行顺序重新排整齐" @click="autoLayout">
        <LayoutGrid class="tb-icon" />
        一键排整齐
      </button>

      <span class="tb-gap" />

      <button class="tb-icon-btn" title="保存当前布局（存在本机）" @click="saveTemplate">
        <Save class="tb-icon" />
        保存布局
      </button>
      <button class="tb-icon-btn" title="载入最近一次保存的布局" @click="loadTemplate">
        <FolderOpen class="tb-icon" />
        载入布局
      </button>

      <!-- E1：写操作开关加锁图标 + 橙色，视觉上标明这是危险开关 -->
      <label class="write-switch" :class="{ on: allowWrite }" title="关闭时不会执行任何写回操作">
        <input v-model="allowWrite" type="checkbox" />
        <Lock class="ws-icon" />
        <span>允许写回</span>
      </label>
    </div>

    <!-- 非阻塞提示（拦截类操作的反馈） -->
    <div v-if="softTip" class="vp-tip">
      <CheckCircle2 class="tip-icon" />
      <span>{{ softTip }}</span>
      <button class="tip-close" @click="softTip = ''"><X class="tip-close-icon" /></button>
    </div>

    <!-- A4：错误卡（可定位节点 + 一键修复） -->
    <div v-if="!compiled.ok && compiled.issues.length" class="vp-issues">
      <div class="issue-head">
        <AlertTriangle class="issue-head-icon" />
        <span>还有 {{ compiled.issues.length }} 个地方没弄好，弄好就能运行</span>
        <button v-if="fixableIssues.length" class="issue-fix" @click="applyFix">
          <Wand2 class="fix-icon" />
          一键修复
        </button>
      </div>
      <ul class="issue-list">
        <li v-for="(it, i) in compiled.issues" :key="i" class="issue-item">
          <span class="issue-dot" />
          <span class="issue-msg">{{ it.message }}</span>
          <button v-if="it.nodeId" class="issue-locate" @click="focusIssueNode(it.nodeId)">定位</button>
        </li>
      </ul>
    </div>

    <div class="vp-main">
      <!-- E2：子句库改为左侧竖栏（不再压在画布上遮挡内容） -->
      <div class="vp-library">
        <NodeLibrary @add="addNodeByKind" />
      </div>

      <div class="vp-canvas-wrap">
        <VueFlow
          class="vp-flow"
          :max-zoom="2"
          :min-zoom="0.4"
          @node-click="onNodeClick"
          @node-mouse-enter="(e: any) => (hoverNodeId = e.node.id)"
          @node-mouse-leave="hoverNodeId = null"
          @pane-click="selectedId = null"
          @connect="onConnect"
        >
          <Background :gap="18" :size="1.2" pattern-color="#DDE1E8" />
          <template #node-sqlClause="nodeProps">
            <SqlClauseNode :id="nodeProps.id" :data="nodeProps.data" @probe="probeSelected" />
          </template>
        </VueFlow>

        <div class="vp-preview">
          <SqlPreviewBar
            :lines="previewLines"
            :errors="compiled.errors"
            :activeLineNo="activeLineNo"
            :highlightNodeId="highlightedNodeId"
            @hover-line="(no: number | null) => (activeLineNo = no)"
          />
        </div>
      </div>

      <!-- E4：右栏 340，属性面板占更多高度 -->
      <div class="vp-side">
        <div class="vp-prop">
          <PropertyPanel
            :nodeData="selectedData"
            :nodeId="selectedId"
            :tables="tables"
            :columns="columns"
            :probing="probing"
            :nodeOrder="nodeOrder"
            :fragment="selectedId ? nodeFragment(selectedData as PipelineNodeData) : ''"
            @update="updateSelected"
            @probe="probeSelected"
            @remove="removeSelected"
            @add="addNodeByKind"
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
  gap: 10px;
  box-sizing: border-box;
}

/* ===== B1 上手横幅 ===== */
.vp-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--color-primary-light);
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.5;
}

.vb-badge {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
}

.vb-text {
  flex: 1;
  min-width: 0;
}

.vb-hint {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 11px;
}

/* ===== E1 工具栏 ===== */
.vp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.tb-gap {
  flex: 1;
}

.tb-divider {
  width: 1px;
  height: 18px;
  background: var(--border-subtle);
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

.tb-icon-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
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
  padding: 6px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  input {
    margin: 0;
    accent-color: var(--color-warning);
  }

  &.on {
    border-color: var(--color-warning);
    background: var(--tag-bg-warning);
    color: var(--color-warning);
    font-weight: 600;
  }

  &:hover {
    border-color: var(--color-warning);
  }
}

.ws-icon {
  width: 12px;
  height: 12px;
}

/* ===== 非阻塞提示 ===== */
.vp-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid var(--color-success);
  border-radius: 8px;
  background: var(--tag-bg-success);
  font-size: 12px;
  color: var(--text-primary);
}

.tip-icon {
  width: 13px;
  height: 13px;
  color: var(--color-success);
  flex-shrink: 0;
}

.tip-close {
  margin-left: auto;
  display: flex;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;

  &:hover {
    color: var(--text-primary);
  }
}

.tip-close-icon {
  width: 12px;
  height: 12px;
}

/* ===== A4 错误卡 ===== */
.vp-issues {
  flex-shrink: 0;
  border: 1px solid var(--color-error);
  border-radius: 8px;
  background: var(--tag-bg-danger);
  overflow: hidden;
}

.issue-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-error);
}

.issue-head-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.issue-fix {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border: 1px solid var(--color-error);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--color-error);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: var(--color-error);
    color: #fff;
  }
}

.fix-icon {
  width: 11px;
  height: 11px;
}

.issue-list {
  margin: 0;
  padding: 0 12px 8px;
  list-style: none;
}

.issue-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 0;
  font-size: 11px;
  color: var(--text-primary);
  line-height: 1.5;
}

.issue-dot {
  width: 4px;
  height: 4px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-error);
}

.issue-msg {
  flex: 1;
  min-width: 0;
}

.issue-locate {
  flex-shrink: 0;
  padding: 1px 7px;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 10px;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

/* ===== 主区 ===== */
.vp-main {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

.vp-library {
  flex: 0 0 190px;
  min-height: 0;
  overflow-y: auto;
}

.vp-canvas-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: #f5f5f7;
  overflow: hidden;
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
}

.vp-side {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

/* E4：属性面板占 2 份，结果区 1 份 */
.vp-prop {
  flex: 2;
  min-height: 0;
  display: flex;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
}

.vp-result {
  flex: 1;
  min-height: 0;
  display: flex;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 4px 12px 8px;
  box-sizing: border-box;
  overflow: hidden;
}
</style>
