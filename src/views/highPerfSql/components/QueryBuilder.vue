<script setup lang="ts">
/**
 * 查询构建器（「高级 SQL」分页）：可视化拼 SELECT——字段/WHERE/GROUP BY/HAVING/ORDER BY/分页/JOIN。
 * 生成 SQL 经 emit("execute"/"explain") → index.vue 统一执行。
 *
 * 排版对齐设计稿（Ardot 高级SQL排版重设计 730657604354177）：
 *   左栏 340px 固定（数据源 + 字段 + DISTINCT）/ 右栏弹性（WHERE · 分组排序 · JOIN · SQL 预览）。
 *   执行行收敛到面板头（执行计划 + 执行查询主按钮）；JOIN / HAVING 为进阶项，默认折叠成一行摘要。
 */
import { ref, reactive, computed, nextTick } from "vue";
import { Play, Eye, Copy, Check, ChevronDown, ChevronUp, Plus, X } from "@lucide/vue";

interface Field {
  name: string;
  type: string;
}

interface Condition {
  field: string;
  operator: string;
  value: string;
  logic: string;
}

const props = defineProps<{
  tables: string[];
  tableFields: Record<string, Field[]>;
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
  (e: "explain", sql: string): void;
}>();

const OPERATORS = [
  { label: "等于", value: "=" },
  { label: "不等于", value: "!=" },
  { label: "大于", value: ">" },
  { label: "小于", value: "<" },
  { label: "大于等于", value: ">=" },
  { label: "小于等于", value: "<=" },
  { label: "模糊匹配", value: "LIKE" },
  { label: "不匹配", value: "NOT LIKE" },
  { label: "包含于", value: "IN" },
  { label: "不包含于", value: "NOT IN" },
  { label: "在范围内", value: "BETWEEN" },
  { label: "不在范围内", value: "NOT BETWEEN" },
  { label: "为空", value: "IS NULL" },
  { label: "不为空", value: "IS NOT NULL" },
];

const JOIN_TYPES = ["INNER", "LEFT", "RIGHT", "FULL"];

const queryForm = reactive({
  tableName: "",
  selectedFields: [] as string[],
  distinct: false,
  conditions: [{ field: "", operator: "=", value: "", logic: "AND" } as Condition],
  groupByEnabled: false,
  groupByFields: [] as string[],
  havingEnabled: false,
  havingCondition: "",
  orderByEnabled: false,
  orderByField: "",
  orderByDirection: "ASC",
  limit: 100,
  offset: 0,
  joinEnabled: false,
  joinType: "INNER",
  joinTable: "",
  joinField1: "",
  joinField2: "",
});

const copied = ref(false);
/** 进阶项展开态：JOIN 卡与 HAVING（随 GROUP BY 出现，可独立折叠） */
const joinOpen = ref(false);
const havingOpen = ref(false);

const currentFields = computed(() => props.tableFields[queryForm.tableName] || []);
const joinTableFields = computed(() => props.tableFields[queryForm.joinTable] || []);
const selectAllFields = computed(
  () => currentFields.value.length > 0 && currentFields.value.every((f) => queryForm.selectedFields.includes(f.name))
);

/** WHERE 有效条件数（用于卡头徽标） */
const activeConditionCount = computed(() => queryForm.conditions.filter((c) => c.field).length);

/** JOIN / HAVING 的一行摘要文案 */
const joinSummary = computed(() => {
  if (!queryForm.joinEnabled) return "开启后可选择关联表、关联方式与关联字段";
  if (!queryForm.joinTable) return "已开启，请选择关联表";
  const on =
    queryForm.joinField1 && queryForm.joinField2
      ? ` ON ${queryForm.tableName}.${queryForm.joinField1} = ${queryForm.joinTable}.${queryForm.joinField2}`
      : "";
  return `已生成 ${queryForm.joinType} JOIN ${queryForm.joinTable}${on}`;
});

const havingSummary = computed(() => {
  if (!queryForm.havingEnabled) return "开启后可对聚合结果再做过滤";
  return queryForm.havingCondition.trim() ? `HAVING ${queryForm.havingCondition.trim()}` : "已开启，请填写聚合过滤条件";
});

