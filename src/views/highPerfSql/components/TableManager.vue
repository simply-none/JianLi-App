<template>
  <div class="table-manager">
    <div class="content-area">
      <div class="section-card" v-if="operation === 'create'">
        <div class="section-title">创建表</div>

        <div class="section-card">
          <div class="section-title">表名</div>
          <el-input v-model="tableForm.tableName" placeholder="请输入表名" />
        </div>

        <div class="section-card">
          <div class="section-title">字段定义</div>
          <div class="fields-table">
            <table class="def-table">
              <thead>
                <tr>
                  <th>字段名</th>
                  <th>类型</th>
                  <th>约束</th>
                  <th>默认值</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(field, index) in tableForm.fields" :key="index">
                  <td>
                    <el-input v-model="field.name" placeholder="字段名" class="field-input" />
                  </td>
                  <td>
                    <el-select v-model="field.type" class="type-select">
                      <el-option label="INTEGER" value="INTEGER" />
                      <el-option label="TEXT" value="TEXT" />
                      <el-option label="REAL" value="REAL" />
                      <el-option label="BLOB" value="BLOB" />
                      <el-option label="DATE" value="DATE" />
                      <el-option label="TIME" value="TIME" />
                      <el-option label="DATETIME" value="DATETIME" />
                    </el-select>
                  </td>
                  <td>
                    <div class="constraints">
                      <el-checkbox v-model="field.primaryKey">主键</el-checkbox>
                      <el-checkbox v-model="field.notNull">非空</el-checkbox>
                      <el-checkbox v-model="field.unique">唯一</el-checkbox>
                      <el-checkbox v-model="field.autoIncrement">自增</el-checkbox>
                    </div>
                  </td>
                  <td>
                    <el-input v-model="field.defaultValue" placeholder="默认值" class="default-input" />
                  </td>
                  <td>
                    <button
                      v-if="tableForm.fields.length > 1"
                      class="remove-field"
                      @click="removeField(index)"
                    >
                      <span class="remove-icon">×</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button class="add-field" @click="addField">+ 添加字段</button>
        </div>

        <div class="section-card">
          <div class="section-title">索引定义</div>
          <div v-if="tableForm.indexes.length > 0">
            <div
              v-for="(index, indexIndex) in tableForm.indexes"
              :key="indexIndex"
              class="index-row"
            >
              <el-input v-model="index.name" placeholder="索引名" class="index-name" />
              <el-select v-model="index.field" placeholder="字段" class="index-field">
                <el-option
                  v-for="field in tableForm.fields.filter(f => f.name)"
                  :key="field.name"
                  :label="field.name"
                  :value="field.name"
                />
              </el-select>
              <el-checkbox v-model="index.unique">唯一索引</el-checkbox>
              <el-select v-model="index.direction">
                <el-option label="升序" value="ASC" />
                <el-option label="降序" value="DESC" />
              </el-select>
              <button class="remove-index" @click="removeIndex(indexIndex)">
                <span class="remove-icon">×</span>
              </button>
            </div>
          </div>
          <button class="add-index" @click="addIndex">+ 添加索引</button>
        </div>
      </div>

      <div class="section-card" v-else>
        <div class="section-title">删除表</div>

        <div class="section-card">
          <div class="section-title">选择要删除的表</div>
          <el-select v-model="dropForm.tableName" placeholder="请选择表">
            <el-option
              v-for="table in tables"
              :key="table.name"
              :label="table.name"
              :value="table.name"
            />
          </el-select>
        </div>
      </div>
    </div>

    <div class="bottom-area">
      <div class="section-card">
        <div class="section-title">生成的 SQL</div>
        <div class="sql-preview">{{ operation === 'create' ? generatedSql : dropSql }}</div>
      </div>

      <div class="action-buttons">
        <el-button v-if="operation === 'create'" type="primary" @click="createTable">创建表</el-button>
        <el-button v-if="operation === 'create'" @click="generateSql">生成 SQL</el-button>
        <el-button v-else type="danger" @click="dropTable">删除表</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";

