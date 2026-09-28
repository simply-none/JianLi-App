<script setup lang="ts">
/**
 * SQL 子句节点：数据源 / 筛选条件 / 分组统计 / 输出列 / 写回表
 *
 * 展示三层信息（从最通俗到最技术）：
 *   1. 人话标题（如「筛选条件」）+ 链路序号
 *   2. 人话摘要（如「只留 status = active」）
 *   3. 真实 SQL 片段（小字灰色，鼠标悬停或选中时更明显）
 * 顶部徽标显示数据探针结果（流经此节点还剩多少行）。
 * 「未配置」的节点显示虚线灰边 + 空态提示，让用户一眼看出哪块还没写完。
 */
import { computed } from "vue";
import { Position, Handle } from "@vue-flow/core";
import { Table, Filter, Layers, BarChart3, Download, Play, AlertCircle } from "@lucide/vue";
import type { PipelineNodeData, ProbeState } from "../types";
import { KIND_META, nodeEmpty } from "../types";

const props = defineProps<{
  id: string;
  data: PipelineNodeData & {
    __selected?: boolean;
    __linked?: boolean;
    __fragment?: string;
    __summary?: string;
    __order?: number;
  };
}>();

const emit = defineEmits<{ (e: "probe", id: string): void }>();

const meta = computed(() => KIND_META[props.data.kind]);

const fragment = computed(() => props.data.__fragment || "");

/** 人话摘要：由父层注入（compiler.nodeSummary），缺省回落到空态提示 */
const summary = computed(() => props.data.__summary || nodeEmpty(props.data) ? meta.value.emptyHint : "");

const isEmpty = computed(() => nodeEmpty(props.data));

const order = computed(() => props.data.__order ?? 0);

const probe = computed<ProbeState>(() => props.data.probe || { status: "idle" });

const probeText = computed(() => {
  const p = probe.value;
  if (p.status === "running") return "计算中…";
  if (p.status === "error") return p.error || "算不出来";
  if (p.status === "ok") return `${fmtNum(p.rows ?? 0)} 行 · ${p.ms ?? 0} ms`;
  return "";
});

const probeClass = computed(() => ["probe-badge", `probe-${probe.value.status}`]);

function fmtNum(n: number): string {
  return n.toLocaleString("zh-CN");
}

const icons: Record<string, any> = {
  from: Table,
  where: Filter,
  groupBy: Layers,
  select: BarChart3,
  insert: Download,
};

const icon = computed(() => icons[props.data.kind] || Table);
</script>

<template>
  <div
    class="sql-node"
    :class="{
      selected: data.__selected,
      linked: data.__linked,
      write: data.kind === 'insert',
      empty: isEmpty,
    }"
    :style="{ '--node-color': meta.color, '--node-soft': meta.softBg }"
  >
    <Handle v-if="data.kind !== 'from'" id="in" type="target" :position="Position.Left" />
    <Handle v-if="data.kind !== 'insert'" id="out" type="source" :position="Position.Right" />

    <!-- 链路序号：与底部 SQL 每行左侧的序号一致，方便对照 -->
    <span class="node-order">{{ order }}</span>

    <div class="node-icon">
      <component :is="icon" class="icon-svg" />
    </div>

    <div class="node-body">
      <div class="node-head">
        <span class="node-title">{{ meta.humanLabel }}</span>
        <span class="node-key">{{ meta.label }}</span>
      </div>
      <div class="node-summary" :class="{ muted: isEmpty }">{{ summary }}</div>
      <div class="node-fragment">{{ fragment }}</div>
    </div>

    <div v-if="probeText" :class="probeClass" :title="`数据流到这一步时还有 ${probe.rows ?? 0} 行`">
      <AlertCircle v-if="probe.status === 'error'" class="probe-icon" />
      <span>{{ probeText }}</span>
    </div>

    <button
      class="probe-btn"
      title="看看数据走到这一步还剩多少行"
      @click.stop="emit('probe', id)"
    >
      <Play class="probe-btn-icon" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.sql-node {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 236px;
  min-height: 62px;
  padding: 10px 26px 10px 10px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-subtle);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;

  /* 未配置：虚线灰边，一眼看出「这一步还没写完」 */
  &.empty {
    border-style: dashed;
    border-color: #cbd0d8;
    background: #fbfbfc;

    .node-icon {
      opacity: 0.55;
    }
  }

  &.selected {
    border-color: var(--node-color);
    border-style: solid;
    background: var(--node-soft);
    box-shadow: 0 0 0 2px var(--node-color);
  }

  /* 与 SQL 行联动高亮（悬停 SQL 行 → 节点亮；悬停节点 → SQL 行亮） */
  &.linked {
    border-color: var(--node-color);
    box-shadow: 0 0 0 2px var(--node-soft), 0 0 0 3px var(--node-color);
  }

  &.write {
    background: var(--tag-bg-warning);
  }
}

/* 链路序号 */
.node-order {
  position: absolute;
  top: -8px;
  left: -8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--node-color);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.node-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-top: 1px;
  border-radius: 8px;
  background: var(--node-color);
}

.icon-svg {
  width: 15px;
  height: 15px;
  color: #fff;
}

.node-body {
  flex: 1;
  min-width: 0;
}

.node-head {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.node-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.node-key {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: var(--node-color);
  opacity: 0.85;
}

.node-summary {
  margin-top: 1px;
  font-size: 11px;
  color: var(--text-primary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.muted {
    color: var(--text-muted);
  }
}

/* 真 SQL 片段：最底层信息，小字灰色，不抢视线 */
.node-fragment {
  margin-top: 2px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 9.5px;
  color: var(--text-muted);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.probe-badge {
  position: absolute;
  top: -9px;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 9px;
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;

  &.probe-ok {
    background: var(--node-color);
    color: #fff;
  }

  &.probe-error {
    background: var(--color-error);
    color: #fff;
  }

  &.probe-running {
    background: var(--text-muted);
    color: #fff;
  }
}

.probe-icon {
  width: 10px;
  height: 10px;
}

.probe-btn {
  position: absolute;
  right: 5px;
  bottom: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;

  &:hover {
    background: var(--node-soft);
    color: var(--node-color);
  }
}

.probe-btn-icon {
  width: 10px;
  height: 10px;
}
</style>