/** SQL 高亮：逐行按 token 着色（对齐设计稿配色）。
 *  关键字可出现在行首（SELECT / FROM…）也可出现在行中（AND / OR / JOIN / ON），
 *  因此对整行做正则切分，而不是只匹配行首。
 *  切分顺序：关键字 → 双引号标识符（表名/字段名，绿）→ 单引号字符串（值，蓝）。 */
const SQL_KEYWORDS =
  "SELECT|DISTINCT|FROM|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|OFFSET|" +
  "INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|JOIN|ON|AND|OR|NOT BETWEEN|NOT IN|NOT LIKE|" +
  "BETWEEN|IN|LIKE|IS NOT NULL|IS NULL|ASC|DESC|AS";

/** 把不含关键字的普通片段再细分为「标识符 / 字符串 / 其它」，避免表名字段名与值同色 */
function splitPlain(text: string): Array<{ text: string; cls: string }> {
  const re = /("(?:[^"]|"")*")|('(?:[^']|'')*')/g;
  const out: Array<{ text: string; cls: string }> = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), cls: "n" });
    out.push({ text: m[0], cls: m[1] ? "id" : "n" });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), cls: "n" });
  return out;
}

const sqlLines = computed(() => {
  const kwRe = new RegExp(`\\b(${SQL_KEYWORDS})\\b`, "gi");
  return generatedSql.value.split("\n").map((line) => {
    const parts: Array<{ text: string; cls: string }> = [];
    const head = line.trimStart();
    const indent = line.slice(0, line.length - head.length);

    // 注释整行
    if (/^--/.test(head)) {
      return { indent, parts: [{ text: head, cls: "c" }] };
    }

    let last = 0;
    for (const m of head.matchAll(kwRe)) {
      if (m.index! > last) parts.push(...splitPlain(head.slice(last, m.index)));
      const isLogic = /^(AND|OR)$/i.test(m[0]);
      parts.push({ text: m[0], cls: isLogic ? "k logic" : "k" });
      last = m.index! + m[0].length;
    }
    if (last < head.length) parts.push(...splitPlain(head.slice(last)));
    if (parts.length === 0) parts.push({ text: head, cls: "n" });

    return { indent, parts };
  });
});

function toggleField(name: string) {
  const i = queryForm.selectedFields.indexOf(name);
  if (i >= 0) queryForm.selectedFields.splice(i, 1);
  else queryForm.selectedFields.push(name);
}

function toggleSelectAll() {
  queryForm.selectedFields = selectAllFields.value ? [] : currentFields.value.map((f) => f.name);
}

function toggleGroupBy(name: string) {
  const i = queryForm.groupByFields.indexOf(name);
  if (i >= 0) queryForm.groupByFields.splice(i, 1);
  else queryForm.groupByFields.push(name);
}

function handleTableChange() {
  queryForm.selectedFields = [];
  queryForm.groupByFields = [];
  queryForm.conditions = [{ field: "", operator: "=", value: "", logic: "AND" }];
}

const condListRef = ref<HTMLElement>();
async function addCondition() {
  queryForm.conditions.push({ field: "", operator: "=", value: "", logic: "AND" });
  await nextTick();
  // 聚焦新增行的「字段」下拉（而非行首的 AND/OR 连接符）
  const rows = condListRef.value?.querySelectorAll<HTMLElement>(".cond-row");
  rows?.[rows.length - 1]?.querySelector<HTMLElement>(".f-sel")?.focus();
}

function removeCondition(index: number) {
  queryForm.conditions.splice(index, 1);
  // 首行的 logic 无意义（无条件前置），归一化避免残留脏值
  if (queryForm.conditions[0]) queryForm.conditions[0].logic = "AND";
}

function getPlaceholder(operator: string): string {
  if (operator.includes("NULL")) return "";
  if (operator.includes("IN")) return "(value1, value2, ...)";
  if (operator.includes("BETWEEN")) return "value1 AND value2";
  if (operator === "LIKE") return "%pattern%";
  return "请输入值";
}

/** 操作符的完整标签（用于 select 的悬停提示，如「>=」→「大于等于」） */
function operatorLabel(value: string): string {
  return OPERATORS.find((o) => o.value === value)?.label ?? value;
}

/** 末行（含唯一一行）的悬停提示改为向上弹出，避免被面板体的 overflow 裁切 */
function isLastRow(index: number): boolean {
  return index === queryForm.conditions.length - 1;
}

