<script setup lang="ts">
/**
 * 属性面板：编辑选中节点的参数。
 *
 * 教学强化：
 * - D1 顶部「这一步在做什么」说明卡（人话 + SQL 关键字）
 * - D2 底部「这一步生成的 SQL」实时对照块
 * - D3 WHERE 字段可选 chips，点一下填入，不用盲打
 * - D4 未选中时给出「积木说明 + 直接添加」引导，而不是一句干巴巴的空态
 * - D5 删除节点降噪为行尾图标（hover 才显红），避免每屏一个大红按钮
 */
import { computed } from "vue";
import { Play, Trash2, Plus, Lightbulb } from "@lucide/vue";
import type { PipelineNodeData, PipelineCondition, PipelineAggregate, NodeKind } from "../types";
import { KIND_META, nodeEmpty } from "../types";

const props = defineProps<{
  nodeData: PipelineNodeData | null;
  nodeId: string | null;
  tables: string[];
  columns: string[];
  probing: boolean;
  /** 节点在链路中的序号 */
  nodeOrder: Record<string, number>;
  /** 该节点生成的 SQL 片段（与画布节点同源） */
  fragment: string;
}>();

const emit = defineEmits<{
  (e: "update", patch: Partial<PipelineNodeData>): void;
  (e: "probe"): void;
  (e: "remove"): void;
  (e: "add", kind: NodeKind): void;
}>();

const meta = computed(() => (props.nodeData ? KIND_META[props.nodeData.kind] : null));
const order = computed(() => (props.nodeId ? props.nodeOrder[props.nodeId] ?? 0 : 0));
const isEmpty = computed(() => (props.nodeData ? nodeEmpty(props.nodeData) : false));
const isSelect = computed(() => props.nodeData?.kind === "select");
const isWhere = computed(() => props.nodeData?.kind === "where");

/** 全部 5 种积木（空态引导用） */
const ALL_KINDS: NodeKind[] = ["from", "where", "groupBy", "select", "insert"];

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

/** D3：点字段 chip 填入到第一个空条件里（没有空条件就新增一条） */
function fillField(col: string) {
  const conditions = [...(props.nodeData?.conditions || [])];
  const empty = conditions.findIndex((c) => !c.field);
  if (empty >= 0) conditions[empty] = { ...conditions[empty], field: col };
  else conditions.push({ field: col, op: "=", value: "" });
  emit("update", { conditions });
}

const groupByText = computed({
  get: () => (props.nodeData?.groupByCols || []).join(", "),
  set: (v: string) =>
    emit("update", { groupByCols: v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }),
});

const selectColsText = computed({
  get: () => (props.nodeData?.selectCols || []).join(", "),
  set: (v: string) =>
    emit("update", { selectCols: v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }),
});

/** D3（分组/输出同样适用）：点 chip 追加一列 */
function appendCol(col: string) {
  const current = props.nodeData?.groupByCols || [];
  if (current.includes(col)) return;
  emit("update", { groupByCols: [...current, col] });
}

function appendSelectCol(col: string) {
  const current = props.nodeData?.selectCols || [];
  if (current.includes(col)) return;
  emit("update", { selectCols: [...current, col] });
}
</script>

