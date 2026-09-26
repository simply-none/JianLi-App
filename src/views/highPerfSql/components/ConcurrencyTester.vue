<script setup lang="ts">
/**
 * 并发测试（对齐设计稿 3:418）：说明卡 + 并发/超时配置 + 语句输入（深色）
 * + journal_mode / busy_timeout / 请求类型 分段选择 + 进度卡 + 统计卡 + 结果表 + 报告导出。
 * 压测打 new-sql:execute（主进程写锁串行化），数值仅作参考。
 */
import { reactive, computed, ref } from "vue";

const props = defineProps<{ tables: string[] }>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

interface ResultRow {
  type: string;
  sql: string;
  time: number;
  ok: boolean;
}

const testConfig = reactive({
  concurrency: 10,
  timeout: 3000,
  repeat: 1,
  requestType: "read",
  tableName: "",
  customSql: "",
  journalMode: "WAL",
  busyTimeout: 5000,
});

const testStats = reactive({
  total: 0,
  completed: 0,
  success: 0,
  failed: 0,
  avgTime: 0,
  maxTime: 0,
  minTime: Infinity,
  qps: 0,
});

const resultRows = ref<ResultRow[]>([]);
const isTesting = ref(false);
const stopRequested = ref(false);
const startTime = ref(0);
const elapsedText = ref("0.0s");

const JOURNAL_MODES = ["WAL", "DELETE", "TRUNCATE"];
const REQUEST_TYPES = [
  { label: "读", value: "read" },
  { label: "写", value: "write" },
  { label: "混合", value: "mixed" },
];

const progressPercent = computed(() => (testStats.total === 0 ? 0 : (testStats.completed / testStats.total) * 100));

function generateSql(): string {
  if (testConfig.customSql.trim()) {
    return testConfig.customSql.trim().replace(/;+$/, "") + ";";
  }
  const table = testConfig.tableName || props.tables[0] || "basic_info";
  const type =
    testConfig.requestType === "mixed"
      ? ["read", "write"][Math.floor(Math.random() * 2)]
      : testConfig.requestType;
  if (type === "write") {
    return `UPDATE ${table} SET value = 'bench_${Date.now()}' WHERE rowid = (SELECT rowid FROM ${table} LIMIT 1);`;
  }
  return `SELECT * FROM ${table} LIMIT 10;`;
}

function withTimeout(p: Promise<any>, ms: number): Promise<any> {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function startTest() {
  isTesting.value = true;
  stopRequested.value = false;
  startTime.value = performance.now();

  testStats.total = testConfig.concurrency * testConfig.repeat;
  testStats.completed = 0;
  testStats.success = 0;
  testStats.failed = 0;
  testStats.avgTime = 0;
  testStats.maxTime = 0;
  testStats.minTime = Infinity;
  testStats.qps = 0;
  resultRows.value = [];

  const allTimes: number[] = [];

  for (let r = 0; r < testConfig.repeat; r++) {
    if (stopRequested.value) break;
    const promises: Promise<void>[] = [];

    for (let c = 0; c < testConfig.concurrency; c++) {
      promises.push(
        new Promise<void>(async (resolve) => {
          if (stopRequested.value) {
            resolve();
            return;
          }
          const sql = generateSql();
          const t0 = performance.now();
          let ok = false;
          try {
            const res = await withTimeout(
              window.ipcRenderer.handlePromise("new-sql:execute", { sql }),
              testConfig.timeout
            );
            ok = !!res?.success;
          } catch {
            ok = false;
          }
          const cost = performance.now() - t0;
          allTimes.push(cost);
          if (ok) testStats.success++;
          else testStats.failed++;
          testStats.completed++;
          testStats.maxTime = Math.max(testStats.maxTime, cost);
          testStats.minTime = Math.min(testStats.minTime, cost);
          if (resultRows.value.length < 200) {
            resultRows.value.push({ type: testConfig.requestType, sql, time: cost, ok });
          }
          elapsedText.value = `${((performance.now() - startTime.value) / 1000).toFixed(1)}s`;
          resolve();
        })
      );
    }
    await Promise.all(promises);
  }

  const totalTime = performance.now() - startTime.value;
  testStats.avgTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length || 0;
  testStats.qps = (testStats.completed / totalTime) * 1000;
  if (!Number.isFinite(testStats.minTime)) testStats.minTime = 0;
  elapsedText.value = `${(totalTime / 1000).toFixed(1)}s`;
  isTesting.value = false;
}

function stopTest() {
  stopRequested.value = true;
}

function applyJournalMode(mode: string) {
  testConfig.journalMode = mode;
  emit("execute", `PRAGMA journal_mode=${mode};`);
}

function applyBusyTimeout() {
  emit("execute", `PRAGMA busy_timeout=${Number(testConfig.busyTimeout) || 5000};`);
}

function download(content: string, ext: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `concurrency_report_${Date.now()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function reportObj() {
  return {
    config: { ...testConfig },
    stats: { ...testStats, minTime: Number.isFinite(testStats.minTime) ? testStats.minTime : 0 },
    results: resultRows.value,
    finishedAt: new Date().toISOString(),
  };
}

function exportCsv() {
  const header = "type,sql,time_ms,ok";
  const rows = resultRows.value.map((r) => `${r.type},"${r.sql.replace(/"/g, '""')}",${r.time.toFixed(2)},${r.ok}`);
  download("\uFEFF" + [header, ...rows].join("\r\n"), "csv", "text/csv;charset=utf-8;");
}

