<script setup lang="ts">
/**
 * 事务管理（对齐设计稿 3:437）：状态卡 + BEGIN/COMMIT/ROLLBACK 控制行 + 语句深色输入
 * + BEGIN 模式分段（DEFERRED/IMMEDIATE/EXCLUSIVE）+ 保存点卡 + 事务内语句清单。
 * 说明：BEGIN/COMMIT 经多次独立 IPC 执行（连接池下非同一事务上下文时由主进程写锁兜底），
 * 本面板主要演示事务语义（SAVEPOINT 系列为真实可执行语句）。
 */
import { ref, reactive, computed } from "vue";

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

interface LogEntry {
  time: string;
  content: string;
  type: "info" | "success" | "error";
}

const transactionStatus = ref<"idle" | "active">("idle");
const beginMode = ref("DEFERRED");
const sqlContent = ref("");
const savepointName = ref("");
const pendingStatements = reactive<string[]>([]);
const transactionLogs = reactive<LogEntry[]>([]);
const lastResult = ref("");

const BEGIN_MODES = ["DEFERRED", "IMMEDIATE", "EXCLUSIVE"];

const statusText = computed(() => (transactionStatus.value === "active" ? "事务进行中" : "未开启"));

function addLog(content: string, type: "info" | "success" | "error" = "info") {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
  transactionLogs.push({ time, content, type });
}

function beginTransaction() {
  transactionStatus.value = "active";
  pendingStatements.length = 0;
  const sql = beginMode.value === "DEFERRED" ? "BEGIN TRANSACTION" : `BEGIN ${beginMode.value} TRANSACTION`;
  addLog(sql, "info");
  emit("execute", sql);
}

function commitTransaction() {
  transactionStatus.value = "idle";
  addLog("COMMIT", "success");
  emit("execute", "COMMIT");
  lastResult.value = "COMMIT 完成";
}

function rollbackTransaction() {
  transactionStatus.value = "idle";
  pendingStatements.length = 0;
  addLog("ROLLBACK", "error");
  emit("execute", "ROLLBACK");
  lastResult.value = "已回滚";
}

/** 在事务中执行：BEGIN 后记录到未提交清单 */
function runInTransaction() {
  const sql = sqlContent.value.trim().replace(/;+$/, "");
  if (!sql) return;
  if (transactionStatus.value !== "active") {
    lastResult.value = "请先 BEGIN 开启事务";
    return;
  }
  pendingStatements.push(sql + ";");
  addLog(`执行: ${sql}`, "info");
  emit("execute", sql + ";");
  lastResult.value = `已提交执行（未 COMMIT）：${sql.slice(0, 40)}${sql.length > 40 ? "…" : ""}`;
}

function runDirect() {
  const sql = sqlContent.value.trim().replace(/;+$/, "");
  if (!sql) return;
  addLog(`直接执行: ${sql}`, "info");
  emit("execute", sql + ";");
  lastResult.value = `直接执行：${sql.slice(0, 40)}${sql.length > 40 ? "…" : ""}`;
}

