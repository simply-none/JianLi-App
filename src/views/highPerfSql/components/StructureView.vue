<script setup lang="ts">
/**
 * 表结构（「表结构」分页）：字段清单 + 添加字段（ALTER TABLE，走 execute——
 * CREATE/ALTER/DROP 不触发 execute 的表名提取/自动补列，安全）。
 */
import { ref, computed, watch } from "vue";
import { Plus, KeyRound, Trash2, Code2, Copy } from "@lucide/vue";
import { runRead } from "../visual/api";

const props = defineProps<{ tableName: string }>();

const emit = defineEmits<{
  (e: "op-done", message: string, ok: boolean): void;
  (e: "dropped", tableName: string): void;
}>();

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt: string | null;
  pk: number;
}

const columns = ref<ColumnInfo[]>([]);
const addOpen = ref(false);
const newName = ref("");
const newType = ref("TEXT");
const adding = ref(false);
const error = ref("");
const ddlOpen = ref(false);
const ddlSql = ref("");
const confirmDrop = ref(false);
const dropping = ref(false);
const dropChecked = ref(false);

const TYPES = ["TEXT", "INTEGER", "REAL", "NUMERIC", "BLOB"];

async function load() {
  if (!props.tableName) {
    columns.value = [];
    ddlSql.value = "";
    return;
  }
  const res = await window.ipcRenderer.handlePromise("new-sql:tableInfo", { tableName: props.tableName });
  columns.value = res.success
    ? (res.data as any[]).map((item) => ({
        name: item.name,
        type: item.type || "TEXT",
        notnull: Number(item.notnull) || 0,
        dflt: item.dflt_value ?? null,
        pk: Number(item.pk) || 0,
      }))
    : [];
  const ddl = await runRead(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    [props.tableName]
  );
  ddlSql.value = ddl.success && Array.isArray(ddl.data) ? String(ddl.data[0]?.sql ?? "") : "";
}

async function toggleDdl() {
  ddlOpen.value = !ddlOpen.value;
}

async function copyDdl() {
  try {
    await navigator.clipboard.writeText(ddlSql.value);
    emit("op-done", "建表语句已复制", true);
  } catch {
    emit("op-done", "复制失败：浏览器剪贴板不可用", false);
  }
}

async function doDrop() {
  if (!props.tableName) return;
  const name = props.tableName;
  confirmDrop.value = false;
  dropping.value = true;
  const res = await window.ipcRenderer.handlePromise("new-sql:execute", {
    sql: `DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}"`,
  });
  dropping.value = false;
  if (!res.success) {
    emit("op-done", `删除表失败：${res.error}`, false);
    return;
  }
  emit("dropped", name);
}

watch(() => props.tableName, load, { immediate: true });

const pkCount = computed(() => columns.value.filter((c) => c.pk).length);

async function addColumn() {
  error.value = "";
  const name = newName.value.trim();
  if (!name) {
    error.value = "请填写字段名";
    return;
  }
  const t = `"${props.tableName.replace(/"/g, '""')}"`;
  const col = `"${name.replace(/"/g, '""')}" ${newType.value}`;
  adding.value = true;
  const res = await window.ipcRenderer.handlePromise("new-sql:execute", { sql: `ALTER TABLE ${t} ADD COLUMN ${col}` });
  adding.value = false;
  if (!res.success) {
    error.value = res.error || "添加失败";
    return;
  }
  addOpen.value = false;
  newName.value = "";
  emit("op-done", `已添加字段 ${name}`, true);
  await load();
}
</script>