interface Table {
  name: string;
}

interface FieldDef {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  unique: boolean;
  autoIncrement: boolean;
  defaultValue: string;
}

interface IndexDef {
  name: string;
  field: string;
  unique: boolean;
  direction: string;
}

defineProps<{
  operation: "create" | "drop";
  tables: Table[];
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

const tableForm = reactive({
  tableName: "",
  fields: [{
    name: "",
    type: "TEXT",
    primaryKey: false,
    notNull: false,
    unique: false,
    autoIncrement: false,
    defaultValue: "",
  } as FieldDef],
  indexes: [] as IndexDef[],
});

const dropForm = reactive({
  tableName: "",
});

function addField() {
  tableForm.fields.push({
    name: "",
    type: "TEXT",
    primaryKey: false,
    notNull: false,
    unique: false,
    autoIncrement: false,
    defaultValue: "",
  });
}

function removeField(index: number) {
  tableForm.fields.splice(index, 1);
}

function addIndex() {
  tableForm.indexes.push({
    name: "",
    field: "",
    unique: false,
    direction: "ASC",
  });
}

function removeIndex(index: number) {
  tableForm.indexes.splice(index, 1);
}

const generatedSql = computed(() => {
  if (!tableForm.tableName) return "-- 请输入表名";

  const fieldDefs = tableForm.fields.map(field => {
    if (!field.name) return "";

    let def = `${field.name} ${field.type}`;
    if (field.primaryKey) def += " PRIMARY KEY";
    if (field.autoIncrement) def += " AUTOINCREMENT";
    if (field.notNull) def += " NOT NULL";
    if (field.unique) def += " UNIQUE";
    if (field.defaultValue) def += ` DEFAULT ${field.defaultValue}`;

    return def;
  }).filter(Boolean);

  if (fieldDefs.length === 0) return "-- 请添加字段";

  let sql = `CREATE TABLE IF NOT EXISTS ${tableForm.tableName} (\n`;
  sql += "  " + fieldDefs.join(",\n  ") + "\n";
  sql += ");";

  if (tableForm.indexes.length > 0) {
    tableForm.indexes.forEach(index => {
      if (index.name && index.field) {
        sql += `\n\nCREATE ${index.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${index.name} ON ${tableForm.tableName} (${index.field} ${index.direction});`;
      }
    });
  }

  return sql;
});

const dropSql = computed(() => {
  if (!dropForm.tableName) return "-- 请选择表";
  return `DROP TABLE IF EXISTS ${dropForm.tableName};`;
});

function createTable() {
  emit("execute", generatedSql.value);
}

function generateSql() {}

function dropTable() {
  emit("execute", dropSql.value);
}
</script>

<style scoped lang="scss">
.table-manager {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

.section-card {
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

.fields-table {
  overflow-x: auto;
}

.def-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
}

.def-table th,
.def-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;
}

.def-table th {
  background: var(--bg-card);
  font-weight: 600;
  color: var(--text-primary);
  border-top: 1px solid var(--border-subtle);
}

.def-table th:first-child {
  border-left: 1px solid var(--border-subtle);
}

.def-table th:last-child {
  border-right: 1px solid var(--border-subtle);
}

.def-table td {
  border-left: 1px solid var(--border-subtle);
  border-right: 1px solid var(--border-subtle);
}

.def-table tr:hover td {
  background: var(--bg-hover);
}

.field-input {
  width: 100%;
}

.type-select {
  width: 100%;
}

.constraints {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.default-input {
  width: 100%;
}

.remove-field {
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

.add-field {
  margin-top: 16px;
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

.index-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  padding: 10px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
}

.index-name,
.index-field {
  width: 100%;
}

.remove-index {
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

.add-index {
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

.bottom-area {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  justify-content: flex-start;
}
</style>
