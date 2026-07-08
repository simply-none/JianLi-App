<template>
  <div class="sql-executor">
    <div class="content-area">
      <div class="section-card">
        <div class="section-title">SQL 编辑器</div>
        <el-input
          type="textarea"
          v-model="sqlText"
          :rows="8"
          placeholder="请输入 SQL 语句..."
          class="sql-textarea"
        />
      </div>

      <div class="section-card">
        <div class="section-title">常用 SQL 模板</div>
        <div class="template-tags">
          <el-tag
            v-for="template in templates"
            :key="template.key"
            :closable="false"
            @click="applyTemplate(template)"
            class="template-tag"
          >
            {{ template.label }}
          </el-tag>
        </div>
      </div>
    </div>

    <div class="bottom-area">
      <div class="action-buttons">
        <el-button type="primary" @click="executeSql">执行 SQL</el-button>
        <el-button @click="showExplain">执行计划</el-button>
        <el-button @click="clearSql">清空</el-button>
        <el-button @click="formatSql">格式化</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface Template {
  key: string;
  label: string;
  sql: string;
}

const emit = defineEmits<{
  (e: "execute", sql: string): void;
  (e: "explain", sql: string): void;
}>();

const sqlText = ref("");

const templates: Template[] = [
  { key: "select", label: "SELECT 查询", sql: "SELECT * FROM table_name WHERE condition;" },
  { key: "insert", label: "INSERT 插入", sql: "INSERT INTO table_name (column1, column2) VALUES ('value1', 'value2');" },
  { key: "update", label: "UPDATE 更新", sql: "UPDATE table_name SET column1 = 'value1' WHERE condition;" },
  { key: "delete", label: "DELETE 删除", sql: "DELETE FROM table_name WHERE condition;" },
  { key: "create", label: "CREATE TABLE", sql: "CREATE TABLE IF NOT EXISTS table_name (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);" },
  { key: "index", label: "CREATE INDEX", sql: "CREATE INDEX idx_name ON table_name (column_name);" },
  { key: "view", label: "CREATE VIEW", sql: "CREATE VIEW view_name AS SELECT column1, column2 FROM table_name;" },
  { key: "pragma", label: "PRAGMA 查询", sql: "PRAGMA table_info(table_name);" },
  { key: "explain", label: "EXPLAIN", sql: "EXPLAIN QUERY PLAN SELECT * FROM table_name;" },
];

function applyTemplate(template: Template) {
  sqlText.value = template.sql;
}

function executeSql() {
  if (!sqlText.value.trim()) return;
  emit("execute", sqlText.value.trim());
}

function showExplain() {
  if (!sqlText.value.trim()) return;
  emit("explain", sqlText.value.trim());
}

function clearSql() {
  sqlText.value = "";
}

function formatSql() {
  if (!sqlText.value.trim()) return;
  sqlText.value = sqlText.value.replace(/;/g, ";\n").replace(/,/g, ", ");
}
</script>

<style scoped lang="scss">
.sql-executor {
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

.sql-textarea {
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 13px;
}

.template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-tag {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-color: var(--color-primary);
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