<template>
  <div class="structure-view">
    <div v-if="!tableName" class="sv-empty">在左侧选择一张表查看其结构</div>

    <template v-else>
      <div class="sv-header">
        <span class="sv-title">{{ tableName }} · {{ columns.length }} 个字段<template v-if="pkCount"> · 主键 {{ pkCount }} 个</template></span>
        <div class="sv-actions">
          <button class="add-btn" @click="toggleDdl"><Code2 class="btn-icon" />建表语句</button>
          <button class="add-btn" @click="addOpen = !addOpen">
            <Plus class="btn-icon" />
            添加字段
          </button>
          <button class="drop-btn" :disabled="dropping" @click="confirmDrop = true">
            <Trash2 class="btn-icon" />
            删除表
          </button>
        </div>
      </div>

      <div v-if="ddlOpen && ddlSql" class="ddl-box">
        <div class="ddl-head">
          <span class="ddl-label">建表语句（DDL）</span>
          <button class="ddl-copy" @click="copyDdl"><Copy class="btn-icon" />复制</button>
        </div>
        <code class="ddl-code">{{ ddlSql }}</code>
      </div>

      <div v-if="addOpen" class="add-row">
        <input v-model="newName" class="field-input f-name" placeholder="字段名" @keyup.enter="addColumn" />
        <select v-model="newType" class="field-input f-type">
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
        <button class="primary-btn" :disabled="adding" @click="addColumn">{{ adding ? "添加中…" : "确认添加" }}</button>
      </div>
      <div v-if="error" class="sv-error">{{ error }}</div>

      <div class="sv-table-wrap">
        <table class="sv-table">
          <thead>
            <tr>
              <th>字段名</th>
              <th>类型</th>
              <th>主键</th>
              <th>非空</th>
              <th>默认值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in columns" :key="c.name">
              <td class="col-name">
                <KeyRound v-if="c.pk" class="pk-icon" />
                {{ c.name }}
              </td>
              <td>{{ c.type }}</td>
              <td>
                <span v-if="c.pk" class="yes-tag">是</span>
                <span v-else class="no-tag">—</span>
              </td>
              <td>{{ c.notnull ? "是" : "—" }}</td>
              <td>{{ c.dflt ?? "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="sv-note">SQLite 不支持删除/改名字段（旧版本）；如需调整请到「SQL 控制台」按官方流程重建表。</p>

      <!-- 删除表确认（双重确认） -->
      <Teleport to="body">
        <div v-if="confirmDrop" class="drop-mask" @click.self="confirmDrop = false">
          <div class="drop-dialog">
            <div class="drop-title">确认删除表</div>
            <p class="drop-text">
              将删除表 <b>{{ tableName }}</b> 及其全部数据，此操作无法自动撤销。建议先在「数据」页导出备份。
            </p>
            <label class="drop-check">
              <input v-model="dropChecked" type="checkbox" />
              <span>我已了解将删除整张表（双重确认）</span>
            </label>
            <div class="drop-actions">
              <button class="cancel-btn" @click="confirmDrop = false">取消</button>
              <button class="danger-btn" :disabled="!dropChecked || dropping" @click="doDrop">
                {{ dropping ? "删除中…" : "删除" }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style scoped lang="scss">
.structure-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
}

.sv-empty {
  padding: 48px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

.sv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sv-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sv-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.add-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: var(--bg-hover);
  border-radius: 8px;
}

.f-name {
  flex: 1;
}

.f-type {
  flex: 0 0 100px;
}

.field-input {
  padding: 7px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  background: var(--bg-card);

  &:focus {
    border-color: var(--color-primary);
  }
}

.primary-btn {
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
  }
}

.sv-error {
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--tag-bg-danger);
  color: var(--color-error);
  font-size: 12px;
}

.sv-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-card);
}

.sv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th,
  td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--bg-hover);
    color: var(--text-secondary);
    font-weight: 600;
  }
}

.col-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: var(--text-primary);
}

.pk-icon {
  width: 12px;
  height: 12px;
  color: var(--color-warning);
}

.yes-tag {
  padding: 1px 8px;
  border-radius: 8px;
  background: var(--tag-bg-success);
  color: var(--color-success);
  font-size: 10px;
}

.no-tag {
  color: var(--text-muted);
}

.sv-note {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.drop-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border: 1px solid var(--tag-bg-danger);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--color-error);
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--tag-bg-danger);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.ddl-box {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
  overflow: hidden;
}

.ddl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
}

.ddl-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.ddl-copy {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
}

.ddl-code {
  display: block;
  padding: 10px 12px;
  border-top: 1px solid var(--border-subtle);
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  max-height: 220px;
  overflow-y: auto;
}

.drop-mask {
  position: fixed;
  inset: 0;
  z-index: 1750;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 16vh;
  background: rgba(0, 0, 0, 0.4);
}

.drop-dialog {
  width: 400px;
  max-width: calc(100vw - 48px);
  background: var(--bg-card);
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.25);
}

.drop-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.drop-text {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.drop-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;

  input {
    accent-color: var(--color-error);
  }
}

.drop-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.cancel-btn {
  padding: 7px 18px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.danger-btn {
  padding: 7px 18px;
  border: none;
  border-radius: 8px;
  background: var(--color-error);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
</style>
