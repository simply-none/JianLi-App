<script setup lang="ts">
/**
 * 属性面板：编辑选中节点的 SQL 子句参数。
 * 表名/列名提供 datalist 联想（来自 listTables / tableInfo）。
 */
import { computed } from "vue";
import { Play, Trash2 } from "@lucide/vue";
import type { PipelineNodeData, PipelineCondition, PipelineAggregate } from "../types";
import { KIND_META } from "../types";

const props = defineProps<{
  nodeData: PipelineNodeData | null;
  nodeId: string | null;
  tables: string[];
  columns: string[];
  probing: boolean;
}>();

const emit = defineEmits<{
  (e: "update", patch: Partial<PipelineNodeData>): void;
  (e: "probe"): void;
  (e: "remove"): void;
}>();

const meta = computed(() => (props.nodeData ? KIND_META[props.nodeData.kind] : null));
const title = computed(() => (props.nodeData ? `属性 · ${meta.value!.label} 节点` : "属性"));

const isSelect = computed(() => props.nodeData?.kind === "select");

const aggregateText = computed({
  get: () => (props.nodeData?.aggregates || []).map((a) => (a.alias ? `${a.expr} AS ${a.alias}` : a.expr)).join("\n"),
  set: (v: string) => {
    const aggregates: PipelineAggregate[] = v
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = /^(.+?)\s+AS\s+(.+)$/i.exec(line);
        return m ? { expr: m[1].trim(), alias: m[2].trim() } : { expr: line, alias: "" };
      });
    emit("update", { aggregates });
  },
});

function updateCond(index: number, patch: Partial<PipelineCondition>) {
  const conditions = (props.nodeData?.conditions || []).map((c, i) => (i === index ? { ...c, ...patch } : c));
  emit("update", { conditions });
}

function addCondition() {
  const conditions = [...(props.nodeData?.conditions || []), { field: "", op: "=", value: "" }];
  emit("update", { conditions });
}

function removeCondition(index: number) {
  const conditions = (props.nodeData?.conditions || []).filter((_, i) => i !== index);
  emit("update", { conditions });
}
</script>

