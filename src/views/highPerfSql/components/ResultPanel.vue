<script setup lang="ts">
/**
 * 结果面板（SQL 控制台 / 高级 SQL 共用）：数据表格 + 执行计划 + 消息日志。
 * 数据源 = index.vue 的 execute/explain 结果（new-sql:execute 返回 rows）。
 *
 * 表格已切换到 Element Plus 的 el-table；数据/执行计划的分页已切换到 el-pagination，
 * 分页栏常驻面板底部（表格区滚动、分页栏 flex-shrink:0）。
 */
import { ref, computed, watch } from "vue";
import { Download } from "@lucide/vue";

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
      <template v-else>
        <div v-if="resultData.length > 0" class="rp-table-wrap">
          <el-table :data="currentPageData" class="rp-el-table" height="100%" empty-text="暂无数据">
            <el-table-column
              v-for="c in columns"
              :key="c"
              :prop="c"
              :label="c"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ fmtCell(row[c]) }}</template>
            </el-table-column>
          </el-table>
        </div>
        <div v-else class="rp-empty">暂无数据，执行一条 SQL 试试</div>
        <el-pagination
          v-if="resultData.length > pageSize"
          class="rp-pager"
          background
          layout="total, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="currentPage"
          @current-change="(p: number) => (currentPage = p)"
        />
      </template>
    </div>

    <div v-else-if="activeTab === 'explain'" class="rp-body">
      <div v-if="explainData.length > 0" class="rp-table-wrap">
        <el-table :data="explainData" class="rp-el-table" height="100%" empty-text="暂无执行计划">
          <el-table-column
            v-for="c in explainColumns"
            :key="c"
            :prop="c"
            :label="c"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ fmtCell(row[c]) }}</template>
          </el-table-column>
        </el-table>
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
  /* 不参与压缩：内容至少 .rp-body 的 300px，超出由外层 .sql-console 滚动 */
  flex-shrink: 0;
  min-height: 300px;
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
  /* 三个页签（数据表格 / 执行计划 / 消息日志）统一最小高度 300px，
     避免结果区在内容少时塌成一条窄缝 */
  min-height: 300px;
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

/* 表格区：flex 纵向；表格滚动，分页栏常驻底部 */
.rp-table-wrap {
  flex: 1 1 auto;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}

.rp-el-table {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.rp-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

/* 分页栏：常驻面板底部 */
.rp-pager {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

/* 消息日志：跟随 .rp-body 的 300px 最小高度，自身负责滚动 */
.rp-log {
  flex: 1 1 auto;
  min-height: 240px;
  overflow-y: auto;
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
