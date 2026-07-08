<template>
  <div class="trigger-manager">
    <div class="content-area">
      <div class="section-card">
        <div class="section-title">创建触发器</div>
        <el-input v-model="triggerForm.triggerName" placeholder="触发器名" />
        <el-select v-model="triggerForm.event">
          <el-option label="插入" value="INSERT" />
          <el-option label="更新" value="UPDATE" />
          <el-option label="删除" value="DELETE" />
        </el-select>
        <el-select v-model="triggerForm.tableName" placeholder="表名">
          <el-option
            v-for="table in tables"
            :key="table.name"
            :label="table.name"
            :value="table.name"
          />
        </el-select>
        <el-select v-model="triggerForm.timing">
          <el-option label="之前" value="BEFORE" />
          <el-option label="之后" value="AFTER" />
        </el-select>
        <el-input
          type="textarea"
          v-model="triggerForm.actionSql"
          :rows="6"
          placeholder="触发动作 SQL"
          class="sql-textarea"
        />
      </div>
    </div>

    <div class="bottom-area">
      <div class="section-card">
        <div class="section-title">SQL 预览</div>
        <div class="sql-preview">{{ generatedSql }}</div>
      </div>

      <div class="action-buttons">
        <el-button type="primary" @click="createTrigger">创建触发器</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";

interface Table {
  name: string;
}

defineProps<{
  tables: Table[];
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

const triggerForm = reactive({
  triggerName: "",
  event: "INSERT",
  tableName: "",
  timing: "AFTER",
  actionSql: "",
});

const generatedSql = computed(() => {
  if (!triggerForm.triggerName || !triggerForm.tableName || !triggerForm.actionSql.trim()) {
    return "-- 请填写完整信息";
  }
  return `CREATE TRIGGER IF NOT EXISTS ${triggerForm.triggerName} ${triggerForm.timing} ${triggerForm.event} ON ${triggerForm.tableName} BEGIN ${triggerForm.actionSql} END;`;
});

function createTrigger() {
  emit("execute", generatedSql.value);
}
</script>

<style scoped lang="scss">
.trigger-manager {
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
