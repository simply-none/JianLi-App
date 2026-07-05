<template>
  <div class="result-panel">
    <div class="panel-header">
      <span class="panel-title">结果展示</span>
      <div class="panel-actions" v-if="activeTab === 'data' && resultData.length > 0">
        <el-button size="small" @click="exportCSV">导出 CSV</el-button>
        <el-button size="small" @click="exportJSON">导出 JSON</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="result-tabs">
      <el-tab-pane label="数据表格" name="data">
        <div v-if="resultData.length > 0" class="data-content">
          <div class="result-info">
            <span>执行时间: {{ executeTime.toFixed(2) }}ms</span>
            <span>记录数: {{ resultData.length }}</span>
          </div>
          <el-table
            :data="currentPageData"
            border
            class="result-table"
            max-height="400"
          >
            <el-table-column
              v-for="column in columns"
              :key="column"
              :prop="column"
              :label="column"
              show-overflow-tooltip
            />
          </el-table>
          <el-pagination
            v-if="total > pageSize"
            :current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            @current-change="handlePageChange"
            layout="prev, pager, next"
            class="result-pagination"
          />
        </div>
        <div v-else class="empty-state">
          <span>{{ errorMessage || '暂无数据' }}</span>
        </div>
      </el-tab-pane>

      <el-tab-pane label="执行计划" name="explain">
        <div v-if="explainData.length > 0" class="explain-content">
          <el-table
            :data="explainData"
            border
            class="result-table"
            max-height="400"
          >
            <el-table-column
              v-for="column in explainColumns"
              :key="column"
              :prop="column"
              :label="column"
              show-overflow-tooltip
            />
          </el-table>
        </div>
        <div v-else class="empty-state">
          <span>暂无执行计划</span>
        </div>
      </el-tab-pane>

      <el-tab-pane label="消息日志" name="log">
        <div class="log-content">
          <div v-for="(log, index) in logs" :key="index" class="log-item">
            <span class="log-time">{{ log.time }}</span>
            <span :class="['log-text', log.type]">{{ log.message }}</span>
          </div>
          <div v-if="logs.length === 0" class="empty-state">
            <span>暂无日志</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

interface LogEntry {
  time: string;
  message: string;
  type: "success" | "error" | "info";
}

const props = defineProps<{
  resultData: any[];
  explainData: any[];
  executeTime: number;
  errorMessage: string;
}>();

const activeTab = ref("data");
const currentPage = ref(1);
const pageSize = ref(50);

const logs = ref<LogEntry[]>([]);

const columns = computed(() => {
  if (props.resultData.length === 0) return [];
  return Object.keys(props.resultData[0]);
});

const explainColumns = computed(() => {
  if (props.explainData.length === 0) return [];
  return Object.keys(props.explainData[0]);
});

const total = computed(() => props.resultData.length);

const currentPageData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return props.resultData.slice(start, end);
});

function handlePageChange(page: number) {
  currentPage.value = page;
}

function exportCSV() {
  if (props.resultData.length === 0) return;

  const headers = columns.value;
  const rows = props.resultData.map(row => headers.map(col => row[col]).join(","));
  const csv = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `result_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJSON() {
  if (props.resultData.length === 0) return;

  const json = JSON.stringify(props.resultData, null, 2);

  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `result_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function addLog(message: string, type: "success" | "error" | "info" = "info") {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`;
  logs.value.push({ time, message, type });
}

defineExpose({ addLog });
</script>

<style scoped lang="scss">
.result-panel {
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.result-tabs {
  flex: 1;
  overflow: hidden;
}

.data-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.result-info {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.result-table {
  flex: 1;
  font-size: 13px;
}

.result-pagination {
  margin-top: 12px;
  text-align: right;
}

.explain-content {
  height: 100%;
}

.log-content {
  height: 100%;
  max-height: 400px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
}

.log-time {
  color: var(--text-muted);
  font-family: monospace;
  white-space: nowrap;
}

.log-text {
  flex: 1;

  &.success {
    color: var(--color-success);
  }

  &.error {
    color: var(--color-error);
  }

  &.info {
    color: var(--text-primary);
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-muted);
}
</style>