<template>
  <div class="prop-panel">
    <div class="panel-header">
      <span class="panel-title">{{ title }}</span>
      <span v-if="meta && nodeData" class="kind-badge" :style="{ background: meta.softBg, color: meta.color }">
        {{ meta.label }}
      </span>
    </div>

    <div v-if="!nodeData" class="panel-empty">点击画布上的节点编辑其 SQL 子句</div>

    <div v-else class="panel-body">
      <!-- FROM -->
      <template v-if="nodeData.kind === 'from'">
        <label class="field-label">数据源表</label>
        <input v-model="nodeData.table" class="field-input" list="vp-list-tables" placeholder="选择或输入表名" @change="emit('update', { table: nodeData.table })" />
      </template>

      <!-- WHERE -->
      <template v-else-if="nodeData.kind === 'where'">
        <div v-for="(cond, i) in nodeData.conditions" :key="i" class="cond-row">
          <input v-model="cond.field" class="field-input cond-field" list="vp-list-cols" placeholder="字段" @change="updateCond(i, { field: cond.field })" />
          <select v-model="cond.op" class="field-input cond-op" @change="updateCond(i, { op: cond.op })">
            <option v-for="op in ['=', '!=', '>', '<', '>=', '<=', 'LIKE']" :key="op" :value="op">{{ op }}</option>
          </select>
          <input v-model="cond.value" class="field-input cond-value" placeholder="值" @change="updateCond(i, { value: cond.value })" />
          <button class="mini-btn danger" title="删除此条件" @click="removeCondition(i)">×</button>
        </div>
        <button class="ghost-btn" @click="addCondition">+ 添加条件（AND）</button>
      </template>

      <!-- GROUP BY -->
      <template v-else-if="nodeData.kind === 'groupBy'">
        <label class="field-label">分组列（逗号分隔）</label>
        <input
          class="field-input"
          :value="(nodeData.groupByCols || []).join(', ')"
          placeholder="如：月份"
          @change="emit('update', { groupByCols: ($event.target as HTMLInputElement).value.split(/[,，]/).map(s => s.trim()).filter(Boolean) })"
        />
      </template>

      <!-- SELECT -->
      <template v-else-if="isSelect">
        <label class="field-label">输出列（逗号分隔，留空 = 全部列）</label>
        <input
          class="field-input"
          :value="(nodeData.selectCols || []).join(', ')"
          placeholder="如：月份"
          @change="emit('update', { selectCols: ($event.target as HTMLInputElement).value.split(/[,，]/).map(s => s.trim()).filter(Boolean) })"
        />

        <label class="field-label">聚合列（每行一个，如 SUM(金额) AS 总金额）</label>
        <textarea class="field-textarea" :value="aggregateText" placeholder="SUM(金额) AS 总金额&#10;COUNT(*) AS 单数" rows="3" @change="aggregateText = ($event.target as HTMLTextAreaElement).value" />

        <div class="pair-row">
          <div class="pair-item">
            <label class="field-label">排序列</label>
            <input v-model="nodeData.orderByCol" class="field-input" list="vp-list-cols" placeholder="可选" @change="emit('update', { orderByCol: nodeData.orderByCol })" />
          </div>
          <div class="pair-item pair-small">
            <label class="field-label">方向</label>
            <select v-model="nodeData.orderByDesc" class="field-input" @change="emit('update', { orderByDesc: nodeData.orderByDesc })">
              <option :value="false">ASC</option>
              <option :value="true">DESC</option>
            </select>
          </div>
        </div>

        <label class="field-label">行数限制</label>
        <input
          class="field-input"
          type="number"
          min="0"
          :value="nodeData.limit ?? ''"
          placeholder="不限制"
          @change="emit('update', { limit: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null })"
        />
      </template>

      <!-- INSERT -->
      <template v-else-if="nodeData.kind === 'insert'">
        <label class="field-label">写回目标表</label>
        <input v-model="nodeData.targetTable" class="field-input" list="vp-list-tables" placeholder="选择或输入目标表" @change="emit('update', { targetTable: nodeData.targetTable })" />
        <p class="field-tip">写入在单一事务中执行，失败自动回滚；执行前需双重确认。</p>
      </template>

      <!-- 通用操作 -->
      <div class="panel-actions">
        <button class="primary-btn" :disabled="probing" @click="emit('probe')">
          <Play class="btn-icon" />
          {{ probing ? "探查中…" : "探查此节点" }}
        </button>
        <button class="text-danger-btn" @click="emit('remove')">
          <Trash2 class="btn-icon" />
          删除节点
        </button>
      </div>
    </div>

    <datalist id="vp-list-tables">
      <option v-for="t in tables" :key="t" :value="t" />
    </datalist>
    <datalist id="vp-list-cols">
      <option v-for="c in columns" :key="c" :value="c" />
    </datalist>
  </div>
</template>

<style scoped lang="scss">
.prop-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.kind-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
}

.panel-empty {
  padding: 24px 14px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.field-input,
.field-textarea {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-card);
  box-sizing: border-box;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
}

.field-textarea {
  resize: vertical;
  font-family: Consolas, monospace;
}

.field-tip {
  margin: 0;
  font-size: 11px;
  color: var(--color-warning);
  background: var(--tag-bg-warning);
  border-radius: 6px;
  padding: 6px 8px;
}

.cond-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.cond-field {
  flex: 1.2;
}

.cond-op {
  flex: 0 0 64px;
}

.cond-value {
  flex: 1;
}

.mini-btn {
  flex: 0 0 22px;
  height: 22px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;

  &:hover {
    background: var(--tag-bg-danger);
    color: var(--color-error);
  }

  &.danger {
    color: var(--color-error);
  }
}

.ghost-btn {
  align-self: flex-start;
  padding: 4px 8px;
  border: 1px dashed var(--border-subtle);
  border-radius: 6px;
  background: transparent;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.pair-row {
  display: flex;
  gap: 8px;
}

.pair-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.pair-small {
    flex: 0 0 76px;
  }
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 0;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--color-primary-light);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.text-danger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 0;
  border: none;
  background: transparent;
  color: var(--color-error);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.btn-icon {
  width: 12px;
  height: 12px;
}
</style>