<template>
  <div class="prop-panel">
    <div class="panel-header">
      <span class="panel-title">
        <template v-if="nodeData">
          <span class="ph-order">{{ order }}</span>
          {{ meta!.humanLabel }}
        </template>
        <template v-else>步骤属性</template>
      </span>
      <span v-if="meta" class="kind-badge" :style="{ background: meta.softBg, color: meta.color }">
        {{ meta.label }}
      </span>
    </div>

    <!-- D4：未选中 → 引导式空态（列出积木说明，可直接点添加） -->
    <div v-if="!nodeData" class="panel-guide">
      <p class="guide-lead">在画布上点一个步骤，就能在右侧改它的设置。</p>
      <p class="guide-lead sub">还不确定要什么？下面是全部 5 种步骤，点一下直接加：</p>
      <button
        v-for="k in ALL_KINDS"
        :key="k"
        class="guide-item"
        @click="emit('add', k)"
      >
        <span class="gi-bar" :style="{ background: KIND_META[k].color }" />
        <span class="gi-body">
          <span class="gi-title">
            {{ KIND_META[k].humanLabel }}
            <em>{{ KIND_META[k].label }}</em>
          </span>
          <span class="gi-desc">{{ KIND_META[k].desc }}</span>
        </span>
        <Plus class="gi-plus" />
      </button>
    </div>

    <div v-else class="panel-body">
      <!-- D1：这一步在做什么 -->
      <div class="step-desc">
        <Lightbulb class="sd-icon" />
        <div class="sd-body">
          <div class="sd-title">{{ meta!.humanLabel }}在做什么？</div>
          <div class="sd-text">{{ meta!.desc }}</div>
          <div v-if="isEmpty" class="sd-warn">当前这一步还没配置，暂时不影响结果。</div>
        </div>
      </div>

      <!-- FROM -->
      <template v-if="nodeData.kind === 'from'">
        <label class="field-label">从哪张表取数</label>
        <input
          v-model="nodeData.table"
          class="field-input"
          list="vp-list-tables"
          placeholder="输入或从下拉里选一张表"
          @change="emit('update', { table: nodeData.table })"
        />
        <p class="field-help">整条流水线只能有一张来源表。要多表联查请用「SQL 控制台」。</p>
      </template>

      <!-- WHERE -->
      <template v-else-if="nodeData.kind === 'where'">
        <label class="field-label">只保留满足这些条件的行（条件之间是「并且」）</label>

        <div v-for="(cond, i) in nodeData.conditions" :key="i" class="cond-wrap">
          <span class="cond-join">{{ i === 0 ? "满足" : "并且" }}</span>
          <div class="cond-row">
            <input
              v-model="cond.field"
              class="field-input cond-field"
              list="vp-list-cols"
              placeholder="字段"
              @change="updateCond(i, { field: cond.field })"
            />
            <select v-model="cond.op" class="field-input cond-op" @change="updateCond(i, { op: cond.op })">
              <option v-for="op in ['=', '!=', '>', '<', '>=', '<=', 'LIKE']" :key="op" :value="op">{{ op }}</option>
            </select>
            <input
              v-model="cond.value"
              class="field-input cond-value"
              placeholder="值"
              @change="updateCond(i, { value: cond.value })"
            />
            <button class="mini-btn" title="删掉这个条件" @click="removeCondition(i)">
              <Trash2 class="mini-icon" />
            </button>
          </div>
        </div>

        <button class="ghost-btn" @click="addCondition">
          <Plus class="btn-icon" />
          再加一个条件
        </button>

        <!-- D3：可选字段 chips -->
        <div v-if="columns.length" class="col-chips">
          <span class="cc-label">该表可选字段（点一下填入）：</span>
          <div class="cc-list">
            <button
              v-for="c in columns.slice(0, 24)"
              :key="c"
              class="cc-chip"
              :class="{ used: (nodeData.conditions || []).some((x) => x.field === c) }"
              @click="fillField(c)"
            >
              {{ c }}
            </button>
          </div>
        </div>
      </template>

      <!-- GROUP BY -->
      <template v-else-if="nodeData.kind === 'groupBy'">
        <label class="field-label">按哪些列归并（用逗号分隔）</label>
        <input
          :value="groupByText"
          class="field-input"
          list="vp-list-cols"
          placeholder="例如：月份"
          @change="groupByText = ($event.target as HTMLInputElement).value"
        />
        <p class="field-help">归并之后，同一组的行会被当成一行来统计。</p>
        <div v-if="columns.length" class="col-chips">
          <span class="cc-label">点一下加入分组列：</span>
          <div class="cc-list">
            <button
              v-for="c in columns.slice(0, 24)"
              :key="c"
              class="cc-chip"
              :class="{ used: (nodeData.groupByCols || []).includes(c) }"
              @click="appendCol(c)"
            >
              {{ c }}
            </button>
          </div>
        </div>
      </template>

      <!-- SELECT -->
      <template v-else-if="isSelect">
        <label class="field-label">最后输出哪些列（留空 = 全部列）</label>
        <input
          :value="selectColsText"
          class="field-input"
          list="vp-list-cols"
          placeholder="例如：月份, 总金额"
          @change="selectColsText = ($event.target as HTMLInputElement).value"
        />
        <div v-if="columns.length" class="col-chips">
          <span class="cc-label">点一下加入输出列：</span>
          <div class="cc-list">
            <button
              v-for="c in columns.slice(0, 24)"
              :key="c"
              class="cc-chip"
              :class="{ used: (nodeData.selectCols || []).includes(c) }"
              @click="appendSelectCol(c)"
            >
              {{ c }}
            </button>
          </div>
        </div>

        <label class="field-label">汇总计算（每行一个，如 SUM(金额) AS 总金额）</label>
        <textarea
          class="field-textarea"
          :value="aggregateText"
          placeholder="SUM(金额) AS 总金额&#10;COUNT(*) AS 单数"
          rows="3"
          @change="aggregateText = ($event.target as HTMLTextAreaElement).value"
        />
        <p class="field-help">配合「分组统计」使用：先按某列分组，再对它求和 / 计数。</p>

        <div class="pair-row">
          <div class="pair-item">
            <label class="field-label">按哪列排序</label>
            <input
              v-model="nodeData.orderByCol"
              class="field-input"
              list="vp-list-cols"
              placeholder="可不填"
              @change="emit('update', { orderByCol: nodeData.orderByCol })"
            />
          </div>
          <div class="pair-item pair-small">
            <label class="field-label">方向</label>
            <select
              v-model="nodeData.orderByDesc"
              class="field-input"
              @change="emit('update', { orderByDesc: nodeData.orderByDesc })"
            >
              <option :value="false">从大到小？否</option>
              <option :value="true">从大到小？是</option>
            </select>
          </div>
        </div>

        <label class="field-label">最多取多少行</label>
        <input
          class="field-input"
          type="number"
          min="0"
          :value="nodeData.limit ?? ''"
          placeholder="不限制"
          @change="
            emit('update', {
              limit: ($event.target as HTMLInputElement).value
                ? Number(($event.target as HTMLInputElement).value)
                : null,
            })
          "
        />
      </template>

      <!-- INSERT -->
      <template v-else-if="nodeData.kind === 'insert'">
        <label class="field-label">结果存到哪张表</label>
        <input
          v-model="nodeData.targetTable"
          class="field-input"
          list="vp-list-tables"
          placeholder="输入或从下拉里选目标表"
          @change="emit('update', { targetTable: nodeData.targetTable })"
        />
        <p class="field-tip">
          这是写操作：会真的往表里存数据。执行前需要打开工具栏的「允许写回」并二次确认；整个过程在一个事务里，出错会自动撤销。
        </p>
      </template>

      <!-- D2：这一步生成的 SQL -->
      <div v-if="fragment" class="step-sql">
        <div class="ss-head">这一步生成的 SQL</div>
        <code class="ss-code">{{ fragment }}</code>
      </div>

      <!-- 操作：主按钮 + 降噪的删除 -->
      <div class="panel-actions">
        <button class="primary-btn" :disabled="probing" @click="emit('probe')">
          <Play class="btn-icon" />
          {{ probing ? "计算中…" : "看看这步有多少行" }}
        </button>
        <button class="del-btn" title="把这个步骤从画布上移掉" @click="emit('remove')">
          <Trash2 class="btn-icon" />
          移除此步骤
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
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.ph-order {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.kind-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

/* ===== D4 引导式空态 ===== */
.panel-guide {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.guide-lead {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;

  &.sub {
    color: var(--text-muted);
    font-size: 11px;
    margin-bottom: 6px;
  }
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 9px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);

    .gi-plus {
      opacity: 1;
      color: var(--color-primary);
    }
  }
}

