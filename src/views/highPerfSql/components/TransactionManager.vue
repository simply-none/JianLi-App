<template>
  <div class="transaction-manager">
    <div class="content-area">
      <div class="section-card">
        <div class="status-bar">
          <span class="status-label">当前状态:</span>
          <span :class="['status-value', transactionStatus]">{{ statusText }}</span>
        </div>
        <div class="transaction-buttons">
          <el-button
            :disabled="transactionStatus === 'active'"
            type="primary"
            @click="beginTransaction"
          >
            开始事务
          </el-button>
          <el-button
            :disabled="transactionStatus !== 'active'"
            type="success"
            @click="commitTransaction"
          >
            提交事务
          </el-button>
          <el-button
            :disabled="transactionStatus !== 'active'"
            type="danger"
            @click="rollbackTransaction"
          >
            回滚事务
          </el-button>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">事务日志</div>
        <div class="log-container">
          <div v-for="(log, index) in transactionLogs" :key="index" class="log-item">
            <span class="log-time">{{ log.time }}</span>
            <span :class="['log-content', log.type]">{{ log.content }}</span>
          </div>
          <div v-if="transactionLogs.length === 0" class="empty-log">
            暂无事务日志
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">批量 SQL 输入</div>
        <el-input
          type="textarea"
          v-model="sqlContent"
          :rows="6"
          placeholder="请输入 SQL 语句，多条语句用分号分隔..."
          class="sql-textarea"
        />
      </div>
    </div>

    <div class="bottom-area">
      <div class="action-buttons">
        <el-button type="primary" @click="executeBatch">批量执行</el-button>
        <el-button type="success" @click="executeWithTransaction">带事务执行</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";

interface LogEntry {
  time: string;
  content: string;
  type: "info" | "success" | "error";
}

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

const transactionStatus = ref<"idle" | "active">("idle");
const sqlContent = ref("");
const transactionLogs = reactive<LogEntry[]>([]);

const statusText = computed(() => {
  return transactionStatus.value === "active" ? "事务进行中" : "未开始事务";
});

function addLog(content: string, type: "info" | "success" | "error" = "info") {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
  transactionLogs.push({ time, content, type });
}

function beginTransaction() {
  transactionStatus.value = "active";
  addLog("BEGIN TRANSACTION", "info");
  emit("execute", "BEGIN TRANSACTION");
}

function commitTransaction() {
  transactionStatus.value = "idle";
  addLog("COMMIT", "success");
  emit("execute", "COMMIT");
}

function rollbackTransaction() {
  transactionStatus.value = "idle";
  addLog("ROLLBACK", "error");
  emit("execute", "ROLLBACK");
}

function executeBatch() {
  if (!sqlContent.value.trim()) return;

  const sqls = sqlContent.value.split(";").filter(s => s.trim());
  sqls.forEach(sql => {
    if (sql.trim()) {
      addLog(`执行: ${sql.trim()}`, "info");
      emit("execute", sql.trim());
    }
  });
}

function executeWithTransaction() {
  if (!sqlContent.value.trim()) return;

  beginTransaction();
  setTimeout(() => {
    executeBatch();
    setTimeout(() => {
      commitTransaction();
    }, 100);
  }, 50);
}
</script>

<style scoped lang="scss">
.transaction-manager {
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

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.status-label {
  color: var(--text-secondary);
}

.status-value {
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 20px;

  &.idle {
    background: var(--tag-bg-info);
    color: var(--color-info);
  }

  &.active {
    background: var(--tag-bg-warning);
    color: var(--color-warning);
  }
}

.transaction-buttons {
  display: flex;
  gap: 12px;
}

.log-container {
  background: linear-gradient(135deg, var(--bg-card) 0%, rgba(0, 0, 0, 0.1) 100%);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 16px;
  max-height: 200px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 13px;
  padding: 8px;
  background: var(--bg-base);
  border-radius: 6px;
}

.log-time {
  color: var(--text-muted);
  font-family: monospace;
  white-space: nowrap;
}

.log-content {
  flex: 1;

  &.info {
    color: var(--text-primary);
  }

  &.success {
    color: var(--color-success);
  }

  &.error {
    color: var(--color-error);
  }
}

.empty-log {
  color: var(--text-muted);
  text-align: center;
  padding: 30px;
}

.sql-textarea {
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 13px;
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
