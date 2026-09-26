<script setup lang="ts">
/**
 * SQL 子句节点：FROM / WHERE / GROUP BY / SELECT / INSERT
 * 展示 = 编译器同源片段（nodeFragment）+ 数据探针徽标（行数/耗时）。
 */
import { computed } from "vue";
import { Position, Handle } from "@vue-flow/core";
import { Table, Filter, Layers, BarChart3, Download, Play, AlertCircle } from "@lucide/vue";
import type { PipelineNodeData, ProbeState } from "../types";
import { KIND_META } from "../types";

const props = defineProps<{
  id: string;
  data: PipelineNodeData & { __selected?: boolean; __fragment?: string };
}>();

const emit = defineEmits<{ (e: "probe", id: string): void }>();

const meta = computed(() => KIND_META[props.data.kind]);

const fragment = computed(() => {
  // 展示片段由父层注入（data.__fragment），保持与编译器同源
  return props.data.__fragment || "";
});

const probe = computed<ProbeState>(() => props.data.probe || { status: "idle" });

const probeText = computed(() => {
  const p = probe.value;
  if (p.status === "running") return "探查中…";
  if (p.status === "error") return p.error || "探查失败";
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
  <div class="sql-node" :class="{ selected: data.__selected, write: data.kind === 'insert' }" :style="{ '--node-color': meta.color, '--node-soft': meta.softBg }">
    <Handle v-if="data.kind !== 'from'" id="in" type="target" :position="Position.Left" />
    <Handle v-if="data.kind !== 'insert'" id="out" type="source" :position="Position.Right" />

    <div class="node-icon">
      <component :is="icon" class="icon-svg" />
    </div>

    <div class="node-body">
      <div class="node-kind">{{ meta.label }}</div>
      <div class="node-fragment">{{ fragment }}</div>
    </div>

    <div v-if="probeText" :class="probeClass">
      <AlertCircle v-if="probe.status === 'error'" class="probe-icon" />
      <span>{{ probeText }}</span>
    </div>

    <button class="probe-btn" title="探查此节点（统计流经数据行数）" @click.stop="emit('probe', id)">
      <Play class="probe-btn-icon" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.sql-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 220px;
  min-height: 56px;
  padding: 10px 30px 10px 10px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-subtle);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  transition: border-color 0.15s, box-shadow 0.15s;

  &.selected {
    border-color: var(--node-color);
    background: var(--node-soft);
    box-shadow: 0 0 0 2px var(--node-color);
  }

  &.write {
    background: var(--tag-bg-warning);
  }
}

.node-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--node-color);
}

.icon-svg {
  width: 16px;
  height: 16px;
  color: #fff;
}

.node-body {
  flex: 1;
  min-width: 0;
}

.node-kind {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--node-color);
  line-height: 1.3;
}

.node-fragment {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.probe-badge {
  position: absolute;
  top: -9px;
  right: 8px;
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
  right: 6px;
  bottom: 6px;
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