function q(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

const generatedSql = computed(() => {
  if (!queryForm.tableName) return "-- 请先选择数据源表";

  const fields = queryForm.selectedFields.length > 0 ? queryForm.selectedFields.map(q).join(", ") : "*";
  let sql = `SELECT ${queryForm.distinct ? "DISTINCT " : ""}${fields} FROM ${q(queryForm.tableName)}`;

  if (queryForm.joinEnabled && queryForm.joinTable) {
    sql += ` ${queryForm.joinType} JOIN ${q(queryForm.joinTable)}`;
    if (queryForm.joinField1 && queryForm.joinField2) {
      sql += ` ON ${q(queryForm.tableName)}.${q(queryForm.joinField1)} = ${q(queryForm.joinTable)}.${q(queryForm.joinField2)}`;
    }
  }

  const conds = queryForm.conditions.filter((c) => c.field);
  if (conds.length > 0) {
    const parts: string[] = [];
    conds.forEach((cond, i) => {
      let valuePart = "";
      if (cond.operator.includes("NULL")) {
        valuePart = "";
      } else if (cond.operator.includes("IN") || cond.operator.includes("BETWEEN")) {
        valuePart = ` ${cond.value}`;
      } else {
        const fieldType = currentFields.value.find((f) => f.name === cond.field)?.type;
        const isNumber = fieldType && /INT|REAL|FLOAT|NUMERIC/i.test(fieldType);
        valuePart = ` ${isNumber ? cond.value : `'${cond.value.replace(/'/g, "''")}'`}`;
      }
      const fragment = `${q(cond.field)} ${cond.operator}${valuePart}`;
      // 连接符归属于「本行」：第 i 行的 logic 表示它与前一个条件的连接方式，
      // 首行无条件前置 → 忽略其 logic。这样 UI 上「本行左侧的 AND/OR」与 SQL 完全对应。
      if (i === 0) parts.push(fragment);
      else parts.push(cond.logic === "OR" ? "OR" : "AND", fragment);
    });
    sql += " WHERE " + parts.join(" ");
  }

  if (queryForm.groupByEnabled && queryForm.groupByFields.length > 0) {
    sql += " GROUP BY " + queryForm.groupByFields.map(q).join(", ");
  }

  if (queryForm.havingEnabled && queryForm.havingCondition.trim()) {
    sql += " HAVING " + queryForm.havingCondition.trim();
  }

  if (queryForm.orderByEnabled && queryForm.orderByField) {
    sql += ` ORDER BY ${q(queryForm.orderByField)} ${queryForm.orderByDirection}`;
  }

  if (queryForm.limit > 0) sql += ` LIMIT ${queryForm.limit}`;
  if (queryForm.offset > 0) sql += ` OFFSET ${queryForm.offset}`;

  return sql;
});

const canRun = computed(() => !!queryForm.tableName);

const fieldTypes = computed(() => props.tableFields[queryForm.tableName] || []);

function executeQuery() {
  if (!canRun.value) return;
  emit("execute", generatedSql.value);
}

function showExplain() {
  if (!canRun.value) return;
  emit("explain", generatedSql.value);
}

