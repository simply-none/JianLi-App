<script setup lang="ts">
/**
 * SQL 控制台（对齐设计稿 3:457）：深色编辑器 + 执行行 + 快捷探查 + 历史。
 * 执行/解释经 emit → index.vue 统一走 new-sql:execute（sanctioned 执行器）；
 * 结果区由 index.vue 下方的 ResultPanel 呈现（对应设计稿「执行结果」卡）。
 */
import { ref } from "vue";

const props = defineProps<{ tables: string[] }>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
  (e: "explain", sql: string): void;
}>();

const sqlText = ref("");
const history = ref<string[]>([]);
const historyOpen = ref(false);

function targetTable(): string {
  return props.tables[0] || "表名";
}

function doExecute() {
  const sql = sqlText.value.trim();
  if (!sql) return;
  history.value = [sql, ...history.value.filter((h) => h !== sql)].slice(0, 50);
  emit("execute", sql);
}

function doExplain() {
  const sql = sqlText.value.trim();
  if (!sql) return;
  emit("explain", sql);
}

function doClear() {
  sqlText.value = "";
}

function probe(kind: "schema" | "index" | "objects") {
  const t = targetTable();
  if (kind === "schema") sqlText.value = `PRAGMA table_info(${t});`;
  else if (kind === "index") sqlText.value = `SELECT name, "unique" FROM pragma_index_list(${t});`;
  else sqlText.value = `SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name;`;
}

function useHistory(sql: string) {
  sqlText.value = sql;
  historyOpen.value = false;
}
</script>

<template>
  <div class="pnl">
    <header class="pnl-header">
      <span class="pnl-title">SQL 控制台</span>
      <span class="pnl-sub">直接执行 SQL（高级）</span>
      <div class="pnl-actions">
        <button class="pb sm" @click="doExecute">执行</button>
      </div>
    </header>

    <div class="pnl-body">
      <textarea
        v-model="sqlText"
        class="dcode editor"
        rows="6"
        spellcheck="false"
        placeholder="SELECT c.姓名, COUNT(o.id) AS 订单数&#10;FROM 客户信息 c&#10;LEFT JOIN 订单记录 o ON o.客户id = c.id&#10;GROUP BY c.姓名;"
        @keydown.ctrl.enter.prevent="doExecute"
      />

      <div class="run-row">
        <button class="pb md" @click="doExecute">执行</button>
        <button class="pb md pb-gray" @click="doClear">清空</button>
        <button class="pb md pb-gray" @click="doExplain">执行计划</button>
        <span class="dtip">支持多条语句，以分号分隔；Ctrl+Enter 执行；请确保已备份重要数据。</span>
      </div>

      <div class="quick-row">
        <span class="dlabel">快捷探查</span>
        <button class="pb sm pb-gray" @click="probe('schema')">表结构</button>
        <button class="pb sm pb-gray" @click="probe('index')">索引清单</button>
        <button class="pb sm pb-gray" @click="probe('objects')">全部对象</button>
        <button class="pb sm pb-gray" @click="historyOpen = !historyOpen">历史（{{ history.length }}）</button>
      </div>

      <div v-if="historyOpen && history.length > 0" class="dcard">
        <div class="dcard-title">执行历史</div>
        <div v-for="(h, i) in history" :key="i" class="hist-row" @click="useHistory(h)">
          <span class="mono">{{ h }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "./panel.scss" as *;

.editor {
  min-height: 160px;
}

.run-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.quick-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hist-row {
  padding: 7px 10px;
  border-bottom: 1px dashed var(--border-subtle);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--bg-hover);
    color: var(--color-primary);
  }

  .mono {
    font-family: Consolas, "Courier New", monospace;
    word-break: break-all;
  }
}
</style>
