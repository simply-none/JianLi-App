<script setup lang="ts">
/**
 * 结果面板（SQL 控制台 / 高级 SQL 共用）：数据表格 + 执行计划 + 消息日志。
 * 数据源 = index.vue 的 execute/explain 结果（new-sql:execute 返回 rows）。
 */
import { ref, computed, watch } from "vue";
import { ChevronLeft, ChevronRight, Download } from "@lucide/vue";

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

type RTab = "data" | "explain" | "log";
const activeTab = ref<RTab>("data");
const currentPage = ref(1);
const pageSize = 50;

const logs = ref<LogEntry[]>([]);

const columns = computed(() => (props.resultData.length > 0 ? Object.keys(props.resultData[0]) : []));
const explainColumns = computed(() => (props.explainData.length > 0 ? Object.keys(props.explainData[0]) : []));

const total = computed(() => props.resultData.length);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
const currentPageData = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return props.resultData.slice(start, start + pageSize);
});

watch(total, () => {
  currentPage.value = 1;
});

function fmtCell(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function esc(v: any): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob: Blob, ext: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `result_${Date.now()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  if (props.resultData.length === 0) return;
  const headers = columns.value;
  const rows = props.resultData.map((row) => headers.map((c) => esc(row[c])).join(","));
  const csv = [headers.join(","), ...rows].join("\r\n");
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), "csv");
}

function exportJSON() {
  if (props.resultData.length === 0) return;
  download(
    new Blob([JSON.stringify(props.resultData, null, 2)], { type: "application/json;charset=utf-8;" }),
    "json"
  );
}

function addLog(message: string, type: "success" | "error" | "info" = "info") {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`;
  logs.value.push({ time, message, type });
  if (type === "error") activeTab.value = "log";
}

defineExpose({ addLog });
</script>

<template>
  <div class="result-panel">
    <nav class="rp-tabs">
      <button class="rp-tab" :class="{ active: activeTab === 'data' }" @click="activeTab = 'data'">
        数据表格<em v-if="total">{{ total }}</em>
      </button>
      <button class="rp-tab" :class="{ active: activeTab === 'explain' }" @click="activeTab = 'explain'">执行计划</button>
      <button class="rp-tab" :class="{ active: activeTab === 'log' }" @click="activeTab = 'log'">
        消息日志<em v-if="logs.length">{{ logs.length }}</em>
      </button>
      <span class="rp-meta">
        <template v-if="activeTab === 'data' && resultData.length > 0">
          {{ executeTime.toFixed(1) }}ms · {{ total }} 行
          <button class="mini-btn" @click="exportCSV"><Download class="mini-icon" />CSV</button>
          <button class="mini-btn" @click="exportJSON"><Download class="mini-icon" />JSON</button>
        </template>
      </span>
    </nav>

    <div v-if="activeTab === 'data'" class="rp-body">
      <div v-if="errorMessage" class="rp-error">{{ errorMessage }}</div>
      <div v-else-if="resultData.length > 0" class="rp-table-wrap">
        <table class="rp-table">
          <thead>
            <tr>
              <th v-for="c in columns" :key="c">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in currentPageData" :key="i">
              <td v-for="c in columns" :key="c" :title="fmtCell(row[c])">{{ fmtCell(row[c]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="rp-empty">暂无数据，执行一条 SQL 试试</div>
      <div v-if="resultData.length > pageSize" class="rp-pager">
        <button class="mini-btn" :disabled="currentPage <= 1" @click="currentPage--">
          <ChevronLeft class="mini-icon" />上一页
        </button>
        <span class="pager-meta">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button class="mini-btn" :disabled="currentPage >= totalPages" @click="currentPage++">
          下一页<ChevronRight class="mini-icon" />
        </button>
      </div>
    </div>

    <div v-else-if="activeTab === 'explain'" class="rp-body">
      <div v-if="explainData.length > 0" class="rp-table-wrap">
        <table class="rp-table">
          <thead>
            <tr>
              <th v-for="c in explainColumns" :key="c">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in explainData" :key="i">
              <td v-for="c in explainColumns" :key="c" :title="fmtCell(row[c])">{{ fmtCell(row[c]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="rp-empty">暂无执行计划</div>
    </div>

    <div v-else class="rp-body">
      <div class="rp-log">
        <div v-for="(log, i) in logs" :key="i" class="log-item">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-text" :class="log.type">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="rp-empty">暂无日志</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.result-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-card);
  overflow: hidden;
}

.rp-tabs {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.rp-tab {
  position: relative;
  padding: 8px 12px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;

  em {
    font-style: normal;
    margin-left: 4px;
    padding: 0 6px;
    border-radius: 8px;
    background: var(--bg-hover);
    font-size: 10px;
  }

  &.active {
    color: var(--color-primary);
    font-weight: 600;

    &::after {
      content: "";
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: -1px;
      height: 2px;
      border-radius: 1px;
      background: var(--color-primary);
    }
  }
}

.rp-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  padding-bottom: 6px;
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.mini-icon {
  width: 11px;
  height: 11px;
}

.rp-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  gap: 8px;
}

.rp-error {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--tag-bg-danger);
  color: var(--color-error);
  font-size: 12px;
}

.rp-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}

.rp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th,
  td {
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
    white-space: nowrap;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--bg-hover);
    color: var(--text-secondary);
    font-weight: 600;
  }
}

.rp-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.rp-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.pager-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.rp-log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  max-height: 220px;
}

.log-item {
  display: flex;
  gap: 10px;
  padding: 5px 4px;
  border-bottom: 1px dashed var(--border-subtle);
  font-size: 12px;

  &:last-child {
    border-bottom: none;
  }
}

.log-time {
  color: var(--text-muted);
  font-family: Consolas, "Courier New", monospace;
  white-space: nowrap;
}

.log-text {
  flex: 1;
  word-break: break-all;

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
</style>
