<template>
  <div class="data-editor">
    <div class="editor-section-box"> 
   
    <div class="editor-section">
      <div class="section-title">{{ operation === 'insert' ? '插入数据' : operation === 'update' ? '更新数据' : '删除数据' }}</div>
    </div>

    <div class="editor-section">
      <div class="section-title">表选择</div>
      <el-select
        v-model="editorForm.tableName"
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

    <div class="editor-section" v-if="operation === 'update' || operation === 'delete'">
      <div class="section-title">WHERE 条件</div>
      <div class="conditions-container">
        <div
          v-for="(condition, index) in editorForm.conditions"
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
          <button
            v-if="editorForm.conditions.length > 1"
            class="remove-condition"
            @click="removeCondition(index)"
          >
            <span class="remove-icon">×</span>
          </button>
        </div>
      </div>
      <button class="add-condition" @click="addCondition">+ 添加条件</button>
    </div>

    <div class="editor-section" v-if="operation === 'insert' || operation === 'update'">
      <div class="section-title">字段值</div>
      <div class="field-values-table">
        <table class="values-table">
          <thead>
            <tr>
              <th>字段名</th>
              <th>类型</th>
              <th>值</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in editorForm.rows" :key="rowIndex">
              <td v-for="(field, fieldIndex) in currentFields" :key="field.name">
                <div v-if="fieldIndex === 0">
                  <span class="field-name">{{ field.name }}</span>
                </div>
                <div v-else-if="fieldIndex === 1">
                  <span class="field-type">{{ field.type }}</span>
                </div>
                <div v-else-if="fieldIndex === 2">
                  <el-input
                    v-model="row[field.name]"
                    :placeholder="getInputPlaceholder(field)"
                    class="field-value-input"
                  />
                </div>
                <div v-else>
                  <button
                    v-if="editorForm.rows.length > 1"
                    class="remove-row"
                    @click="removeRow(rowIndex)"
                  >
                    <span class="remove-icon">×</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="row-actions">
        <button class="add-row" @click="addRow">+ 添加行</button>
        <button class="import-json" @click="importJson">批量导入JSON</button>
      </div>
    </div>
     </div>
     <div class="action-buttons-box"> 
    <div class="editor-section">
      <div class="section-title">生成的 SQL</div>
      <div class="sql-preview">{{ generatedSql }}</div>
    </div>

    <div class="action-buttons">
      <el-button
        :type="operation === 'delete' ? 'danger' : 'primary'"
        @click="executeOperation"
      >
        {{ operation === 'insert' ? '插入数据' : operation === 'update' ? '更新数据' : '删除数据' }}
      </el-button>
      <el-button @click="testConcurrency(10)">并发测试(10次)</el-button>
      <el-button @click="testConcurrency(100)">并发测试(100次)</el-button>
    </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from "vue";

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
}