function exportJson() {
  download(JSON.stringify(reportObj(), null, 2), "json", "application/json;charset=utf-8;");
}

function exportMd() {
  const s = reportObj().stats as any;
  const md = [
    "# 并发测试报告",
    "",
    `- 时间：${new Date().toLocaleString("zh-CN")}`,
    `- 并发：${testConfig.concurrency} × ${testConfig.repeat} 次`,
    `- 完成 ${s.completed} · 成功 ${s.success} · 失败 ${s.failed}`,
    `- 平均 ${s.avgTime.toFixed(2)}ms · 最大 ${s.maxTime.toFixed(2)}ms · 最小 ${s.minTime.toFixed(2)}ms · QPS ${s.qps.toFixed(2)}`,
  ].join("\n");
  download(md, "md", "text/markdown;charset=utf-8;");
}
</script>

<template>
  <div class="pnl">
    <header class="pnl-header">
      <span class="pnl-title">并发测试</span>
      <span class="pnl-sub">性能评估工具</span>
      <div class="pnl-actions">
        <button class="pb sm" :disabled="isTesting" @click="startTest">开始测试</button>
      </div>
    </header>

    <div class="pnl-body">
      <div class="dcard tinted">
        <p class="dtip" style="font-size: 12.5px; color: var(--text-secondary)">
          模拟多个用户同时访问数据库，观察并发性能与锁等待情况。仅用于测试库，会真实产生负载。
        </p>
      </div>

      <div class="cfg-row">
        <div class="cfg-item">
          <input v-model.number="testConfig.concurrency" type="number" min="1" max="1000" class="dinput cfg-num" />
          <span class="dlabel">并发数</span>
        </div>
        <div class="cfg-item">
          <input v-model.number="testConfig.timeout" type="number" min="100" class="dinput cfg-timeout" />
          <span class="dlabel">超时(ms)</span>
        </div>
      </div>

      <textarea
        v-model="testConfig.customSql"
        class="dcode"
        rows="3"
        :placeholder="`留空则按请求类型自动生成，例如：SELECT * FROM ${tables[0] || '订单记录'} WHERE 状态 = '待处理' LIMIT 100;`"
      />

      <div class="seg-row">
        <span class="dlabel">日志模式（journal_mode）</span>
        <button
          v-for="m in JOURNAL_MODES"
          :key="m"
          class="seg"
          :class="{ on: testConfig.journalMode === m }"
          @click="applyJournalMode(m)"
        >
          {{ m }}
        </button>
      </div>

      <div class="seg-row">
        <span class="dlabel">busy_timeout（毫秒，缓解 SQLITE_BUSY）</span>
        <input
          v-model.number="testConfig.busyTimeout"
          type="number"
          min="0"
          class="dinput busy-input"
          @change="applyBusyTimeout"
        />
      </div>

      <div class="seg-row">
        <span class="dlabel">请求类型</span>
        <button
          v-for="t in REQUEST_TYPES"
          :key="t.value"
          class="seg"
          :class="{ on: testConfig.requestType === t.value }"
          @click="testConfig.requestType = t.value"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="seg-row">
        <span class="dlabel">目标表</span>
        <select v-model="testConfig.tableName" class="dinput table-select">
          <option value="" disabled>请选择表</option>
          <option v-for="t in props.tables" :key="t" :value="t">{{ t }}</option>
        </select>
        <span class="dtip">结果将按表归类，便于查看并发表现</span>
      </div>

      <div class="dcard">
        <div class="dcard-title">测试进度</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
        </div>
        <p class="dtip">
          已完成 {{ testStats.completed }} / {{ testStats.total }} · {{ progressPercent.toFixed(0) }}% · 已用 {{ elapsedText }}
        </p>
      </div>

      <div class="dcard">
        <div class="dcard-title">性能统计</div>
        <div class="stats-grid">
          <div class="stat-cell">
            <span class="stat-label">平均响应</span>
            <span class="stat-value">{{ testStats.avgTime.toFixed(2) }}<i>ms</i></span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">最大响应</span>
            <span class="stat-value">{{ testStats.maxTime.toFixed(2) }}<i>ms</i></span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">最小响应</span>
            <span class="stat-value">{{ (Number.isFinite(testStats.minTime) ? testStats.minTime : 0).toFixed(2) }}<i>ms</i></span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">QPS</span>
            <span class="stat-value">{{ testStats.qps.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <div class="dcard">
        <div class="dcard-title">测试结果<span class="sub">目标表：{{ testConfig.tableName || "未选择" }}</span></div>
        <div class="dtable flat">
          <div class="dt-head">
            <span class="r-type">类型</span>
            <span class="r-sql">语句</span>
            <span class="r-time">耗时</span>
            <span class="r-ok">结果</span>
          </div>
          <div v-if="resultRows.length === 0" class="dt-empty">尚未运行测试</div>
          <template v-else>
            <div v-for="(r, i) in resultRows" :key="i" class="dt-row">
              <span class="r-type">{{ r.type }}</span>
              <span class="r-sql mono" :title="r.sql">{{ r.sql }}</span>
              <span class="r-time">{{ r.time.toFixed(1) }}ms</span>
              <span class="r-ok" :class="r.ok ? 'dt-ok' : 'dt-fail'">{{ r.ok ? "成功" : "失败" }}</span>
            </div>
          </template>
        </div>
      </div>

      <div class="exp-row">
        <span class="exp-label">报告导出</span>
        <button class="pb sm pb-blue-ghost" @click="exportCsv">导出 CSV</button>
        <button class="pb sm pb-blue-ghost" @click="exportJson">导出 JSON</button>
        <button class="pb sm pb-blue-ghost" @click="exportMd">导出 MD</button>
      </div>

      <p class="dtip">
        提示：SQLite 为库级锁（非表级），锁层级 SHARED→RESERVED→PENDING→EXCLUSIVE；WAL 模式下读者与单一写者可并发，写写之间靠 busy_timeout 排队。
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "./panel.scss" as *;

.cfg-row {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.cfg-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cfg-num {
  width: 90px;
}

.cfg-timeout {
  width: 80px;
}

.seg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.busy-input {
  width: 120px;
}

.table-select {
  width: 220px;
}

.progress-bar {
  height: 10px;
  background: var(--bg-hover);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-success));
  border-radius: 5px;
  transition: width 0.3s ease;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-cell {
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 12px 10px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);

  i {
    font-style: normal;
    font-size: 11px;
    color: var(--text-muted);
    margin-left: 2px;
  }
}

.dtable.flat {
  border-radius: 8px;
}

.r-type {
  flex: 0 0 60px;
}

.r-sql {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.mono {
    font-family: Consolas, "Courier New", monospace;
    color: var(--text-primary);
  }
}

.r-time {
  flex: 0 0 90px;
}

.r-ok {
  flex: 0 0 60px;

  &.dt-fail {
    color: var(--color-error);
  }
}
</style>
