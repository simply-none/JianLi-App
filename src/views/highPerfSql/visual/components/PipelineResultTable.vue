<script setup lang="ts">
/**
 * 流水线运行结果表：轻量表格，最多预览 200 行。
 */
import { computed } from "vue";

const props = defineProps<{
  rows: any[];
  ms: number;
  error: string;
  writeNotice: string;
}>();

const MAX_PREVIEW = 200;

const columns = computed(() => {
  if (props.rows.length === 0) return [];
  return Object.keys(props.rows[0]);
});

const previewRows = computed(() => props.rows.slice(0, MAX_PREVIEW));
</script>

<template>
  <div class="result-table">
    <div class="result-header">
      <span class="result-title">运行结果</span>
      <span v-if="!error" class="result-meta">
        {{ rows.length.toLocaleString("zh-CN") }} 行 · {{ ms }} ms
        <template v-if="rows.length > MAX_PREVIEW">（仅预览前 {{ MAX_PREVIEW }} 行）</template>
      </span>
    </div>

    <div v-if="writeNotice" class="write-notice">{{ writeNotice }}</div>
    <div v-if="error" class="result-error">{{ error }}</div>

    <div v-else-if="rows.length === 0" class="result-empty">点击「运行流水线」查看查询结果</div>

    <div v-else class="table-scroll">
      <table class="rt-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in previewRows" :key="i">
            <td v-for="col in columns" :key="col">{{ row[col] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.result-table {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.result-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.result-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.write-notice {
  margin-bottom: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--tag-bg-success);
  color: var(--color-success);
  font-size: 11px;
}

.result-error {
  padding: 8px;
  border-radius: 6px;
  background: var(--tag-bg-danger);
  color: var(--color-error);
  font-size: 11px;
  word-break: break-all;
}

.result-empty {
  padding: 24px 0;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

.table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}

.rt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;

  th,
  td {
    padding: 5px 10px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
    white-space: nowrap;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  th {
    position: sticky;
    top: 0;
    background: var(--bg-hover);
    color: var(--text-secondary);
    font-weight: 600;
  }

  td {
    color: var(--text-primary);
  }
}
</style>
