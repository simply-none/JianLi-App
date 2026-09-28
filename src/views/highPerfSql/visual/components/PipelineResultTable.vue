<script setup lang="ts">
/**
 * 流水线运行结果表：轻量表格，最多预览 200 行。
 *
 * 空态（E5）不是一句提示语，而是带引导的虚线框：
 * 告诉用户「要么点运行，要么先点某个步骤上的 ▶ 看看那一步有多少行」。
 */
import { computed } from "vue";
import { TableProperties, PlayCircle } from "@lucide/vue";

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
      <span v-if="!error && rows.length > 0" class="result-meta">
        {{ rows.length.toLocaleString("zh-CN") }} 行 · {{ ms }} ms
        <template v-if="rows.length > MAX_PREVIEW">（仅预览前 {{ MAX_PREVIEW }} 行）</template>
      </span>
    </div>

    <div v-if="writeNotice" class="write-notice">{{ writeNotice }}</div>
    <div v-if="error" class="result-error">{{ error }}</div>

    <!-- E5：引导式空态 -->
    <div v-else-if="rows.length === 0" class="result-empty">
      <div class="re-box">
        <TableProperties class="re-icon" />
        <div class="re-title">还没有结果</div>
        <div class="re-line">
          <PlayCircle class="re-li" />
          点左上角<b>「运行流水线」</b>查看完整查询结果
        </div>
        <div class="re-line">
          <PlayCircle class="re-li" />
          或点某个步骤右下角的 ▶，<b>先看那一步剩多少行</b>
        </div>
      </div>
    </div>

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
  width: 100%;
  height: 100%;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 0 7px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 8px;
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
  flex-shrink: 0;
  margin-bottom: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--tag-bg-success);
  color: var(--color-success);
  font-size: 11px;
  line-height: 1.5;
}

.result-error {
  padding: 8px;
  border-radius: 6px;
  background: var(--tag-bg-danger);
  color: var(--color-error);
  font-size: 11px;
  word-break: break-all;
  line-height: 1.5;
}

/* ===== E5 空态引导 ===== */
.result-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.re-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 16px 12px;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
  box-sizing: border-box;
}

.re-icon {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.re-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 3px;
}

.re-line {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--text-muted);
  line-height: 1.5;
  text-align: left;

  b {
    color: var(--text-secondary);
    font-weight: 600;
  }
}

.re-li {
  flex-shrink: 0;
  width: 11px;
  height: 11px;
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
