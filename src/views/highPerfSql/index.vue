<template>
  <div class="high-perf-sql">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">高性能数据库操作</h1>
        <span class="db-info">当前数据库: {{ dbName }}</span>
      </div>
      <div class="header-right">
        <el-button @click="refreshTables">刷新表结构</el-button>
      </div>
    </div>

    <OperationSelector :selected="selectedOperation" @select="handleOperationSelect" />

    <div class="content-area">
      <div class="main-panel">
        <QueryBuilder
          v-if="selectedOperation === 'query'"
          :tables="tables"
          :tableFields="tableFields"
          @execute="executeSql"
          @explain="showExplain"
        />

        <DataEditor
          v-else-if="selectedOperation === 'insert'"
          operation="insert"
          :tables="tables"
          :tableFields="tableFields"
          @execute="executeSql"
        />

        <DataEditor
          v-else-if="selectedOperation === 'update'"
          operation="update"
          :tables="tables"
          :tableFields="tableFields"
          @execute="executeSql"
        />

        <DataEditor
          v-else-if="selectedOperation === 'delete'"
          operation="delete"
          :tables="tables"
          :tableFields="tableFields"
          @execute="executeSql"
        />

        <TableManager
          v-else-if="selectedOperation === 'createTable'"
          operation="create"
          :tables="tables"
          @execute="executeSql"
        />

        <TableManager
          v-else-if="selectedOperation === 'dropTable'"
          operation="drop"
          :tables="tables"
          @execute="executeSql"
        />

        <IndexManager
          v-else-if="selectedOperation === 'index'"
          :tables="tables"
          :tableFields="tableFields"
          @execute="executeSql"
        />

        <ViewManager
          v-else-if="selectedOperation === 'view'"
          @execute="executeSql"
        />

        <TriggerManager
          v-else-if="selectedOperation === 'trigger'"
          :tables="tables"
          @execute="executeSql"
        />

        <TransactionManager
          v-else-if="selectedOperation === 'transaction'"
          @execute="executeSql"
        />

        <SqlExecutor
          v-else-if="selectedOperation === 'execute'"
          @execute="executeSql"
          @explain="showExplain"
        />

        <ConcurrencyTester
          v-else-if="selectedOperation === 'concurrency'"
          :tables="tables"
          @execute="executeSql"
        />
      </div>

      <div class="result-panel-wrapper">
        <ResultPanel
          ref="resultPanelRef"
          :resultData="resultData"
          :explainData="explainData"
          :executeTime="executeTime"
          :errorMessage="errorMessage"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import OperationSelector from "./components/OperationSelector.vue";
import QueryBuilder from "./components/QueryBuilder.vue";
import DataEditor from "./components/DataEditor.vue";
import TableManager from "./components/TableManager.vue";
import IndexManager from "./components/IndexManager.vue";
import ViewManager from "./components/ViewManager.vue";
import TriggerManager from "./components/TriggerManager.vue";
import TransactionManager from "./components/TransactionManager.vue";
import SqlExecutor from "./components/SqlExecutor.vue";
import ConcurrencyTester from "./components/ConcurrencyTester.vue";
import ResultPanel from "./components/ResultPanel.vue";

interface Table {
  name: string;
}

interface Field {
  name: string;
  type: string;
}

const selectedOperation = ref("query");
const dbName = ref("db.sqlite");

const tables = ref<Table[]>([]);
const tableFields = reactive<Record<string, Field[]>>({});

const resultData = ref<any[]>([]);
const explainData = ref<any[]>([]);
const executeTime = ref(0);
const errorMessage = ref("");

const resultPanelRef = ref<InstanceType<typeof ResultPanel>>();

async function loadTables() {
  try {
    const result = await window.ipcRenderer.handlePromise("new-sql:listTables", {});
    if (result.success) {
      tables.value = result.data.map((name: string) => ({ name }));
      for (const table of tables.value) {
        await loadTableFields(table.name);
      }
    }
  } catch (err) {
    console.error("Failed to load tables:", err);
  }
}

async function loadTableFields(tableName: string) {
  try {
    const result = await window.ipcRenderer.handlePromise("new-sql:tableInfo", { tableName });
    if (result.success) {
      tableFields[tableName] = result.data.map((item: any) => ({
        name: item.name,
        type: item.type,
      }));
    }
  } catch (err) {
    console.error(`Failed to load fields for ${tableName}:`, err);
  }
}

function refreshTables() {
  loadTables();
}

function handleOperationSelect(operation: string) {
  selectedOperation.value = operation;
  resultData.value = [];
  explainData.value = [];
  errorMessage.value = "";
}

async function executeSql(sql: string) {
  if (!sql.trim()) return;

  errorMessage.value = "";
  explainData.value = [];
  const startTime = performance.now();

  try {
    const result = await window.ipcRenderer.handlePromise("new-sql:execute", { sql });

    if (result.success) {
      resultData.value = result.data.rows || [];
      if (resultPanelRef.value) {
        resultPanelRef.value.addLog(`执行成功: ${sql.substring(0, 50)}${sql.length > 50 ? "..." : ""}`, "success");
      }
    } else {
      errorMessage.value = result.error;
      if (resultPanelRef.value) {
        resultPanelRef.value.addLog(`执行失败: ${result.error}`, "error");
      }
    }
  } catch (err) {
    errorMessage.value = (err as Error).message;
    if (resultPanelRef.value) {
      resultPanelRef.value.addLog(`执行异常: ${(err as Error).message}`, "error");
    }
  }

  executeTime.value = performance.now() - startTime;
}

async function showExplain(sql: string) {
  if (!sql.trim()) return;

  errorMessage.value = "";
  resultData.value = [];
  const startTime = performance.now();

  try {
    const result = await window.ipcRenderer.handlePromise("new-sql:explain", { sql });

    if (result.success) {
      explainData.value = result.data;
    } else {
      errorMessage.value = result.error;
    }
  } catch (err) {
    errorMessage.value = (err as Error).message;
  }

  executeTime.value = performance.now() - startTime;
}

onMounted(() => {
  loadTables();
});
</script>

<style scoped lang="scss">
.high-perf-sql {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.db-info {
  font-size: 13px;
  color: var(--text-muted);
}

.header-right {
  display: flex;
  gap: 8px;
}

.content-area {
  flex: 1;
  display: flex;
  gap: 20px;
  overflow: hidden;
}

.main-panel {
  flex: 2;
  overflow-y: auto;
}

.result-panel-wrapper {
  flex: 1;
  min-width: 400px;
}
</style>
