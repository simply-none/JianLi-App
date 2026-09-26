<script setup lang="ts">
/**
 * 数据浏览（「数据」分页）：选中表的行级 CRUD + 搜索 + 分页 + CSV 导出。
 *
 * 数据通道（刻意避开 ensure 自动补列污染任意表）：
 * - 读：new-sql:read（SELECT rowid AS __rid, *，参数化 LIKE 搜索，LIMIT/OFFSET 分页）
 * - 增/改/删：new-sql:transaction（参数化 INSERT/UPDATE/DELETE，无 ensure）
 */
import { ref, computed, watch } from "vue";
import { Search, Plus, Pencil, Trash2, RefreshCw, Download, X, ChevronUp, ChevronDown } from "@lucide/vue";
import { runRead, runWrite } from "../visual/api";

const props = defineProps<{ tableName: string }>();

const emit = defineEmits<{
  (e: "op-done", message: string, ok: boolean): void;
  (e: "count-changed", delta: number): void;
}>();

const PAGE_SIZE = 20;

interface ColumnInfo {
  name: string;
  type: string;
  pk: number;
}

const columns = ref<ColumnInfo[]>([]);
const rows = ref<Record<string, any>[]>([]);
const total = ref(0);
const page = ref(1);
const keyword = ref("");
const selected = ref<Set<number>>(new Set());
const loading = ref(false);
const rowidOk = ref(true);
const sortCol = ref("");
const sortDir = ref<"ASC" | "DESC">("ASC");

const editOpen = ref(false);
const editMode = ref<"add" | "edit">("add");
const editRowid = ref<number | null>(null);
const editValues = ref<Record<string, string>>({});
const confirmDelete = ref(false);
const saving = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const pageNumbers = computed(() => {
  const cur = page.value;
  const start = Math.max(1, Math.min(cur - 2, totalPages.value - 4));
  const list: number[] = [];
  for (let p = start; p <= Math.min(totalPages.value, start + 4); p++) list.push(p);
  return list;
});

const selectedRows = computed(() => rows.value.filter((r) => selected.value.has(r.__rid)));
const displayColumns = computed(() => columns.value.filter((c) => c.name !== "__rid"));

async function loadColumns() {
  const res = await window.ipcRenderer.handlePromise("new-sql:tableInfo", { tableName: props.tableName });
  columns.value = res.success
    ? (res.data as any[]).map((item) => ({ name: item.name, type: item.type || "TEXT", pk: Number(item.pk) || 0 }))
    : [];
}

function likeWhere(): { where: string; params: string[] } | null {
  const kw = keyword.value.trim();
  if (!kw || displayColumns.value.length === 0) return null;
  const frags = displayColumns.value.map((c) => `"${c.name.replace(/"/g, '""')}" LIKE ?`);
  return { where: `WHERE ${frags.join(" OR ")}`, params: displayColumns.value.map(() => `%${kw}%`) };
}

