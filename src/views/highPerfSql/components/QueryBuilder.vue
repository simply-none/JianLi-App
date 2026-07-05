<template>
  <div class="query-builder">
    <div class="builder-section-box">
    <div class="builder-section">
      <div class="section-title">表选择</div>
      <el-select
        v-model="queryForm.tableName"
        placeholder="请选择表"
        class="table-select"
        @change="handleTableChange"
      >
        <el-option
          v-for="table in tables"
          :key="table.name"
          :label="table.name"
          :value="table.name"
        />
      </el-select>
    </div>

    <div class="builder-section">
      <div class="section-title">字段选择</div>
      <div class="field-selector">
        <el-checkbox :checked="selectAllFields" @change="toggleSelectAll">
          全选
        </el-checkbox>
        <el-checkbox-group v-model="queryForm.selectedFields">
          <el-checkbox
            v-for="field in currentFields"
            :key="field.name"
            :label="field.name"
            :value="field.name"
          />
        </el-checkbox-group>
      </div>
      <div class="query-options">
        <el-checkbox v-model="queryForm.distinct">去重(DISTINCT)</el-checkbox>
        <el-checkbox v-model="queryForm.groupByEnabled">分组(GROUP BY)</el-checkbox>
        <el-checkbox v-model="queryForm.havingEnabled">分组条件(HAVING)</el-checkbox>
        <el-checkbox v-model="queryForm.orderByEnabled">排序(ORDER BY)</el-checkbox>
      </div>
    </div>

    <div class="builder-section" v-if="queryForm.groupByEnabled">
      <div class="section-title">GROUP BY</div>
      <el-select
        v-model="queryForm.groupByField"
        placeholder="选择分组字段"
        multiple
      >
        <el-option
          v-for="field in currentFields"
          :key="field.name"
          :label="field.name"
          :value="field.name"
        />
      </el-select>
    </div>

    <div class="builder-section" v-if="queryForm.havingEnabled">
      <div class="section-title">HAVING 条件</div>
      <el-input
        v-model="queryForm.havingCondition"
        placeholder="例如: COUNT(*) > 10"
      />
    </div>

    <div class="builder-section" v-if="queryForm.orderByEnabled">
      <div class="section-title">ORDER BY</div>
      <div class="order-by-row">
        <el-select
          v-model="queryForm.orderByField"
          placeholder="选择排序字段"
        >
          <el-option
            v-for="field in currentFields"
            :key="field.name"
            :label="field.name"
            :value="field.name"
          />
        </el-select>
        <el-select v-model="queryForm.orderByDirection">
          <el-option label="升序" value="ASC" />
          <el-option label="降序" value="DESC" />
        </el-select>
      </div>
    </div>

    <div class="builder-section">
      <div class="section-title">WHERE 条件构建器</div>
      <div class="conditions-container">
        <div
          v-for="(condition, index) in queryForm.conditions"
          :key="index"
          class="condition-row"
        >
          <el-select
            v-model="condition.field"
            placeholder="字段"
            class="condition-field"
          >
            <el-option
              v-for="field in currentFields"
              :key="field.name"
              :label="field.name"
              :value="field.name"
            />
          </el-select>
          <el-select
            v-model="condition.operator"
            placeholder="运算符"
            class="condition-operator"
          >
            <el-option
              v-for="op in operators"
              :key="op.value"
              :label="op.label"
              :value="op.value"
            />
          </el-select>
          <el-input
            v-model="condition.value"
            :placeholder="getPlaceholder(condition.operator)"
            class="condition-value"
          />
          <div class="condition-logic">
            <el-select
              v-model="condition.logic"
              v-if="index < queryForm.conditions.length - 1"
            >
              <el-option label="与" value="AND" />
              <el-option label="或" value="OR" />
            </el-select>
            <button
              v-if="queryForm.conditions.length > 1"
              class="remove-condition"
              @click="removeCondition(index)"
            >
              <span class="remove-icon">×</span>
            </button>
          </div>
        </div>
      </div>
      <button class="add-condition" @click="addCondition">
        + 添加条件
      </button>
    </div>

    <div class="builder-section">
      <div class="section-title">分页设置</div>
      <div class="pagination-row">
        <el-input-number
          v-model="queryForm.limit"
          :min="1"
          :max="1000"
          label="限制条数(LIMIT)"
          class="pagination-input"
        />
        <el-input-number
          v-model="queryForm.offset"
          :min="0"
          label="偏移量(OFFSET)"
          class="pagination-input"
        />
      </div>
    </div>

    <div class="builder-section">
      <div class="section-title">JOIN 操作</div>
      <div v-if="queryForm.joinEnabled" class="join-container">
        <div class="join-row">
          <el-select v-model="queryForm.joinType">
            <el-option label="内连接" value="INNER" />
            <el-option label="左连接" value="LEFT" />
            <el-option label="右连接" value="RIGHT" />
            <el-option label="全连接" value="FULL" />
          </el-select>
          <el-select v-model="queryForm.joinTable" placeholder="关联表">
            <el-option
              v-for="table in tables.filter(t => t.name !== queryForm.tableName)"
              :key="table.name"
              :label="table.name"
              :value="table.name"
            />
          </el-select>
        </div>
        <div class="join-on-row">
          <span class="join-label">ON</span>
          <el-select v-model="queryForm.joinField1" placeholder="字段1">
            <el-option
              v-for="field in currentFields"
              :key="field.name"
              :label="field.name"
              :value="field.name"
            />
          </el-select>
          <span class="join-operator">=</span>
          <el-select v-model="queryForm.joinField2" placeholder="字段2">
            <el-option
              v-for="field in getJoinTableFields()"
              :key="field.name"
              :label="field.name"
              :value="field.name"
            />
          </el-select>
        </div>
      </div>
      <el-checkbox v-model="queryForm.joinEnabled">启用 JOIN</el-checkbox>
    </div>
    </div>
    <div class="action-buttons-box">
    <div class="builder-section">
      <div class="section-title">生成的 SQL</div>
      <div class="sql-preview">{{ generatedSql }}</div>
    </div>

    <div class="action-buttons">
      <el-button type="primary" @click="executeQuery">执行查询</el-button>
      <el-button @click="showExplain">执行计划</el-button>
      <el-button @click="exportResult">导出结果</el-button>
      <el-button @click="testConcurrency">并发测试</el-button>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";