function savepoint(op: "save" | "rollback" | "release") {
  const name = savepointName.value.trim().replace(/[";]/g, "");
  if (!name) return;
  const sqlMap = {
    save: `SAVEPOINT "${name}"`,
    rollback: `ROLLBACK TO "${name}"`,
    release: `RELEASE "${name}"`,
  } as const;
  addLog(sqlMap[op], "info");
  emit("execute", sqlMap[op] + ";");
}

function resetAll() {
  transactionStatus.value = "idle";
  pendingStatements.length = 0;
  transactionLogs.length = 0;
  lastResult.value = "";
  sqlContent.value = "";
}

async function exportLog() {
  const text = transactionLogs.map((l) => `[${l.time}] ${l.content}`).join("\n");
  try {
    await navigator.clipboard.writeText(text || "（空日志）");
  } catch {
    /* 静默 */
  }
}
</script>

<template>
  <div class="pnl">
    <header class="pnl-header">
      <span class="pnl-title">事务管理</span>
      <span class="pnl-sub">当前：{{ statusText }}</span>
      <div class="pnl-actions">
        <button class="pb sm pb-gray" @click="resetAll">重置</button>
      </div>
    </header>

    <div class="pnl-body">
      <div class="dcard tinted">
        <div class="dcard-title" style="margin-bottom: 6px">事务状态：{{ statusText }}</div>
        <p class="dtip">在事务中执行的语句将在 COMMIT 后统一生效；ROLLBACK 可撤销本次全部改动。</p>
      </div>

      <div class="ctl-row">
        <button class="pb md" :disabled="transactionStatus === 'active'" @click="beginTransaction">BEGIN</button>
        <button class="pb md pb-green" :disabled="transactionStatus !== 'active'" @click="commitTransaction">COMMIT</button>
        <button class="pb md pb-red-ghost" :disabled="transactionStatus !== 'active'" @click="rollbackTransaction">ROLLBACK</button>
      </div>

      <textarea
        v-model="sqlContent"
        class="dcode"
        rows="3"
        placeholder="在此输入要在事务中执行的 SQL，例如：UPDATE 订单记录 SET 状态='已发货' WHERE id=1024;"
      />

      <div class="mode-row">
        <span class="dlabel">BEGIN 模式</span>
        <button
          v-for="m in BEGIN_MODES"
          :key="m"
          class="seg"
          :class="{ on: beginMode === m }"
          @click="beginMode = m"
        >
          {{ m }}
        </button>
      </div>

      <div class="run-row">
        <button class="pb md" :disabled="!sqlContent.trim()" @click="runInTransaction">在事务中执行</button>
        <button class="pb md pb-gray" :disabled="!sqlContent.trim()" @click="runDirect">直接执行（不入事务）</button>
      </div>

      <div class="dcard">
        <div class="dform">
          <div class="dcard-title" style="margin-bottom: 0">保存点（模拟嵌套事务）</div>
          <label class="dlabel">保存点名称</label>
          <input v-model="savepointName" class="dinput" placeholder="如 sp_before_update" />
          <div class="ctl-row">
            <button class="pb sm" :disabled="!savepointName.trim()" @click="savepoint('save')">SAVEPOINT</button>
            <button class="pb sm pb-gray" :disabled="!savepointName.trim()" @click="savepoint('rollback')">ROLLBACK TO</button>
            <button class="pb sm pb-blue-ghost" :disabled="!savepointName.trim()" @click="savepoint('release')">RELEASE</button>
          </div>
          <p class="dtip">提示：SQLite 无真正嵌套事务；用 SAVEPOINT name / ROLLBACK TO name / RELEASE name 实现层级回滚。</p>
        </div>
      </div>

      <div class="dcard">
        <div class="dcard-title">事务内语句（未提交）</div>
        <div v-for="(s, i) in pendingStatements" :key="i" class="stmt-line">{{ i + 1 }}. {{ s }}</div>
        <p v-if="pendingStatements.length === 0" class="dtip">（暂无语句，BEGIN 后用「在事务中执行」的语句将在此列出）</p>
        <p v-if="lastResult" class="last-result">{{ lastResult }}</p>
      </div>

      <div class="exp-row">
        <span class="exp-label">最近日志</span>
        <span class="log-inline" v-if="transactionLogs.length">{{ transactionLogs[transactionLogs.length - 1].time }} · {{ transactionLogs[transactionLogs.length - 1].content }}</span>
        <button class="pb sm pb-blue-ghost" @click="exportLog">导出日志</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "./panel.scss" as *;

.ctl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mode-row,
.run-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stmt-line {
  font-size: 13px;
  color: var(--text-primary);
  font-family: Consolas, "Courier New", monospace;
  padding: 4px 0;
}

.last-result {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--color-success);
}

.log-inline {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-muted);
  font-family: Consolas, "Courier New", monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