async function loadRows() {
  if (!props.tableName) return;
  loading.value = true;
  const t = `"${props.tableName.replace(/"/g, '""')}"`;
  const lw = likeWhere();
  const base = rowidOk.value
    ? `SELECT rowid AS __rid, * FROM ${t}`
    : `SELECT * FROM ${t}`;
  const offset = (page.value - 1) * PAGE_SIZE;
  const orderCol = sortCol.value
    ? `"${sortCol.value.replace(/"/g, '""')}" ${sortDir.value}`
    : rowidOk.value
      ? "rowid"
      : `"${(displayColumns.value[0]?.name || "rowid").replace(/"/g, '""')}"`;
  const sql = `${base} ${lw ? lw.where : ""} ORDER BY ${orderCol} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const cntSql = `SELECT COUNT(*) AS cnt FROM ${t} ${lw ? lw.where : ""}`;

  const [rowsRes, cntRes] = await Promise.all([
    runRead(sql, lw ? lw.params : []),
    runRead(cntSql, lw ? lw.params : []),
  ]);

  if (!rowsRes.success) {
    if (rowidOk.value && /rowid/i.test(rowsRes.error || "")) {
      rowidOk.value = false;
      loading.value = false;
      await loadRows();
      return;
    }
    emit("op-done", `读取失败：${rowsRes.error}`, false);
    rows.value = [];
    total.value = 0;
    loading.value = false;
    return;
  }

  rows.value = (rowsRes.data || []) as Record<string, any>[];
  total.value = cntRes.success && Array.isArray(cntRes.data) ? Number(cntRes.data[0]?.cnt ?? 0) : rows.value.length;
  selected.value = new Set();
  loading.value = false;
}

async function refresh() {
  sortCol.value = "";
  sortDir.value = "ASC";
  page.value = 1;
  await loadColumns();
  if (page.value > totalPages.value) page.value = 1;
  await loadRows();
}

watch(() => props.tableName, refresh, { immediate: true });
watch(keyword, () => {
  page.value = 1;
  loadRows();
});
watch(page, loadRows);

function toggleAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  selected.value = checked ? new Set(rows.value.map((r) => r.__rid)) : new Set();
}

function toggleSort(col: string) {
  if (sortCol.value !== col) {
    sortCol.value = col;
    sortDir.value = "ASC";
  } else if (sortDir.value === "ASC") {
    sortDir.value = "DESC";
  } else {
    sortCol.value = "";
    sortDir.value = "ASC";
  }
  page.value = 1;
  loadRows();
}

function toggleRow(rid: number) {
  const next = new Set(selected.value);
  if (next.has(rid)) next.delete(rid);
  else next.add(rid);
  selected.value = next;
}

function openAdd() {
  editMode.value = "add";
  editRowid.value = null;
  const vals: Record<string, string> = {};
  for (const c of displayColumns.value) vals[c.name] = "";
  editValues.value = vals;
  editOpen.value = true;
}

function openEdit(row?: Record<string, any>) {
  const target = row ?? (selectedRows.value.length === 1 ? selectedRows.value[0] : null);
  if (!target) return;
  editMode.value = "edit";
  editRowid.value = target.__rid ?? null;
  const vals: Record<string, string> = {};
  for (const c of displayColumns.value) vals[c.name] = target[c.name] == null ? "" : String(target[c.name]);
  editValues.value = vals;
  editOpen.value = true;
}

/** 空值且为整数主键的字段不参与写入（交给自增/默认值） */
const errorSaving = ref("");

async function saveEdit() {
  errorSaving.value = "";
  const fieldsToWrite = displayColumns.value.filter((c) => {
    const v = editValues.value[c.name];
    if (v != null && v !== "") return true;
    // 新增时：整数主键留空交给自增；编辑时：空值也允许写（清空字段）
    if (editMode.value === "add" && c.pk && /INT/i.test(c.type)) return false;
    return editMode.value === "edit" && c.pk === 0;
  });
  if (fieldsToWrite.length === 0) {
    errorSaving.value = "请至少填写一个字段";
    return;
  }
  const t = `"${props.tableName.replace(/"/g, '""')}"`;
  saving.value = true;

  if (editMode.value === "add") {
    const cols = fieldsToWrite.map((c) => `"${c.name.replace(/"/g, '""')}"`);
    const holders = fieldsToWrite.map(() => "?").join(", ");
    const params = fieldsToWrite.map((c) => editValues.value[c.name]);
    const res = await runWrite([`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${holders})`], [params]);
    saving.value = false;
    if (!res.success) {
      errorSaving.value = res.error || "新增失败";
      return;
    }
    editOpen.value = false;
    emit("op-done", `新增 1 行`, true);
    emit("count-changed", 1);
    await loadRows();
  } else {
    const sets = fieldsToWrite.map((c) => `"${c.name.replace(/"/g, '""')}" = ?`);
    const params: any[] = fieldsToWrite.map((c) => editValues.value[c.name]);
    params.push(editRowid.value as number);
    const res = await runWrite([`UPDATE ${t} SET ${sets.join(", ")} WHERE rowid = ?`], [params]);
    saving.value = false;
    if (!res.success) {
      errorSaving.value = res.error || "保存失败";
      return;
    }
    editOpen.value = false;
    emit("op-done", `更新 1 行`, true);
    await loadRows();
  }
}

async function doDelete() {
  const rids = [...selected.value];
  if (rids.length === 0) return;
  const t = `"${props.tableName.replace(/"/g, '""')}"`;
  const sqls = rids.map(() => `DELETE FROM ${t} WHERE rowid = ?`);
  const params = rids.map((rid) => [rid]);
  confirmDelete.value = false;
  const res = await runWrite(sqls, params);
  if (!res.success) {
    emit("op-done", `删除失败：${res.error}`, false);
    return;
  }
  emit("op-done", `删除 ${rids.length} 行`, true);
  emit("count-changed", -rids.length);
  if (page.value > 1 && rows.value.length === rids.length) page.value -= 1;
  await loadRows();
}

