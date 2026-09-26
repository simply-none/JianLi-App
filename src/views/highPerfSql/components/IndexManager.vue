<script setup lang="ts">
/**
 * 索引管理（对齐设计稿 3:346）：面板头 + 索引表格卡（索引名/字段/类型/状态/操作）
 * + 新建索引表单卡（名称/所属表/选择列/唯一开关/部分索引 WHERE/创建按钮）+ 导出行。
 * 清单走 pragma_index_list/index_info（new-sql:read）；创建经 emit("execute")。
 */
import { ref, computed, watch } from "vue";
import { runRead } from "../visual/api";

const props = defineProps<{
  tables: string[];
  tableFields: Record<string, Array<{ name: string; type: string }>>;
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

interface IndexInfo {
  name: string;
  unique: boolean;
  columns: string;
}

const tableName = ref("");
const indexName = ref("");
const columnList = ref("");
const unique = ref(false);
const whereClause = ref("");
const indexes = ref<IndexInfo[]>([]);
const loading = ref(false);
const nameInputRef = ref<HTMLInputElement>();

const fields = computed(() => props.tableFields[tableName.value] || []);

const generatedSql = computed(() => {
  if (!tableName.value || !indexName.value.trim() || !columnList.value.trim()) {
    return "-- 选择表并填写索引名、字段后生成";
  }
  const cols = columnList.value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((c) => `"${c.replace(/"/g, '""')}"`);
  let sql = `CREATE ${unique.value ? "UNIQUE " : ""}INDEX IF NOT EXISTS "${indexName.value.trim().replace(/"/g, '""')}" ON "${tableName.value.replace(/"/g, '""')}" (${cols.join(", ")})`;
  if (whereClause.value.trim()) sql += ` WHERE ${whereClause.value.trim()}`;
  return sql + ";";
});

async function loadIndexes() {
  if (!tableName.value) {
    indexes.value = [];
    return;
  }
  loading.value = true;
  const t = tableName.value;
  const listRes = await runRead(`SELECT name, "unique" AS uniq FROM pragma_index_list(?)`, [t]);
  const list: Array<{ name: string; uniq: number }> =
    listRes.success && Array.isArray(listRes.data) ? (listRes.data as any[]) : [];
  const infos = await Promise.all(
    list.map(async (item) => {
      const colRes = await runRead(`SELECT name FROM pragma_index_info(?) ORDER BY seqno`, [item.name]);
      const cols = colRes.success && Array.isArray(colRes.data) ? (colRes.data as any[]).map((r) => r.name) : [];
      return { name: item.name, unique: Number(item.uniq) === 1, columns: cols.join(", ") || "—" } as IndexInfo;
    })
  );
  indexes.value = infos;
  loading.value = false;
}

function focusForm() {
  nameInputRef.value?.focus();
  nameInputRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function createIndex() {
  if (generatedSql.value.startsWith("--")) {
    focusForm();
    return;
  }
  emit("execute", generatedSql.value);
  setTimeout(loadIndexes, 400);
}

function dropIndex(name: string) {
  emit("execute", `DROP INDEX IF EXISTS "${name.replace(/"/g, '""')}";`);
  indexes.value = indexes.value.filter((i) => i.name !== name);
}

async function exportSql() {
  try {
    await navigator.clipboard.writeText(generatedSql.value);
  } catch {
    /* 剪贴板不可用时静默 */
  }
}

watch(tableName, loadIndexes);
</script>

<template>
  <div class="pnl">
    <header class="pnl-header">
      <span class="pnl-title">索引管理</span>
      <span class="pnl-sub">当前表：{{ tableName || "未选择" }}</span>
      <div class="pnl-actions">
        <button class="pb sm" @click="focusForm">新建索引</button>
      </div>
    </header>

    <div class="pnl-body">
      <div class="dtable">
        <div class="dt-head">
          <span class="c-name">索引名</span>
          <span class="c-cols">字段</span>
          <span class="c-type">类型</span>
          <span class="c-status">状态</span>
        </div>
        <div v-if="!tableName" class="dt-empty">在上方选择一张表查看索引</div>
        <div v-else-if="indexes.length === 0 && !loading" class="dt-empty">该表暂无索引（主键自带索引不在此列）</div>
        <template v-else>
          <div v-for="idx in indexes" :key="idx.name" class="dt-row">
            <span class="c-name dt-name" :title="idx.name">{{ idx.name }}</span>
            <span class="c-cols" :title="idx.columns">{{ idx.columns }}</span>
            <span class="c-type">{{ idx.unique ? "唯一索引" : "普通索引" }}</span>
            <span class="c-status dt-ok">正常</span>
            <span class="row-del" title="删除该索引" @click="dropIndex(idx.name)">删除</span>
          </div>
        </template>
      </div>

      <div class="dcard">
        <div class="dform">
          <div class="dcard-title" style="margin-bottom: 0">新建索引</div>
          <label class="dlabel">索引名称</label>
          <input ref="nameInputRef" v-model="indexName" class="dinput" placeholder="如 idx_customers_name" />
          <label class="dlabel">所属表</label>
          <select v-model="tableName" class="dinput">
            <option value="" disabled>请选择表</option>
            <option v-for="t in props.tables" :key="t" :value="t">{{ t }}</option>
          </select>
          <label class="dlabel">选择列（可多选，构成复合索引）</label>
          <input v-model="columnList" class="dinput" placeholder="姓名, 手机号" :list="`idx-fields-${tableName}`" />
          <datalist :id="`idx-fields-${tableName}`">
            <option v-for="f in fields" :key="f.name" :value="f.name" />
          </datalist>
          <div class="toggle-row">
            <button class="toggle" :class="{ on: unique }" @click="unique = !unique" />
            <span class="dlabel" style="font-weight: 400">唯一索引（不允许重复值）</span>
          </div>
          <label class="dlabel">部分索引 WHERE（可选）</label>
          <input v-model="whereClause" class="dinput" placeholder="如 status = 1" />
          <p class="dtip">提示：SQLite 还支持表达式索引（如 lower(姓名)）；索引元信息存于 sqlite_master(type='index')。</p>
          <button class="pb block" :disabled="generatedSql.startsWith('--')" @click="createIndex">创建索引</button>
        </div>
      </div>

      <div class="exp-row">
        <button class="pb sm pb-blue-ghost" @click="exportSql">导出 SQL</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "./panel.scss" as *;

.c-name {
  flex: 0 0 240px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-cols {
  flex: 0 0 160px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-type {
  flex: 0 0 140px;
}

.c-status {
  flex: 0 0 100px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
