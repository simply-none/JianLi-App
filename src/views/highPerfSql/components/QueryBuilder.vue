<script setup lang="ts">
/**
 * 查询构建器（「高级 SQL」分页）：可视化拼 SELECT——字段/WHERE/GROUP BY/HAVING/ORDER BY/分页/JOIN。
 * 生成 SQL 经 emit("execute"/"explain") → index.vue 统一执行。
 */
import { ref, reactive, computed } from "vue";
import { Play, Eye, Copy, Check } from "@lucide/vue";

interface Field {
  name: string;
  type: string;
}

interface Condition {
  field: string;
  operator: string;
  value: string;
  logic: string;
}

const props = defineProps<{
  tables: string[];
  tableFields: Record<string, Field[]>;
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
  (e: "explain", sql: string): void;
}>();

const OPERATORS = [
  { label: "等于", value: "=" },
  { label: "不等于", value: "!=" },
  { label: "大于", value: ">" },
  { label: "小于", value: "<" },
  { label: "大于等于", value: ">=" },
  { label: "小于等于", value: "<=" },
  { label: "模糊匹配", value: "LIKE" },
  { label: "不匹配", value: "NOT LIKE" },
  { label: "包含于", value: "IN" },
  { label: "不包含于", value: "NOT IN" },
  { label: "在范围内", value: "BETWEEN" },
  { label: "不在范围内", value: "NOT BETWEEN" },
  { label: "为空", value: "IS NULL" },
  { label: "不为空", value: "IS NOT NULL" },
];

const JOIN_TYPES = ["INNER", "LEFT", "RIGHT", "FULL"];

const queryForm = reactive({
  tableName: "",
  selectedFields: [] as string[],
  distinct: false,
  conditions: [{ field: "", operator: "=", value: "", logic: "AND" } as Condition],
  groupByEnabled: false,
  groupByFields: [] as string[],
  havingEnabled: false,
  havingCondition: "",
  orderByEnabled: false,
  orderByField: "",
  orderByDirection: "ASC",
  limit: 100,
  offset: 0,
  joinEnabled: false,
  joinType: "INNER",
  joinTable: "",
  joinField1: "",
  joinField2: "",
});

const copied = ref(false);

const currentFields = computed(() => props.tableFields[queryForm.tableName] || []);
const joinTableFields = computed(() => props.tableFields[queryForm.joinTable] || []);
const selectAllFields = computed(
  () => currentFields.value.length > 0 && currentFields.value.every((f) => queryForm.selectedFields.includes(f.name))
);

function toggleField(name: string) {
  const i = queryForm.selectedFields.indexOf(name);
  if (i >= 0) queryForm.selectedFields.splice(i, 1);
  else queryForm.selectedFields.push(name);
}

function toggleSelectAll() {
  queryForm.selectedFields = selectAllFields.value ? [] : currentFields.value.map((f) => f.name);
}

function toggleGroupBy(name: string) {
  const i = queryForm.groupByFields.indexOf(name);
  if (i >= 0) queryForm.groupByFields.splice(i, 1);
  else queryForm.groupByFields.push(name);
}

function handleTableChange() {
  queryForm.selectedFields = [];
  queryForm.groupByFields = [];
  queryForm.conditions = [{ field: "", operator: "=", value: "", logic: "AND" }];
}

function addCondition() {
  queryForm.conditions.push({ field: "", operator: "=", value: "", logic: "AND" });
}

function removeCondition(index: number) {
  queryForm.conditions.splice(index, 1);
}

function getPlaceholder(operator: string): string {
  if (operator.includes("NULL")) return "";
  if (operator.includes("IN")) return "(value1, value2, ...)";
  if (operator.includes("BETWEEN")) return "value1 AND value2";
  if (operator === "LIKE") return "%pattern%";
  return "请输入值";
}