async function exportCsv() {
  const t = `"${props.tableName.replace(/"/g, '""')}"`;
  const lw = likeWhere();
  const cols = displayColumns.value.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(", ");
  const res = await runRead(`SELECT ${cols} FROM ${t} ${lw ? lw.where : ""}`, lw ? lw.params : []);
  if (!res.success) {
    emit("op-done", `导出失败：${res.error}`, false);
    return;
  }
  const list = (res.data || []) as Record<string, any>[];
  const names = displayColumns.value.map((c) => c.name);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [names.join(","), ...list.map((r) => names.map((n) => esc(r[n])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${props.tableName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  emit("op-done", `导出 ${list.length} 行到 CSV`, true);
}

function fmtCell(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
</script>

<template>
  <div class="data-browser">
    <!-- 数据工具栏（设计稿 3:108：独立白卡，搜索 + 34px 按钮 radius 6） -->
    <div class="db-toolbar">
      <div class="db-search">
        <Search class="tb-icon" />
        <input v-model="keyword" placeholder="搜索本表数据…" />
      </div>
      <div class="tb-actions">
        <button class="primary-btn" @click="openAdd"><Plus class="btn-icon" />新增一行</button>
        <button
          class="tb-btn"
          :disabled="selectedRows.length !== 1 || !rowidOk"
          :title="rowidOk ? '' : '该表无法用 rowid 定位行，请用 SQL 控制台编辑'"
          @click="openEdit()"
        >
          <Pencil class="btn-icon" />编辑
        </button>
        <button
          class="tb-btn danger"
          :disabled="selectedRows.length === 0 || !rowidOk"
          :title="rowidOk ? '' : '该表无法用 rowid 定位行，请用 SQL 控制台删除'"
          @click="confirmDelete = true"
        >
          <Trash2 class="btn-icon" />删除
        </button>
        <button class="tb-btn" @click="refresh"><RefreshCw class="btn-icon" />刷新</button>
        <button class="tb-btn" @click="exportCsv"><Download class="btn-icon" />导出</button>
      </div>
    </div>

    <!-- 数据表格卡（设计稿 3:126：44px 表头 + 48px 行 + 底部 48px 分页栏） -->
    <div class="db-table-wrap">
      <table class="db-table">
        <thead>
          <tr>
            <th class="col-check"><input type="checkbox" :checked="rows.length > 0 && selected.size === rows.length" @change="toggleAll" /></th>
            <th v-for="c in displayColumns" :key="c.name" class="sortable" @click="toggleSort(c.name)">
              {{ c.name }}
              <span v-if="c.pk" class="pk-tag">PK</span>
              <ChevronUp v-if="sortCol === c.name && sortDir === 'ASC'" class="sort-icon" />
              <ChevronDown v-else-if="sortCol === c.name" class="sort-icon" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.__rid ?? JSON.stringify(row)"
            :class="{ picked: selected.has(row.__rid) }"
            @dblclick="rowidOk && openEdit(row)"
          >
            <td class="col-check">
              <input type="checkbox" :checked="selected.has(row.__rid)" @change="toggleRow(row.__rid)" />
            </td>
            <td v-for="c in displayColumns" :key="c.name" :title="fmtCell(row[c.name])">{{ fmtCell(row[c.name]) }}</td>
          </tr>
          <tr v-if="!loading && rows.length === 0">
            <td :colspan="displayColumns.length + 1" class="empty-cell">暂无数据</td>
          </tr>
        </tbody>
      </table>

      <!-- 分页底栏（设计稿 3:207：表格卡内 48px，border-top） -->
      <div class="db-footer">
        <span class="footer-meta">共 {{ total.toLocaleString("zh-CN") }} 条 · 每页 {{ PAGE_SIZE }} ·
          显示 {{ rows.length ? (page - 1) * PAGE_SIZE + 1 : 0 }}-{{ (page - 1) * PAGE_SIZE + rows.length }}</span>
        <div class="pager">
          <button class="page-btn" :disabled="page <= 1" @click="page--">上一页</button>
          <button
            v-for="p in pageNumbers"
            :key="p"
            class="page-btn"
            :class="{ current: p === page }"
            @click="page = p"
          >
            {{ p }}
          </button>
          <button class="page-btn" :disabled="page >= totalPages" @click="page++">下一页</button>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <Teleport to="body">
      <div v-if="editOpen" class="edit-mask" @click.self="editOpen = false">
        <div class="edit-dialog">
          <div class="edit-header">
            <span>{{ editMode === "add" ? "新增一行" : "编辑行" }}</span>
            <X class="close-icon" @click="editOpen = false" />
          </div>
          <div class="edit-body">
            <template v-for="c in displayColumns" :key="c.name">
              <label class="field-label">{{ c.name }}<span class="col-type">{{ c.type }}</span></label>
              <textarea
                v-if="editValues[c.name] && editValues[c.name].length > 60"
                v-model="editValues[c.name]"
                class="field-input"
                rows="3"
              />
              <input v-else v-model="editValues[c.name]" class="field-input" />
            </template>
            <div v-if="errorSaving" class="save-error">{{ errorSaving }}</div>
          </div>
          <div class="edit-actions">
            <button class="cancel-btn" @click="editOpen = false">取消</button>
            <button class="primary-btn" :disabled="saving" @click="saveEdit">{{ saving ? "保存中…" : "保存" }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除确认 -->
    <Teleport to="body">
      <div v-if="confirmDelete" class="edit-mask" @click.self="confirmDelete = false">
        <div class="del-dialog">
          <div class="del-title">确认删除</div>
          <p class="del-text">将删除选中的 {{ selected.size }} 行数据，此操作无法自动撤销。</p>
          <div class="edit-actions">
            <button class="cancel-btn" @click="confirmDelete = false">取消</button>
            <button class="danger-btn" @click="doDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.data-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
}

.db-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  flex-wrap: wrap;
}

.db-search {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  background: var(--bg-base);
  border-radius: 8px;

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    outline: none;
    font-size: 13px;
    color: var(--text-primary);

    &::placeholder {
      color: var(--text-muted);
    }
  }
}

.tb-icon {
  width: 15px;
  height: 15px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.tb-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.tb-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }

  &.danger {
    color: var(--color-error);
    border-color: var(--tag-bg-danger);

    &:hover:not(:disabled) {
      background: var(--tag-bg-danger);
    }
  }
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.db-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
}

.db-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
    white-space: nowrap;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    height: 44px;
    padding: 0 12px;
    background: var(--bg-hover);
    color: var(--text-secondary);
    font-weight: 600;
  }

  tbody tr {
    height: 48px;
  }

  tbody tr:hover {
    background: var(--bg-hover);
  }

  tbody tr.picked {
    background: var(--color-primary-light);
  }
}