const props = defineProps<{
  operation: "insert" | "update" | "delete";
  tables: Table[];
  tableFields: Record<string, Field[]>;
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

const operators = [
  { label: "等于", value: "=" },
  { label: "不等于", value: "!=" },
  { label: "大于", value: ">" },
  { label: "小于", value: "<" },
  { label: "大于等于", value: ">=" },
  { label: "小于等于", value: "<=" },
  { label: "模糊匹配", value: "LIKE" },
  { label: "包含于", value: "IN" },
  { label: "为空", value: "IS NULL" },
];

const editorForm = reactive({
  tableName: "",
  conditions: [{ field: "", operator: "=", value: "" } as Condition],
  rows: [] as Record<string, string>[],
});

const currentFields = computed(() => props.tableFields[props.tableFields[editorForm.tableName]?.[0]?.name ? editorForm.tableName : ""] || []);

function handleTableChange() {
  const fields = props.tableFields[editorForm.tableName] || [];
  editorForm.rows = [fields.reduce((acc, f) => ({ ...acc, [f.name]: "" }), {})];
  editorForm.conditions = [{ field: "", operator: "=", value: "" }];
}

function addCondition() {
  editorForm.conditions.push({ field: "", operator: "=", value: "" });
}

function removeCondition(index: number) {
  editorForm.conditions.splice(index, 1);
}

function addRow() {
  const fields = props.tableFields[editorForm.tableName] || [];
  editorForm.rows.push(fields.reduce((acc, f) => ({ ...acc, [f.name]: "" }), {}));
}

function removeRow(index: number) {
  editorForm.rows.splice(index, 1);
}

function getPlaceholder(operator: string): string {
  if (operator.includes("NULL")) return "";
  if (operator === "IN") return "(value1, value2, ...)";
  if (operator === "LIKE") return "%pattern%";
  return "请输入值";
}

function getInputPlaceholder(field: Field): string {
  if (field.type.includes("INT")) return "整数";
  if (field.type.includes("REAL") || field.type.includes("FLOAT")) return "小数";
  if (field.type.includes("DATE") || field.type.includes("TIME")) return "YYYY-MM-DD";
  return "请输入值";
}

const generatedSql = computed(() => {
  if (!editorForm.tableName) return "-- 请选择表";

  if (props.operation === "insert") {
    const fields = currentFields.value.map(f => f.name);
    const values = editorForm.rows.map(row => {
      return "(" + fields.map(f => {
        const val = row[f];
        if (val === "") return "NULL";
        const fieldType = currentFields.value.find(field => field.name === f)?.type;
        if (fieldType && (fieldType.includes("INT") || fieldType.includes("REAL") || fieldType.includes("FLOAT"))) {
          return val;
        }
        return `'${val}'`;
      }).join(", ") + ")";
    });

    return `INSERT INTO ${editorForm.tableName} (${fields.join(", ")}) VALUES ${values.join(", ")};`;
  }

  if (props.operation === "update") {
    const fields = currentFields.value.filter(f => f.name.toLowerCase() !== "id");
    const setParts = fields.map(f => {
      const val = editorForm.rows[0]?.[f.name] || "";
      if (val === "") return "";
      const fieldType = currentFields.value.find(field => field.name === f.name)?.type;
      const valStr = fieldType && (fieldType.includes("INT") || fieldType.includes("REAL") || fieldType.includes("FLOAT")) ? val : `'${val}'`;
      return `${f.name} = ${valStr}`;
    }).filter(Boolean);

    if (setParts.length === 0) return "-- 请填写字段值";

    const whereParts = editorForm.conditions.map(cond => {
      if (!cond.field) return "";
      const val = cond.value;
      if (val === "") return "";
      const fieldType = currentFields.value.find(f => f.name === cond.field)?.type;
      const valStr = fieldType && (fieldType.includes("INT") || fieldType.includes("REAL") || fieldType.includes("FLOAT")) ? val : `'${val}'`;
      return `${cond.field} ${cond.operator} ${valStr}`;
    }).filter(Boolean);

    let sql = `UPDATE ${editorForm.tableName} SET ${setParts.join(", ")}`;
    if (whereParts.length > 0) {
      sql += " WHERE " + whereParts.join(" AND ");
    }
    return sql + ";";
  }

  if (props.operation === "delete") {
    const whereParts = editorForm.conditions.map(cond => {
      if (!cond.field) return "";
      const val = cond.value;
      if (val === "") return "";
      const fieldType = currentFields.value.find(f => f.name === cond.field)?.type;
      const valStr = fieldType && (fieldType.includes("INT") || fieldType.includes("REAL") || fieldType.includes("FLOAT")) ? val : `'${val}'`;
      return `${cond.field} ${cond.operator} ${valStr}`;
    }).filter(Boolean);

    if (whereParts.length === 0) return "-- 请添加删除条件";

    return `DELETE FROM ${editorForm.tableName} WHERE ${whereParts.join(" AND ")};`;
  }

  return "-- 未知操作";
});

function executeOperation() {
  emit("execute", generatedSql.value);
}

function testConcurrency(count: number) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => emit("execute", generatedSql.value), i * 50);
  }
}

function importJson() {}
</script>

<style scoped lang="scss">
.data-editor {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.editor-section-box {
  flex: 1;
}

.editor-section {
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

.field-values-table {
  overflow-x: auto;
}

.values-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
}

.values-table th,
.values-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;
}

.values-table th {
  background: var(--bg-card);
  font-weight: 600;
  color: var(--text-primary);
  border-top: 1px solid var(--border-subtle);
}

.values-table th:first-child {
  border-left: 1px solid var(--border-subtle);
}

.values-table th:last-child {
  border-right: 1px solid var(--border-subtle);
}

.values-table td {
  border-left: 1px solid var(--border-subtle);
  border-right: 1px solid var(--border-subtle);
}

.values-table tr:hover td {
  background: var(--bg-hover);
}

.field-name {
  font-weight: 500;
  color: var(--text-primary);
}

.field-type {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
}

.field-value-input {
  width: 100%;
}

.remove-row {
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

.row-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.add-row,
.import-json {
  padding: 10px 20px;
  background: var(--bg-card);
  border: 2px dashed var(--border-subtle);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
    border-style: solid;
  }
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