function q(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

const generatedSql = computed(() => {
  if (!queryForm.tableName) return "-- 请选择表";

  const fields = queryForm.selectedFields.length > 0 ? queryForm.selectedFields.map(q).join(", ") : "*";
  let sql = `SELECT ${queryForm.distinct ? "DISTINCT " : ""}${fields} FROM ${q(queryForm.tableName)}`;

  if (queryForm.joinEnabled && queryForm.joinTable) {
    sql += ` ${queryForm.joinType} JOIN ${q(queryForm.joinTable)}`;
    if (queryForm.joinField1 && queryForm.joinField2) {
      sql += ` ON ${q(queryForm.tableName)}.${q(queryForm.joinField1)} = ${q(queryForm.joinTable)}.${q(queryForm.joinField2)}`;
    }
  }

  const conds = queryForm.conditions.filter((c) => c.field);
  if (conds.length > 0) {
    const parts: string[] = [];
    conds.forEach((cond, i) => {
      let valuePart = "";
      if (cond.operator.includes("NULL")) {
        valuePart = "";
      } else if (cond.operator.includes("IN") || cond.operator.includes("BETWEEN")) {
        valuePart = ` ${cond.value}`;
      } else {
        const fieldType = currentFields.value.find((f) => f.name === cond.field)?.type;
        const isNumber = fieldType && /INT|REAL|FLOAT|NUMERIC/i.test(fieldType);
        valuePart = ` ${isNumber ? cond.value : `'${cond.value.replace(/'/g, "''")}'`}`;
      }
      const fragment = `${q(cond.field)} ${cond.operator}${valuePart}`;
      if (i === 0) parts.push(fragment);
      else parts.push(cond.logic, fragment);
    });
    sql += " WHERE " + parts.join(" ");
  }

  if (queryForm.groupByEnabled && queryForm.groupByFields.length > 0) {
    sql += " GROUP BY " + queryForm.groupByFields.map(q).join(", ");
  }

  if (queryForm.havingEnabled && queryForm.havingCondition.trim()) {
    sql += " HAVING " + queryForm.havingCondition.trim();
  }

  if (queryForm.orderByEnabled && queryForm.orderByField) {
    sql += ` ORDER BY ${q(queryForm.orderByField)} ${queryForm.orderByDirection}`;
  }

  if (queryForm.limit > 0) sql += ` LIMIT ${queryForm.limit}`;
  if (queryForm.offset > 0) sql += ` OFFSET ${queryForm.offset}`;

  return sql;
});

function executeQuery() {
  if (!queryForm.tableName) return;
  emit("execute", generatedSql.value);
}

function showExplain() {
  if (!queryForm.tableName) return;
  emit("explain", generatedSql.value);
}