.col-check {
  width: 40px;

  input {
    accent-color: var(--color-primary);
  }
}

.pk-tag {
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 9px;
}

.sortable {
  cursor: pointer;
  user-select: none;

  &:hover {
    color: var(--color-primary);
  }
}

.sort-icon {
  width: 11px;
  height: 11px;
  vertical-align: -1px;
  color: var(--color-primary);
}

.empty-cell {
  text-align: center;
  color: var(--text-muted);
  padding: 32px 0 !important;
}

/* 分页底栏：表格卡内 48px + border-top（设计稿 3:207） */
.db-footer {
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-subtle);
}

.footer-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.pager {
  display: flex;
  gap: 6px;
}

.page-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &.current {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
}

.edit-mask {
  position: fixed;
  inset: 0;
  z-index: 1700;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: rgba(0, 0, 0, 0.4);
}

.edit-dialog {
  width: 460px;
  max-width: calc(100vw - 48px);
  max-height: 72vh;
  overflow-y: auto;
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.25);
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.close-icon {
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
  cursor: pointer;
}

.edit-body {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.col-type {
  margin-left: 6px;
  font-size: 10px;
  color: var(--text-muted);
}

.field-label {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.field-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  box-sizing: border-box;
  font-family: inherit;

  &:focus {
    border-color: var(--color-primary);
  }
}

.save-error {
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--tag-bg-danger);
  color: var(--color-error);
  font-size: 12px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 16px;
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
}

.del-dialog {
  width: 360px;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 18px;
}

.del-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.del-text {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