interface Table {
  name: string;
}

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
  tables: Table[];
  tableFields: Record<string, Field[]>;
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
  (e: "explain", sql: string): void;
}>();

const operators = [
  { label: "等于", value: "=" },
  { label: "不等于", value: "!=" },
  { label: "大于", value: ">" },
  { label: "小于", value: "<" },
  { label: "大于等于", value: ">=" },
  { label: "小于等于", value: "<=" },
  { label: "模糊匹配", value: "LIKE" },
  { label: "不匹配", value: "NOT LIKE" },
  { label: "全局匹配", value: "GLOB" },
  { label: "不全局匹配", value: "NOT GLOB" },
  { label: "包含于", value: "IN" },
  { label: "不包含于", value: "NOT IN" },
  { label: "在范围内", value: "BETWEEN" },
  { label: "不在范围内", value: "NOT BETWEEN" },
  { label: "为空", value: "IS NULL" },
  { label: "不为空", value: "IS NOT NULL" },
];

const queryForm = reactive({
  tableName: "",
  selectedFields: [] as string[],
  distinct: false,
  conditions: [
    { field: "", operator: "=", value: "", logic: "AND" } as Condition,
  ],
  groupByEnabled: false,
  groupByField: [] as string[],
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

const selectAllFields = computed(() => {
  const fields = props.tableFields[queryForm.tableName] || [];
  return fields.length > 0 && fields.every(f => queryForm.selectedFields.includes(f.name));
});

const currentFields = computed(() => props.tableFields[queryForm.tableName] || []);

function toggleSelectAll(val: boolean) {
  const fields = props.tableFields[queryForm.tableName] || [];
  queryForm.selectedFields = val ? fields.map(f => f.name) : [];
}

function handleTableChange() {
  queryForm.selectedFields = [];
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
  if (operator === "IN" || operator === "NOT IN") return "(value1, value2, ...)";
  if (operator === "BETWEEN" || operator === "NOT BETWEEN") return "value1 AND value2";
  if (operator === "LIKE") return "%pattern%";
  if (operator === "GLOB") return "*pattern*";
  return "请输入值";
}

function getJoinTableFields(): Field[] {
  return props.tableFields[queryForm.joinTable] || [];
}

const generatedSql = computed(() => {
  if (!queryForm.tableName) return "-- 请选择表";

  const fields = queryForm.selectedFields.length > 0
    ? queryForm.selectedFields.join(", ")
    : "*";

  let sql = `SELECT ${queryForm.distinct ? "DISTINCT " : ""}${fields} FROM ${queryForm.tableName}`;

  if (queryForm.joinEnabled && queryForm.joinTable) {
    sql += ` ${queryForm.joinType} JOIN ${queryForm.joinTable}`;
    if (queryForm.joinField1 && queryForm.joinField2) {
      sql += ` ON ${queryForm.tableName}.${queryForm.joinField1} = ${queryForm.joinTable}.${queryForm.joinField2}`;
    }
  }

  const whereParts: string[] = [];
  queryForm.conditions.forEach((cond, index) => {
    if (!cond.field) return;

    let valuePart = "";
    if (cond.operator.includes("NULL")) {
      valuePart = "";
    } else if (cond.operator === "IN" || cond.operator === "NOT IN") {
      valuePart = ` ${cond.value}`;
    } else if (cond.operator === "BETWEEN" || cond.operator === "NOT BETWEEN") {
      valuePart = ` ${cond.value}`;
    } else {
      const fieldType = currentFields.value.find(f => f.name === cond.field)?.type;
      const isNumber = fieldType && (fieldType.includes("INT") || fieldType.includes("REAL") || fieldType.includes("FLOAT"));
      valuePart = ` ${isNumber ? cond.value : `'${cond.value}'`}`;
    }

    whereParts.push(`${cond.field} ${cond.operator}${valuePart}`);
  });

  if (whereParts.length > 0) {
    sql += " WHERE " + whereParts.join(" " + queryForm.conditions.map((c, i) => i < whereParts.length - 1 ? c.logic : "").filter(Boolean).join(" ") + " ");
  }

  if (queryForm.groupByEnabled && queryForm.groupByField.length > 0) {
    sql += " GROUP BY " + queryForm.groupByField.join(", ");
  }

  if (queryForm.havingEnabled && queryForm.havingCondition) {
    sql += " HAVING " + queryForm.havingCondition;
  }

  if (queryForm.orderByEnabled && queryForm.orderByField) {
    sql += " ORDER BY " + queryForm.orderByField + " " + queryForm.orderByDirection;
  }

  if (queryForm.limit) {
    sql += " LIMIT " + queryForm.limit;
  }

  if (queryForm.offset) {
    sql += " OFFSET " + queryForm.offset;
  }

  return sql;
});

function executeQuery() {
  emit("execute", generatedSql.value);
}

function showExplain() {
  emit("explain", generatedSql.value);
}

function exportResult() {}

function testConcurrency() {}
</script>

<style scoped lang="scss">
.query-builder {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.builder-section-box {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.builder-section {
  margin-bottom: 24px;
  background: var(--bg-base);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  padding: 20px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary-light);
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--color-primary-light);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: "";
    width: 8px;
    height: 8px;
    background: var(--color-primary);
    border-radius: 50%;
  }
}

.table-select {
  width: 220px;
}

.field-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  align-items: center;
}

