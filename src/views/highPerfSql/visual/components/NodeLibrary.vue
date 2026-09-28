<script setup lang="ts">
/**
 * 积木箱（左侧竖栏）：点击或拖拽向画布添加一个步骤。
 *
 * 文案策略：中文名在上（如「筛选条件」），SQL 关键字作为灰色副标（WHERE），
 * 下方一句人话说明这一步干什么。不懂 SQL 的人也能按「我想干什么」来选。
 */
import { Table, Filter, Layers, BarChart3, Download, GripVertical } from "@lucide/vue";
import type { NodeKind } from "../types";
import { KIND_META } from "../types";

const emit = defineEmits<{ (e: "add", kind: NodeKind): void }>();

const steps: Array<{ kind: NodeKind; icon: any }> = [
  { kind: "from", icon: Table },
  { kind: "where", icon: Filter },
  { kind: "groupBy", icon: Layers },
  { kind: "select", icon: BarChart3 },
  { kind: "insert", icon: Download },
];

/** 拖拽：把 kind 放进 dataTransfer，画布侧接收（未接时点按仍可用） */
function onDragStart(e: DragEvent, kind: NodeKind) {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData("application/sql-node-kind", kind);
  e.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <div class="node-library">
    <div class="lib-head">
      <span class="lib-title">积木箱</span>
      <span class="lib-sub">点一下就加一步</span>
    </div>

    <button
      v-for="step in steps"
      :key="step.kind"
      class="lib-item"
      :title="KIND_META[step.kind].desc"
      draggable="true"
      @click="emit('add', step.kind)"
      @dragstart="onDragStart($event, step.kind)"
    >
      <span class="chip-icon" :style="{ background: KIND_META[step.kind].color }">
        <component :is="step.icon" class="chip-icon-svg" />
      </span>
      <span class="chip-body">
        <span class="chip-label">
          {{ KIND_META[step.kind].humanLabel }}
          <em class="chip-key">{{ KIND_META[step.kind].label }}</em>
        </span>
        <span class="chip-hint">{{ KIND_META[step.kind].desc }}</span>
      </span>
      <GripVertical class="grip" />
    </button>

    <p class="lib-foot">步骤要按顺序连起来，最后接一个「输出列」才算完整。</p>
  </div>
</template>

<style scoped lang="scss">
.node-library {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  box-sizing: border-box;
}

.lib-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 0 2px 2px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 2px;
}

.lib-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.lib-sub {
  font-size: 10px;
  color: var(--text-muted);
}

.lib-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 7px 6px;
  background: var(--bg-hover);
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: var(--bg-card);
    border-color: var(--color-primary);

    .grip {
      opacity: 1;
    }
  }

  &:active {
    transform: scale(0.98);
  }
}

.chip-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border-radius: 6px;
}

.chip-icon-svg {
  width: 13px;
  height: 13px;
  color: #fff;
}

.chip-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.chip-label {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.chip-key {
  font-style: normal;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: var(--text-muted);
}

.chip-hint {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.grip {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  margin-top: 4px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s;
}

.lib-foot {
  margin: 4px 2px 0;
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