.gi-bar {
  flex-shrink: 0;
  width: 3px;
  height: 26px;
  border-radius: 2px;
}

.gi-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.gi-title {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);

  em {
    font-style: normal;
    font-size: 9px;
    font-weight: 500;
    color: var(--text-muted);
  }
}

.gi-desc {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.gi-plus {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s;
}

/* ===== 有选中节点 ===== */
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

/* D1 说明卡 */
.step-desc {
  display: flex;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 8px;
  background: var(--color-primary-light);
  margin-bottom: 3px;
}

.sd-icon {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
  margin-top: 1px;
  color: var(--color-primary);
}

.sd-body {
  flex: 1;
  min-width: 0;
}

.sd-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.sd-text {
  font-size: 11px;
  color: var(--text-primary);
  line-height: 1.55;
}

.sd-warn {
  margin-top: 5px;
  padding: 3px 7px;
  border-radius: 5px;
  background: var(--tag-bg-warning);
  color: var(--color-warning);
  font-size: 10px;
  font-weight: 600;
}

.field-label {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.field-help {
  margin: -2px 0 2px;
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.5;
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
  font-size: 10.5px;
  color: var(--color-warning);
  background: var(--tag-bg-warning);
  border-radius: 6px;
  padding: 7px 9px;
  line-height: 1.55;
}

/* WHERE 条件行（带「满足 / 并且」前缀） */
.cond-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cond-join {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-primary);
  padding-left: 2px;
}

.cond-row {
  display: flex;
  gap: 5px;
  align-items: center;
}

.cond-field {
  flex: 1.2;
}

.cond-op {
  flex: 0 0 62px;
}

.cond-value {
  flex: 1;
}

.mini-btn {
  flex: 0 0 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;

  &:hover {
    background: var(--tag-bg-danger);
    color: var(--color-error);
  }
}

.mini-icon {
  width: 12px;
  height: 12px;
}

/* D3 字段 chips */
.col-chips {
  margin-top: 2px;
  padding: 8px 9px;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
}

.cc-label {
  display: block;
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

.cc-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cc-chip {
  padding: 2px 7px;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 10px;
  font-family: Consolas, monospace;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &.used {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: 600;
  }
}

/* D2 本步 SQL */
.step-sql {
  margin-top: 4px;
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
}

.ss-head {
  padding: 4px 9px;
  background: var(--bg-hover);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
}

.ss-code {
  display: block;
  padding: 7px 9px;
  background: #1e283c;
  color: #c4d2f0;
  font-family: Consolas, "Courier New", monospace;
  font-size: 10.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}

.ghost-btn {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
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
    flex: 0 0 96px;
  }
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
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

/* D5：删除降噪 —— 默认灰，hover 才红 */
.del-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  &:hover {
    background: var(--tag-bg-danger);
    color: var(--color-error);
  }
}

.btn-icon {
  width: 12px;
  height: 12px;
}
</style>