.query-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.order-by-row {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 12px;
}

.conditions-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.condition-row {
  display: grid;
  grid-template-columns: 1fr 120px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
}

.condition-field,
.condition-operator {
  width: 100%;
  min-width: 120px;
}

.condition-value {
  flex: 1;
  min-width: 150px;
}

.condition-logic {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.remove-condition {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--color-error);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.remove-icon {
  font-size: 16px;
  line-height: 1;
}

.add-condition {
  margin-top: 12px;
  padding: 10px 20px;
  background: var(--bg-card);
  border: 2px dashed var(--border-subtle);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  width: fit-content;

  &:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
    border-style: solid;
  }
}

.pagination-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.pagination-input {
  width: 100%;
  max-width: 200px;
}

.join-container {
  margin-bottom: 16px;
}

.join-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.join-on-row {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 8px;
  align-items: center;
}

.join-label,
.join-operator {
  color: var(--text-secondary);
  font-weight: 500;
}

.sql-preview {
  background: linear-gradient(135deg, var(--bg-base) 0%, rgba(0, 0, 0, 0.1) 100%);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 16px;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 13px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  position: relative;

  &::before {
    content: "SQL 预览";
    position: absolute;
    top: -12px;
    left: 12px;
    background: var(--bg-card);
    padding: 0 8px;
    font-size: 12px;
    color: var(--text-muted);
  }
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
  justify-content: flex-start;
}
</style>