async function copySql() {
  try {
    await navigator.clipboard.writeText(generatedSql.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* 剪贴板不可用时静默 */
  }
}

/** 回车即执行（值输入框内），与旧版行为一致 */
function onValueEnter() {
  executeQuery();
}

defineExpose({ generatedSql, executeQuery, showExplain });
</script>

<template>
  <div class="pnl">
    <!-- 面板头：标题 + 副标题 + 执行行（执行计划 ghost / 执行查询主按钮） -->
    <header class="pnl-header">
      <div class="pnl-head-text">
        <span class="pnl-title">高级 SQL</span>
        <span class="pnl-sub">可视化拼装查询条件，或直接编辑生成的 SQL</span>
      </div>
      <div class="pnl-actions">
        <button class="pb sm pb-gray" :disabled="!canRun" title="查看查询计划" @click="showExplain">
          <Eye class="ic" />执行计划
        </button>
        <button class="pb sm" :disabled="!canRun" @click="executeQuery">
          <Play class="ic" />执行查询
        </button>
      </div>
    </header>

    <div class="pnl-body">
      <!-- 主从两栏：左 340px 固定条件栏 / 右弹性构建区 -->
      <aside class="qb-side">
        <!-- 数据源 -->
        <section class="dcard">
          <div class="dcard-title">
            数据源
            <span class="cnt">{{ tables.length }}</span>
          </div>
          <select v-model="queryForm.tableName" class="dinput mono" @change="handleTableChange">
            <option value="" disabled>请选择表</option>
            <option v-for="t in props.tables" :key="t" :value="t">{{ t }}</option>
          </select>
        </section>

        <!-- 字段 -->
        <section class="dcard">
          <div class="dcard-title">
            字段
            <button v-if="currentFields.length > 0" class="link-btn" @click="toggleSelectAll">
              {{ selectAllFields ? "取消全选" : "全选" }}
            </button>
          </div>

          <p v-if="currentFields.length === 0" class="dtip">选择数据源后展示字段</p>
          <template v-else>
            <div class="field-list">
              <button
                v-for="f in currentFields"
                :key="f.name"
                class="field-item"
                :class="{ on: queryForm.selectedFields.includes(f.name) }"
                @click="toggleField(f.name)"
              >
                <span class="tick">
                  <Check v-if="queryForm.selectedFields.includes(f.name)" class="ic" />
                </span>
                <span class="fname">{{ f.name }}</span>
                <span class="ftype">{{ f.type }}</span>
              </button>
            </div>
            <div class="field-foot">
              已选 <b>{{ queryForm.selectedFields.length }}</b> / {{ currentFields.length }}
            </div>
          </template>
        </section>

        <!-- 结果去重 -->
        <section class="dcard distinct-card">
          <span class="dlabel">结果去重 DISTINCT</span>
          <button
            class="toggle"
            :class="{ on: queryForm.distinct }"
            :aria-pressed="queryForm.distinct"
            title="结果去重 DISTINCT"
            @click="queryForm.distinct = !queryForm.distinct"
          />
        </section>
      </aside>

      <div class="qb-main">
        <!-- 筛选条件 -->
        <section class="dcard">
          <div class="dcard-title">
            筛选条件 WHERE
            <span v-if="activeConditionCount > 0" class="badge">{{ activeConditionCount }}</span>
            <button class="link-btn" @click="addCondition">＋ 添加条件</button>
          </div>

          <div ref="condListRef" class="cond-list">
            <div v-for="(cond, i) in queryForm.conditions" :key="i" class="cond-row">
              <!-- 连接符属于「本行」：首行是 WHERE 起头，之后每行左侧是自己的 AND / OR -->
              <div
                v-if="i > 0"
                class="tip-wrap w-logic" :class="{ flip: isLastRow(i) }"
                data-tip="本行与上一条件的连接方式（AND / OR）"
              >
                <select v-model="cond.logic" class="dinput logic-sel">
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              </div>
              <span v-else class="logic-tag" data-tip="条件组起始">WHERE</span>

              <div
                class="tip-wrap w-field" :class="{ flip: isLastRow(i) }"
                :data-tip="cond.field ? `字段：${cond.field}` : '请选择要筛选的字段'"
              >
                <select v-model="cond.field" class="dinput f-sel">
                  <option value="" disabled>字段</option>
                  <option v-for="f in currentFields" :key="f.name" :value="f.name">{{ f.name }}</option>
                </select>
              </div>

              <div
                class="tip-wrap w-op" :class="{ flip: isLastRow(i) }"
                :data-tip="`运算符：${operatorLabel(cond.operator)}`"
              >
                <select v-model="cond.operator" class="dinput op-sel">
                  <option v-for="op in OPERATORS" :key="op.value" :value="op.value">{{ op.label }}</option>
                </select>
              </div>

              <div
                v-if="!cond.operator.includes('NULL')"
                class="tip-wrap grow" :class="{ flip: isLastRow(i) }"
                :data-tip="
                  cond.value ? `值：${cond.value}` : `请输入值（${getPlaceholder(cond.operator) || '无需填写'}）`
                "
              >
                <input
                  v-model="cond.value"
                  class="dinput val-in"
                  :placeholder="getPlaceholder(cond.operator)"
                  @keyup.enter="onValueEnter"
                />
              </div>
              <span v-else class="null-hint" :title="`${cond.operator} 无需填写值`">
                {{ cond.operator }}
              </span>

              <button
                v-if="queryForm.conditions.length > 1"
                class="cond-del"
                title="删除该条件"
                @click="removeCondition(i)"
              >
                <X class="ic" />
              </button>
            </div>
          </div>

          <button class="add-row" @click="addCondition"><Plus class="ic" />添加条件</button>
        </section>

        <!-- 分组与排序（HAVING 为进阶项，默认折叠） -->
        <section class="dcard">
          <div class="dcard-title">分组与排序</div>

          <div class="opt-row">
            <span class="opt-label">分组 GROUP BY</span>
            <div class="opt-body">
              <div class="seg-group">
                <button
                  class="seg"
                  :class="{ on: queryForm.groupByEnabled }"
                  @click="queryForm.groupByEnabled = true"
                >
                  开启
                </button>
                <button
                  class="seg"
                  :class="{ on: !queryForm.groupByEnabled }"
                  @click="queryForm.groupByEnabled = false"
                >
                  关闭
                </button>
              </div>
              <template v-if="queryForm.groupByEnabled">
                <span v-for="f in queryForm.groupByFields" :key="f" class="chip-tag">
                  {{ f }}
                  <button class="chip-x" title="移除" @click="toggleGroupBy(f)">×</button>
                </span>
                <span v-if="queryForm.groupByFields.length === 0" class="opt-hint">勾选下方字段加入分组</span>
              </template>
              <span v-else class="opt-hint">开启后可勾选多个字段分组</span>
            </div>
          </div>

          <!-- 开启分组后，字段以可勾选列表呈现（替代旧的第二排 chips，避免重复） -->
          <div v-if="queryForm.groupByEnabled && currentFields.length > 0" class="opt-row">
            <span class="opt-label">分组字段</span>
            <div class="opt-body">
              <div class="field-list compact">
                <button
                  v-for="f in currentFields"
                  :key="f.name"
                  class="field-item"
                  :class="{ on: queryForm.groupByFields.includes(f.name) }"
                  @click="toggleGroupBy(f.name)"
                >
                  <span class="tick">
                    <Check v-if="queryForm.groupByFields.includes(f.name)" class="ic" />
                  </span>
                  <span class="fname">{{ f.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- HAVING：进阶项，默认折叠成一行摘要 -->
          <div class="adv-block" :class="{ open: havingOpen }">
            <button class="adv-head" @click="havingOpen = !havingOpen">
              <span class="dlabel">聚合 HAVING</span>
              <span class="pill" :class="{ on: queryForm.havingEnabled }">
                {{ queryForm.havingEnabled ? "已开启" : "已关闭" }}
              </span>
              <span class="adv-sum">{{ havingSummary }}</span>
              <component :is="havingOpen ? ChevronUp : ChevronDown" class="ic adv-caret" />
            </button>
            <div v-if="havingOpen" class="adv-body">
              <div class="opt-row">
                <span class="opt-label">启用过滤</span>
                <div class="opt-body">
                  <button
                    class="toggle"
                    :class="{ on: queryForm.havingEnabled }"
                    :aria-pressed="queryForm.havingEnabled"
                    title="启用 HAVING 聚合过滤"
                    @click="queryForm.havingEnabled = !queryForm.havingEnabled"
                  />
                  <span class="opt-hint">对聚合结果再过滤，如 COUNT(*) &gt; 1</span>
                </div>
              </div>
              <input
                v-if="queryForm.havingEnabled"
                v-model="queryForm.havingCondition"
                class="dinput mono"
                placeholder="例如 COUNT(*) > 10"
              />
            </div>
          </div>

          <div class="opt-row">
            <span class="opt-label">排序 ORDER BY</span>
            <div class="opt-body">
              <div class="seg-group">
                <button
                  class="seg"
                  :class="{ on: queryForm.orderByEnabled }"
                  @click="queryForm.orderByEnabled = true"
                >
                  开启
                </button>
                <button
                  class="seg"
                  :class="{ on: !queryForm.orderByEnabled }"
                  @click="queryForm.orderByEnabled = false"
                >
                  关闭
                </button>
              </div>
              <template v-if="queryForm.orderByEnabled">
                <div class="tip-wrap w-order" :data-tip="`排序字段：${queryForm.orderByField || '未选择'}`">
                  <select v-model="queryForm.orderByField" class="dinput order-sel">
                    <option value="" disabled>排序字段</option>
                    <option v-for="f in currentFields" :key="f.name" :value="f.name">{{ f.name }}</option>
                  </select>
                </div>
                <div class="seg-group">
                  <button
                    class="seg"
                    :class="{ on: queryForm.orderByDirection === 'ASC' }"
                    title="升序"
                    @click="queryForm.orderByDirection = 'ASC'"
                  >
                    升序 ↑
                  </button>
                  <button
                    class="seg"
                    :class="{ on: queryForm.orderByDirection === 'DESC' }"
                    title="降序"
                    @click="queryForm.orderByDirection = 'DESC'"
                  >
                    降序 ↓
                  </button>
                </div>
              </template>
              <span v-else class="opt-hint">开启后选择排序字段与方向</span>
            </div>
          </div>

          <div class="opt-row">
            <span class="opt-label">LIMIT / OFFSET</span>
            <div class="opt-body">
              <input v-model.number="queryForm.limit" type="number" min="0" class="dinput num-in" />
              <span class="opt-hint">取前 N 行</span>
              <input v-model.number="queryForm.offset" type="number" min="0" class="dinput num-in" />
              <span class="opt-hint">跳过行数</span>
            </div>
          </div>
        </section>

        <!-- 关联表 JOIN：进阶项，默认折叠 -->
        <section class="dcard adv-card" :class="{ open: joinOpen }">
          <button class="adv-head" @click="joinOpen = !joinOpen">
            <span class="dlabel">关联表 JOIN</span>
            <span class="pill" :class="{ on: queryForm.joinEnabled }">
              {{ queryForm.joinEnabled ? "已开启" : "已关闭" }}
            </span>
            <span class="adv-sum">{{ joinSummary }}</span>
            <button
              class="toggle"
              :class="{ on: queryForm.joinEnabled }"
              :aria-pressed="queryForm.joinEnabled"
              title="启用关联表 JOIN"
              @click.stop="queryForm.joinEnabled = !queryForm.joinEnabled"
            />
            <component :is="joinOpen ? ChevronUp : ChevronDown" class="ic adv-caret" />
          </button>

          <div v-if="joinOpen" class="adv-body">
            <div class="opt-row">
              <span class="opt-label">关联方式</span>
              <div class="opt-body">
                <div class="seg-group">
                  <button
                    v-for="t in JOIN_TYPES"
                    :key="t"
                    class="seg"
                    :class="{ on: queryForm.joinType === t }"
                    @click="queryForm.joinType = t"
                  >
                    {{ t }}
                  </button>
                </div>
                <div class="tip-wrap w-join" :data-tip="`关联表：${queryForm.joinTable || '未选择'}`">
                  <select v-model="queryForm.joinTable" class="dinput join-sel">
                    <option value="" disabled>关联表</option>
                    <option v-for="t in props.tables.filter((x) => x !== queryForm.tableName)" :key="t" :value="t">
                      {{ t }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="opt-row">
              <span class="opt-label">关联字段</span>
              <div class="opt-body">
                <div class="tip-wrap grow" :data-tip="`本表字段：${queryForm.joinField1 || '未选择'}`">
                  <select v-model="queryForm.joinField1" class="dinput jf-sel">
                    <option value="" disabled>本表字段</option>
                    <option v-for="f in currentFields" :key="f.name" :value="f.name">{{ f.name }}</option>
                  </select>
                </div>
                <span class="opt-hint">=</span>
                <div
                  class="tip-wrap grow"
                  :data-tip="
                    queryForm.joinTable
                      ? `关联表字段：${queryForm.joinField2 || '未选择'}`
                      : '请先选择关联表'
                  "
                >
                  <select v-model="queryForm.joinField2" class="dinput jf-sel" :disabled="!queryForm.joinTable">
                    <option value="" disabled>关联表字段</option>
                    <option v-for="f in joinTableFields" :key="f.name" :value="f.name">{{ f.name }}</option>
                  </select>
                </div>
              </div>
            </div>

            <p class="dtip">{{ joinSummary }}</p>
          </div>
        </section>

        <!-- SQL 预览 -->
        <section class="dcard">
          <div class="dcard-title">
            SQL 预览
            <span class="pill">自动同步</span>
            <button class="copy-btn" @click="copySql">
              <component :is="copied ? Check : Copy" class="ic" />
              {{ copied ? "已复制" : "复制 SQL" }}
            </button>
          </div>

          <pre class="sql-box"><code><span v-for="(ln, i) in sqlLines" :key="i" class="sql-line"><span
            class="indent">{{ ln.indent }}</span><span
            v-for="(p, j) in ln.parts"
            :key="j"
            :class="p.cls"
          >{{ p.text }}</span>{{ "\n" }}</span></code></pre>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "./panel.scss" as *;

/* ===== 面板头：标题块竖排（标题 + 副标题），右侧执行行 ===== */
.pnl-head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ic {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* ===== 主从两栏 ===== */
.pnl-body {
  /* 覆盖共享样式的纵向单列：本页为左右两栏 */
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
}

.qb-side {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.qb-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ===== 卡头微调：计数 / 徽标 / 链接按钮 ===== */
.dcard-title {
  font-size: 13px;

  .cnt,
  .badge {
    font-family: Consolas, "Courier New", monospace;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    padding: 3px 7px;
    border-radius: 4px;
    background: var(--bg-hover);
    color: var(--text-muted);
  }

  .badge {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }
}

.link-btn {
  margin-left: auto;
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
  font-family: inherit;

  &:hover {
    text-decoration: underline;
  }
}

.pill {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-muted);

  &.on {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }
}

/* ===== 字段列表（左栏主用法 + 分组字段复用） ===== */
.field-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;

  &.compact {
    max-height: none;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
  }
}

.field-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  text-align: left;

  &:hover {
    background: var(--bg-hover);
  }

  .tick {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    background: var(--bg-card);
    color: #fff;

    .ic {
      width: 11px;
      height: 11px;
    }
  }

  .fname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: Consolas, "Courier New", monospace;
  }

  .ftype {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  &.on {
    color: var(--text-primary);

    .tick {
      border-color: var(--color-primary);
      background: var(--color-primary);
    }
  }
}

.field-foot {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
  font-size: 11px;
  color: var(--text-muted);

  b {
    color: var(--text-secondary);
    font-weight: 600;
  }
}

/* 压缩卡：去重开关一行 */
.distinct-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  flex-shrink: 0;
}

/* ===== WHERE 条件行 ===== */
.cond-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cond-row {
  display: flex;
  align-items: center;
  gap: 8px;

  /* 行尾删除按钮由「条件数 > 1」控制显隐，这里不挤压主控件 */
  .dinput {
    height: 36px;
  }
}

/* 悬停提示容器：自身承担列宽，内部控件填满；
   用 label 包裹是为了让 select/input 的点击区与提示区完全重合 */
.tip-wrap {
  position: relative;
  display: flex;
  min-width: 0;

  > .dinput {
    width: 100%;
    min-width: 0;
  }

  &::after {
    content: attr(data-tip);
    position: absolute;
    left: 0;
    top: calc(100% + 6px);
    z-index: 30;
    max-width: 320px;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(28, 32, 42, 0.94);
    color: #eef1f6;
    font-size: 12px;
    font-family: inherit;
    line-height: 1.5;
    white-space: normal;
    word-break: break-all;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-3px);
    transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
    pointer-events: none;
  }

  &:hover::after,
  &:focus-within::after {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  /* 末行向上弹出：否则会被面板体的 overflow-y:auto 裁掉 */
  &.flip::after {
    top: auto;
    bottom: calc(100% + 6px);
    transform: translateY(3px);
  }

  &.flip:hover::after,
  &.flip:focus-within::after {
    transform: translateY(0);
  }
}

.tip-wrap.grow {
  flex: 1;
  min-width: 140px;
}

/* 三列固定宽（显式类，不依赖 :has()）；数值按最宽内容留足余量 */
.tip-wrap.w-logic {
  flex: 0 0 62px;
}

.tip-wrap.w-field {
  flex: 0 0 168px;
}

.tip-wrap.w-op {
  flex: 0 0 128px;
}

.logic-tag,
.null-hint {
  position: relative;
}

/* 列宽基准：逻辑 62 / 字段 168 / 操作符 128 / 值 弹性 / 删除 28
   —— 均按最宽内容（AND、长字段名、大于等于）留足空间，不再截断 */
.logic-sel {
  padding: 0 4px 0 8px;
  text-align: center;
  color: var(--color-primary);
  font-weight: 600;
}

.logic-tag {
  flex: 0 0 62px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border-radius: 8px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.f-sel {
  font-family: Consolas, "Courier New", monospace;
}

.op-sel {
  padding: 0 4px 0 10px;
}

.val-in {
  font-family: Consolas, "Courier New", monospace;
}

/* IS NULL / IS NOT NULL：不需要值输入，用只读标签占位保持列对齐 */
.null-hint {
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 12px;
  font-family: Consolas, "Courier New", monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cond-del {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-muted);
  cursor: pointer;

  &:hover {
    border-color: var(--color-error);
    color: var(--color-error);
  }
}

.add-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  margin-top: 10px;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, color 0.15s;

  .ic {
    width: 13px;
    height: 13px;
  }

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

/* ===== 分组/排序/条数：左标签 + 右控件 ===== */
.opt-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.opt-label {
  flex: 0 0 96px;
  padding-top: 7px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.opt-body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.opt-hint {
  font-size: 11px;
  color: var(--text-muted);
}

/* 分段选择组：壳内两枚，选中蓝底白字 */
.seg-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-hover);
}

.seg-group .seg {
  height: 26px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    color: var(--color-primary);
  }

  &.on {
    background: var(--color-primary);
    color: #fff;
  }
}

.chip-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 24px;
  padding: 0 4px 0 9px;
  border-radius: 5px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 11px;
  font-family: Consolas, "Courier New", monospace;

  .chip-x {
    border: none;
    background: none;
    padding: 0 4px;
    color: var(--color-primary);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: var(--color-error);
    }
  }
}