async function copySql() {
  try {
    await navigator.clipboard.writeText(generatedSql.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* 剪贴板不可用时静默 */
  }
}
</script>

<template>
  <div class="ap-body">
    <div class="ap-card">
      <div class="ap-card-title">表选择</div>
      <div class="ap-row">
        <select v-model="queryForm.tableName" class="ap-field f-table" @change="handleTableChange">
          <option value="" disabled>请选择表</option>
          <option v-for="t in props.tables" :key="t" :value="t">{{ t }}</option>
        </select>
        <label class="ap-check"><input v-model="queryForm.distinct" type="checkbox" />去重 (DISTINCT)</label>
      </div>
    </div>

    <div class="ap-card">
      <div class="ap-card-title">
        字段选择
        <label class="ap-check all-check"><input type="checkbox" :checked="selectAllFields" @change="toggleSelectAll" />全选</label>
      </div>
      <div v-if="currentFields.length === 0" class="ap-empty">选择表后展示字段</div>
      <div v-else class="field-chips">
        <button
          v-for="f in currentFields"
          :key="f.name"
          class="chip"
          :class="{ on: queryForm.selectedFields.includes(f.name) }"
          @click="toggleField(f.name)"
        >
          {{ f.name }}
        </button>
      </div>
    </div>

    <div class="ap-card">
      <div class="ap-card-title">WHERE 条件</div>
      <div class="cond-list">
        <div v-for="(cond, i) in queryForm.conditions" :key="i" class="cond-row">
          <select v-model="cond.field" class="ap-field c-field">
            <option value="" disabled>字段</option>
            <option v-for="f in currentFields" :key="f.name" :value="f.name">{{ f.name }}</option>
          </select>
          <select v-model="cond.operator" class="ap-field c-op">
            <option v-for="op in OPERATORS" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>
          <input
            v-if="!cond.operator.includes('NULL')"
            v-model="cond.value"
            class="ap-field c-value"
            :placeholder="getPlaceholder(cond.operator)"
            @keyup.enter="executeQuery"
          />
          <select v-if="i < queryForm.conditions.length - 1" v-model="cond.logic" class="ap-field c-logic">
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
          <button v-if="queryForm.conditions.length > 1" class="cond-del" title="删除条件" @click="removeCondition(i)">×</button>
        </div>
      </div>
      <button class="add-cond" @click="addCondition">＋ 添加条件</button>
    </div>

    <div class="ap-card">
      <div class="ap-card-title">分组与排序</div>
      <div class="grp-rows">
        <label class="ap-check"><input v-model="queryForm.groupByEnabled" type="checkbox" />GROUP BY</label>
        <div v-if="queryForm.groupByEnabled && currentFields.length > 0" class="field-chips indent">
          <button
            v-for="f in currentFields"
            :key="f.name"
            class="chip"
            :class="{ on: queryForm.groupByFields.includes(f.name) }"
            @click="toggleGroupBy(f.name)"
          >
            {{ f.name }}
          </button>
        </div>
        <div v-if="queryForm.groupByEnabled" class="ap-row">
          <span class="ap-label">HAVING</span>
          <input v-model="queryForm.havingCondition" class="ap-field f-having" placeholder="例如 COUNT(*) > 10" />
        </div>
        <label class="ap-check"><input v-model="queryForm.orderByEnabled" type="checkbox" />ORDER BY</label>
        <div v-if="queryForm.orderByEnabled" class="ap-row">
          <select v-model="queryForm.orderByField" class="ap-field f-order">
            <option value="" disabled>排序字段</option>
            <option v-for="f in currentFields" :key="f.name" :value="f.name">{{ f.name }}</option>
          </select>
          <button class="chip" :class="{ on: queryForm.orderByDirection === 'ASC' }" @click="queryForm.orderByDirection = 'ASC'">升序</button>
          <button class="chip" :class="{ on: queryForm.orderByDirection === 'DESC' }" @click="queryForm.orderByDirection = 'DESC'">降序</button>
        </div>
        <div class="ap-row">
          <span class="ap-label">LIMIT</span>
          <input v-model.number="queryForm.limit" type="number" min="0" class="ap-field f-num" />
          <span class="ap-label gap-l">OFFSET</span>
          <input v-model.number="queryForm.offset" type="number" min="0" class="ap-field f-num" />
        </div>
      </div>
    </div>

    <div class="ap-card">
      <div class="ap-card-title">
        JOIN
        <label class="ap-check all-check"><input v-model="queryForm.joinEnabled" type="checkbox" />启用</label>
      </div>
      <div v-if="queryForm.joinEnabled" class="join-box">
        <div class="ap-row">
          <button
            v-for="t in JOIN_TYPES"
            :key="t"
            class="chip"
            :class="{ on: queryForm.joinType === t }"
            @click="queryForm.joinType = t"
          >
            {{ t }}
          </button>
          <select v-model="queryForm.joinTable" class="ap-field f-table">
            <option value="" disabled>关联表</option>
            <option v-for="t in props.tables.filter((x) => x !== queryForm.tableName)" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="ap-row">
          <select v-model="queryForm.joinField1" class="ap-field f-join-field">
            <option value="" disabled>本表字段</option>
            <option v-for="f in currentFields" :key="f.name" :value="f.name">{{ f.name }}</option>
          </select>
          <span class="ap-label">=</span>
          <select v-model="queryForm.joinField2" class="ap-field f-join-field">
            <option value="" disabled>关联字段</option>
            <option v-for="f in joinTableFields" :key="f.name" :value="f.name">{{ f.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="ap-card">
      <div class="ap-card-title">SQL 预览</div>
      <code class="ap-sql">{{ generatedSql }}</code>
    </div>

    <div class="ap-footer">
      <div class="foot-actions">
        <button class="primary-btn" :disabled="!queryForm.tableName" @click="executeQuery"><Play class="btn-icon" />执行查询</button>
        <button class="ghost-btn" :disabled="!queryForm.tableName" @click="showExplain"><Eye class="btn-icon" />执行计划</button>
      </div>
      <button class="ghost-btn" @click="copySql">
        <Check v-if="copied" class="btn-icon" />
        <Copy v-else class="btn-icon" />{{ copied ? "已复制" : "复制 SQL" }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "./panel.scss" as *;

.f-table {
  flex: 0 0 220px;
}

.all-check {
  margin-left: auto;
  font-weight: 400;
}

.field-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  &.indent {
    padding-left: 8px;
  }
}

.cond-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cond-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  flex-wrap: wrap;
}

.c-field {
  flex: 1;
  min-width: 110px;
}

.c-op {
  flex: 0 0 108px;
}

.c-value {
  flex: 1;
  min-width: 130px;
}

.c-logic {
  flex: 0 0 76px;
}

.cond-del {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: var(--tag-bg-danger);
  color: var(--color-error);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: var(--color-error);
    color: #fff;
  }
}

.add-cond {
  margin-top: 8px;
  padding: 7px 16px;
  background: transparent;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  width: fit-content;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    border-style: solid;
  }
}

.grp-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.f-having {
  flex: 1;
  min-width: 180px;
}

.f-order {
  flex: 0 0 180px;
}

.f-num {
  flex: 0 0 84px;
}

.gap-l {
  margin-left: 12px;
}

.join-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.f-join-field {
  flex: 1;
  min-width: 130px;
}

.foot-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 12px;
  height: 12px;
}
</style>
