<script setup lang="ts">
/**
 * SQL 子句库：点击芯片向画布添加对应节点。
 * 芯片即 SQL 关键字教学入口，颜色与节点种类一一对应。
 */
import { Table, Filter, Layers, BarChart3, Download } from "@lucide/vue";
import type { NodeKind } from "../types";
import { KIND_META } from "../types";

defineEmits<{ (e: "add", kind: NodeKind): void }>();

const chips: Array<{ kind: NodeKind; label: string; hint: string; icon: any }> = [
  { kind: "from", label: "FROM 表", hint: "选择数据源", icon: Table },
  { kind: "where", label: "WHERE 条件", hint: "按条件过滤行", icon: Filter },
  { kind: "groupBy", label: "GROUP BY 分组", hint: "按列分组统计", icon: Layers },
  { kind: "select", label: "SELECT 输出", hint: "决定输出哪些列", icon: BarChart3 },
  { kind: "insert", label: "INSERT 写入", hint: "把结果写回另一张表", icon: Download },
];
</script>

<template>
  <div class="node-library">
    <span class="lib-title">SQL 子句库</span>
    <button
      v-for="chip in chips"
      :key="chip.kind"
      class="lib-chip"
      :title="chip.hint"
      @click="$emit('add', chip.kind)"
    >
      <span class="chip-icon" :style="{ background: KIND_META[chip.kind].color }"><component :is="chip.icon" class="chip-icon-svg" /></span>
      <span class="chip-label">{{ chip.label }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.node-library {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.lib-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-right: 4px;
}

.lib-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  background: var(--bg-hover);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: var(--bg-hover);
    border-color: var(--border-subtle);
  }
}

.chip-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  background: var(--color-primary);
}

.chip-icon-svg {
  width: 12px;
  height: 12px;
  color: #fff;
}

.chip-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
