<script setup lang="ts">
/**
 * 视图管理（对齐设计稿 3:370）：视图表卡（视图名/基于表/说明/操作）+ 新建视图表单
 * （名称/基于表/定义深色编辑器/创建按钮）+ 导出/复制 SQL。
 * 清单走 sqlite_master（new-sql:read）；预览展开定义；删除 DROP VIEW。
 */
import { ref, computed, onMounted } from "vue";
import { runRead } from "../visual/api";

const props = defineProps<{ tables: string[] }>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

interface ViewInfo {
  name: string;
  sql: string;
}

const viewName = ref("");
const baseTable = ref("");
const selectSql = ref("");
const views = ref<ViewInfo[]>([]);
const loading = ref(false);
const previewName = ref("");
const nameInputRef = ref<HTMLInputElement>();

const generatedSql = computed(() => {
  if (!viewName.value.trim() || !selectSql.value.trim()) {
    return "-- 填写视图名和 SELECT 语句后生成";
  }
  return `CREATE VIEW IF NOT EXISTS "${viewName.value.trim().replace(/"/g, '""')}" AS ${selectSql.value.trim()}`;
});

function baseOf(sql: string): string {
  const m = /\bFROM\s+"?([^\s"(;]+)"?/i.exec(sql);
  return m ? m[1] : "—";
}

function briefOf(sql: string): string {
  const m = /\bAS\b([\s\S]+)$/i.exec(sql);
  const body = (m ? m[1] : sql).replace(/\s+/g, " ").trim();
  return body.length > 40 ? body.slice(0, 40) + "…" : body || "—";
}

async function loadViews() {
  loading.value = true;
  const res = await runRead(
    "SELECT name, sql FROM sqlite_master WHERE type = 'view' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    []
  );
  views.value = res.success && Array.isArray(res.data) ? (res.data as any[]) : [];
  loading.value = false;
}

function focusForm() {
  nameInputRef.value?.focus();
  nameInputRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function onBaseTableChange() {
  if (baseTable.value && !selectSql.value.trim()) {
    selectSql.value = `SELECT * FROM "${baseTable.value}"`;
  }
}

function togglePreview(name: string) {
  previewName.value = previewName.value === name ? "" : name;
}

function createView() {
  if (generatedSql.value.startsWith("--")) {
    focusForm();
    return;
  }
  emit("execute", generatedSql.value);
  setTimeout(loadViews, 400);
}

function dropView(name: string) {
  emit("execute", `DROP VIEW IF EXISTS "${name.replace(/"/g, '""')}";`);
  views.value = views.value.filter((v) => v.name !== name);
}

async function exportSql() {
  try {
    await navigator.clipboard.writeText(generatedSql.value);
  } catch {
    /* 静默 */
  }
}

onMounted(loadViews);
</script>

<template>
  <div class="pnl">
    <header class="pnl-header">
      <span class="pnl-title">视图管理</span>
      <span class="pnl-sub">共 {{ views.length }} 个视图</span>
      <div class="pnl-actions">
        <button class="pb sm" @click="focusForm">新建视图</button>
      </div>
    </header>

    <div class="pnl-body">
      <div>
        <div class="dtable">
          <div class="dt-head">
            <span class="c-name">视图名</span>
            <span class="c-base">基于表</span>
            <span class="c-brief">说明</span>
            <span class="c-op">操作</span>
          </div>
          <div v-if="views.length === 0 && !loading" class="dt-empty">暂无视图，在下方创建</div>
          <template v-else>
            <div v-for="v in views" :key="v.name" class="dt-row">
              <span class="c-name dt-name" :title="v.name">{{ v.name }}</span>
              <span class="c-base">{{ baseOf(v.sql) }}</span>
              <span class="c-brief" :title="v.sql">{{ briefOf(v.sql) }}</span>
              <span class="c-op">
                <span class="dt-act" @click="togglePreview(v.name)">{{ previewName === v.name ? "收起" : "预览" }}</span>
                <span class="sep">·</span>
                <span class="dt-act danger" @click="dropView(v.name)">删除</span>
              </span>
            </div>
          </template>
        </div>
        <div v-if="previewName" class="dcode static preview">{{ views.find((v) => v.name === previewName)?.sql }}</div>
      </div>

      <div class="dcard">
        <div class="dform">
          <div class="dcard-title" style="margin-bottom: 0">
            新建视图
            <span class="sub">虚拟视图（非物化）</span>
          </div>
          <label class="dlabel">视图名称</label>
          <input ref="nameInputRef" v-model="viewName" class="dinput" placeholder="如 v_active_customers" />
          <label class="dlabel">基于表</label>
          <select v-model="baseTable" class="dinput" @change="onBaseTableChange">
            <option value="" disabled>请选择表</option>
            <option v-for="t in props.tables" :key="t" :value="t">{{ t }}</option>
          </select>
          <label class="dlabel">视图定义（SELECT 语句）</label>
          <textarea v-model="selectSql" class="dcode" rows="3" placeholder="SELECT id, name FROM 客户信息 WHERE status = 1" />
          <p class="dtip">提示：SQLite 视图是虚拟表，无 OR REPLACE，需先 DROP 再 CREATE；视图不可写。</p>
          <button class="pb block" :disabled="generatedSql.startsWith('--')" @click="createView">创建视图</button>
        </div>
      </div>

      <div class="exp-row">
        <button class="pb sm pb-blue-ghost" @click="exportSql">导出 / 复制 SQL</button>
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

.c-base {
  flex: 0 0 160px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-brief {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-op {
  flex: 0 0 110px;
  text-align: right;
}

.sep {
  margin: 0 6px;
  color: var(--text-muted);
}

.preview {
  margin-top: 8px;
  max-height: 140px;
}
</style>