.order-sel {
  flex: 0 0 180px;
  height: 30px;
  font-family: Consolas, "Courier New", monospace;
}

.num-in {
  flex: 0 0 92px;
  height: 30px;
  text-align: center;
  font-family: Consolas, "Courier New", monospace;
}

/* 分组/排序/JOIN 区内的 select 也带悬停提示，宽度在这里统一 */
.tip-wrap.w-order {
  flex: 0 0 180px;

  > .order-sel {
    width: 100%;
  }
}

.tip-wrap.w-join {
  flex: 1;
  min-width: 160px;
}

.tip-wrap .order-sel,
.tip-wrap .join-sel,
.tip-wrap .jf-sel {
  height: 30px;
}

/* ===== 进阶项（JOIN / HAVING）：默认折叠为一行摘要 ===== */
.adv-card {
  padding: 0;
  overflow: hidden;

  &.open {
    border-color: var(--color-primary);
  }
}

.adv-block {
  margin-top: 4px;
  margin-bottom: 12px;
  border-top: 1px solid var(--border-subtle);
}

.adv-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;

  &:hover .adv-caret {
    color: var(--color-primary);
  }
}

.adv-card .adv-head {
  padding: 14px 16px;
}

.adv-sum {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-muted);
}

.adv-caret {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.adv-body {
  padding: 0 16px 14px;
}

.adv-block .adv-body {
  padding: 0 0 12px;
}

/* ===== SQL 预览 ===== */
.sql-box {
  margin: 0;
  padding: 14px 16px;
  border-radius: 8px;
  background: #1e283c;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  max-height: 260px;
  overflow-y: auto;

  code {
    display: block;
    white-space: pre;
  }
}

.sql-line {
  /* 每行独立块，便于着色 */
  display: block;
}

.indent {
  white-space: pre;
}

/* 关键字 / 普通字面量 / 注释，对齐设计稿 #C4D2F0 / #F2B95C / #8496B8 */
.sql-box .k {
  color: #f2b95c;
}

/* AND / OR 连接符加重，便于确认条件组合生效 */
.sql-box .k.logic {
  color: #ffd479;
  font-weight: 700;
}

.sql-box .n {
  color: #c4d2f0;
}

/* 双引号内的表名 / 字段名 */
.sql-box .id {
  color: #7ed0a8;
}

.sql-box .c {
  color: #8496b8;
}

.copy-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;

  .ic {
    width: 12px;
    height: 12px;
  }

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

/* 窄屏（面板被压到 <1100px）改为上下堆叠，避免控件被挤爆 */
@media (max-width: 1100px) {
  .pnl-body {
    flex-direction: column;
  }

  .qb-side {
    flex: 0 0 auto;
    width: 100%;
  }

  .cond-row {
    flex-wrap: wrap;
  }
}
</style>
