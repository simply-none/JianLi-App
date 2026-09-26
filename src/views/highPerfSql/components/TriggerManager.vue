<script setup lang="ts">
/**
 * 触发器管理（对齐设计稿 3:394）：触发表卡（名称/时机·事件/作用表/状态/操作）
 * + 新建表单（名称/时机/事件/作用表/WHEN 可选/触发体深色编辑器）+ 导出 SQL。
 * 清单走 sqlite_master（new-sql:read），时机·事件从 DDL 解析。
 */
import { ref, computed, onMounted } from "vue";
import { runRead } from "../visual/api";

const props = defineProps<{ tables: string[] }>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

interface TriggerInfo {
  name: string;
  tbl: string;
  sql: string;
  timing: string;
  event: string;
}

const triggerName = ref("");
const tableName = ref("");
const event = ref("INSERT");
const timing = ref("AFTER");
const whenClause = ref("");
const bodySql = ref("");
const triggers = ref<TriggerInfo[]>([]);
const loading = ref(false);
const nameInputRef = ref<HTMLInputElement>();

const EVENTS = ["INSERT", "UPDATE", "DELETE"];
const TIMINGS = ["BEFORE", "AFTER", "INSTEAD OF"];

const generatedSql = computed(() => {
  if (!triggerName.value.trim() || !tableName.value || !bodySql.value.trim()) {
    return "-- 填写触发器名、作用表和触发体后生成";
  }
  let sql = `CREATE TRIGGER IF NOT EXISTS "${triggerName.value.trim().replace(/"/g, '""')}"\n  ${timing.value} ${event.value} ON "${tableName.value.replace(/"/g, '""')}"`;
  if (whenClause.value.trim()) sql += `\n  WHEN ${whenClause.value.trim()}`;
  const body = bodySql.value.trim();
  sql += body.toUpperCase().startsWith("BEGIN") ? `\n${body};` : `\nBEGIN\n  ${body}\nEND;`;
  return sql;
});

async function loadTriggers() {
  loading.value = true;
  const res = await runRead(
    "SELECT name, tbl_name AS tbl, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
    []
  );
  const list: any[] = res.success && Array.isArray(res.data) ? (res.data as any[]) : [];
  triggers.value = list.map((t) => {
    const m = /\b(BEFORE|AFTER|INSTEAD\s+OF)\s+(INSERT|UPDATE|DELETE)/i.exec(t.sql || "");
    return { ...t, timing: m?.[1] ?? "—", event: m?.[2] ?? "—" } as TriggerInfo;
  });
  loading.value = false;
}

function focusForm() {
  nameInputRef.value?.focus();
  nameInputRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function createTrigger() {
  if (generatedSql.value.startsWith("--")) {
    focusForm();
    return;
  }
  emit("execute", generatedSql.value);
  setTimeout(loadTriggers, 400);
}

function dropTrigger(name: string) {
  emit("execute", `DROP TRIGGER IF EXISTS "${name.replace(/"/g, '""')}";`);
  triggers.value = triggers.value.filter((t) => t.name !== name);
}

async function exportSql() {
  try {
    await navigator.clipboard.writeText(generatedSql.value);
  } catch {
    /* 静默 */
  }
}

onMounted(loadTriggers);
</script>

<template>
  <div class="pnl">
    <header class="pnl-header">
      <span class="pnl-title">触发器</span>
      <span class="pnl-sub">共 {{ triggers.length }} 个触发器</span>
      <div class="pnl-actions">
        <button class="pb sm" @click="focusForm">新建触发器</button>
      </div>
    </header>

    <div class="pnl-body">
      <div class="dtable">
        <div class="dt-head">
          <span class="c-name">名称</span>
          <span class="c-when">时机 · 事件</span>
          <span class="c-table">作用表</span>
          <span class="c-status">状态</span>
        </div>
        <div v-if="triggers.length === 0 && !loading" class="dt-empty">暂无触发器，在下方创建</div>
        <template v-else>
          <div v-for="t in triggers" :key="t.name" class="dt-row">
            <span class="c-name dt-name" :title="t.name">{{ t.name }}</span>
            <span class="c-when">{{ t.timing }} {{ t.event }}</span>
            <span class="c-table">{{ t.tbl }}</span>
            <span class="c-status dt-ok">正常</span>
            <span class="row-del" title="删除该触发器" @click="dropTrigger(t.name)">删除</span>
          </div>
        </template>
      </div>

      <div class="dcard">
        <div class="dform">
          <div class="dcard-title" style="margin-bottom: 0">
            新建触发器
            <span class="sub">仅 FOR EACH ROW</span>
          </div>
          <label class="dlabel">触发器名称</label>
          <input ref="nameInputRef" v-model="triggerName" class="dinput" placeholder="如 trg_after_insert_order" />
          <label class="dlabel">时机（BEFORE / AFTER）</label>
          <select v-model="timing" class="dinput">
            <option v-for="t in TIMINGS" :key="t" :value="t">{{ t }}</option>
          </select>
          <label class="dlabel">事件（INSERT / UPDATE / DELETE）</label>
          <select v-model="event" class="dinput">
            <option v-for="e in EVENTS" :key="e" :value="e">{{ e }}</option>
          </select>
          <label class="dlabel">作用表</label>
          <select v-model="tableName" class="dinput">
            <option value="" disabled>请选择表</option>
            <option v-for="t in props.tables" :key="t" :value="t">{{ t }}</option>
          </select>
          <label class="dlabel">WHEN 条件（可选）</label>
          <input v-model="whenClause" class="dinput" placeholder="如 NEW.amount > 0" />
          <label class="dlabel">触发体（BEGIN … END 多语句）</label>
          <textarea v-model="bodySql" class="dcode" rows="3" placeholder="BEGIN 插入日志表 END" />
          <p class="dtip">提示：SQLite 触发器仅 FOR EACH ROW；可选 WHEN；触发体可含多条语句与 RAISE()；无 ALTER，需 DROP 重建。</p>
          <button class="pb block" :disabled="generatedSql.startsWith('--')" @click="createTrigger">创建触发器</button>
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
  flex: 0 0 260px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-when {
  flex: 0 0 180px;
}

.c-table {
  flex: 1;
  min-width: 0;
}

.c-status {
  flex: 0 0 80px;
}
</style>
