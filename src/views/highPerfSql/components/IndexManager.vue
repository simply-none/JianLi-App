<template>
  <div class="index-manager">
    <div class="content-area">
      <div class="section-card">
        <div class="section-title">管理索引</div>
      </div>

      <div class="section-card">
        <div class="section-title">选择表</div>
        <el-select
          v-model="indexForm.tableName"
          placeholder="请选择表"
          @change="loadIndexes"
        >
          <el-option
            v-for="table in tables"
            :key="table.name"
            :label="table.name"
            :value="table.name"
          />
        </el-select>
      </div>

      <div class="section-card">
        <div class="section-title">现有索引</div>
        <el-table v-if="indexes.length > 0" :data="indexes" border>
          <el-table-column prop="name" label="索引名" />
          <el-table-column prop="unique" label="是否唯一">
            <template #default="{ row }">
              <el-tag :type="row.unique ? 'success' : 'info'">
                {{ row.unique ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="columns" label="字段" />
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="dropIndex(row.name)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="empty-state">
          <span>暂无索引</span>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">创建索引</div>
        <el-input v-model="indexForm.indexName" placeholder="索引名" />
        <el-select
          v-model="indexForm.fieldName"
          placeholder="选择字段"
          class="field-select"
        >
          <el-option
            v-for="field in currentFields"
            :key="field.name"
            :label="field.name"
            :value="field.name"
          />
        </el-select>
        <el-checkbox v-model="indexForm.unique">唯一索引</el-checkbox>
      </div>
    </div>

    <div class="bottom-area">
      <div class="section-card">
        <div class="section-title">生成的 SQL</div>
        <div class="sql-preview">{{ generatedSql }}</div>
      </div>

      <div class="action-buttons">
        <el-button type="primary" @click="createIndex">创建索引</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from "vue";

interface Table {
  name: string;
}

interface Field {
  name: string;
  type: string;
}

interface IndexInfo {
  name: string;
  unique: boolean;
  columns: string;
}

const props = defineProps<{
  tables: Table[];
  tableFields: Record<string, Field[]>;
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

const indexForm = reactive({
  tableName: "",
  indexName: "",
  fieldName: "",
  unique: false,
});

const indexes = ref<IndexInfo[]>([]);

const currentFields = computed(() => props.tableFields[indexForm.tableName] || []);

const generatedSql = computed(() => {
  if (!indexForm.tableName || !indexForm.indexName || !indexForm.fieldName) {
    return "-- 请填写完整信息";
  }
  return `CREATE ${indexForm.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${indexForm.indexName} ON ${indexForm.tableName} (${indexForm.fieldName});`;
});

function loadIndexes() {
  indexes.value = [];
}

function createIndex() {
  emit("execute", generatedSql.value);
}

function dropIndex(name: string) {
  emit("execute", `DROP INDEX IF EXISTS ${name};`);
}
</script>

<style scoped lang="scss">
.index-manager {
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

.field-select {
  width: 100%;
  max-width: 250px;
  margin-top: 8px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--text-muted);
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
