<script setup lang="ts">
/**
 * 数据库管理工作台（按设计稿重构）
 *
 * 结构：顶栏（用法指南/刷新/新建表）+ 上手横幅 + 左侧表导航（数据表+高级组）
 *      + 主区分页（数据/表结构/高级SQL/可视化；高级组项替换整个主区）+ 底部状态条。
 * 高级面板沿用既有组件（emit execute → 共用 ResultPanel）。
 */
import { ref, reactive, computed, onMounted } from "vue";
import { BookOpen, RefreshCw, Plus, Lightbulb, Database } from "@lucide/vue";

import TableNav from "./components/TableNav.vue";
import DataBrowser from "./components/DataBrowser.vue";
import StructureView from "./components/StructureView.vue";
import UsageDrawer from "./components/UsageDrawer.vue";
import CreateTableDialog from "./components/CreateTableDialog.vue";
import QueryBuilder from "./components/QueryBuilder.vue";
import IndexManager from "./components/IndexManager.vue";
import ViewManager from "./components/ViewManager.vue";
import TriggerManager from "./components/TriggerManager.vue";
import TransactionManager from "./components/TransactionManager.vue";
import SqlExecutor from "./components/SqlExecutor.vue";
import ConcurrencyTester from "./components/ConcurrencyTester.vue";
import ResultPanel from "./components/ResultPanel.vue";
import VisualPipeline from "./visual/VisualPipeline.vue";
import { runRead } from "./visual/api";

type Tab = "data" | "structure" | "sql" | "visual";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "data", label: "数据" },
  { key: "structure", label: "表结构" },
  { key: "sql", label: "高级 SQL" },
  { key: "visual", label: "可视化" },
];

const tables = ref<string[]>([]);
const counts = reactive<Record<string, number | undefined>>({});
const tableFields = reactive<Record<string, Array<{ name: string; type: string }>>>({});
const selectedTable = ref("");
const activeNav = ref<string>("data");
const showBanner = ref(true);
const usageOpen = ref(false);
const createOpen = ref(false);

const resultData = ref<any[]>([]);
const explainData = ref<any[]>([]);
const executeTime = ref(0);
const errorMessage = ref("");
const resultPanelRef = ref<InstanceType<typeof ResultPanel>>();

const lastOp = ref("就绪");

const isAdvanced = computed(() => activeNav.value.startsWith("adv:"));

function isTabActive(tab: Tab): boolean {
  return !activeNav.value.startsWith("adv:") && activeNav.value === tab;
}

function selectTab(tab: Tab) {
  activeNav.value = tab;
}

function selectTable(name: string) {
  selectedTable.value = name;
  activeNav.value = "data";
}

function selectAdv(key: string) {
  activeNav.value = key;
  // SQL 控制台与「高级 SQL」同义：保持导航态独立，面板复用 SqlExecutor
}

function setOp(message: string, ok: boolean) {
  lastOp.value = `${message} · ${ok ? "成功" : "失败"}`;
}

async function loadTables() {
  const res = await window.ipcRenderer.handlePromise("new-sql:listTables", {});
  if (res.success && Array.isArray(res.data)) {
    tables.value = res.data;
    if (!selectedTable.value && tables.value.length > 0) selectedTable.value = tables.value[0];
    await Promise.all([loadCounts(), loadAllFields()]);
  }
}

async function loadAllFields() {
  await Promise.all(
    tables.value.map(async (t) => {
      const res = await window.ipcRenderer.handlePromise("new-sql:tableInfo", { tableName: t });
      tableFields[t] = res.success
        ? (res.data as any[]).map((item) => ({ name: item.name, type: item.type || "TEXT" }))
        : [];
    })
  );
}

function onTableDropped(name: string) {
  if (selectedTable.value === name) {
    selectedTable.value = tables.value.find((t) => t !== name) || "";
  }
  loadTables();
  setOp(`删除表 ${name}`, true);
}

async function loadCounts() {
  await Promise.all(
    tables.value.map(async (t) => {
      const res = await runRead(`SELECT COUNT(*) AS cnt FROM "${t.replace(/"/g, '""')}"`);
      counts[t] = res.success && Array.isArray(res.data) ? Number(res.data[0]?.cnt ?? 0) : undefined;
    })
  );
}

function refreshAll() {
  loadTables();
}

function onCountChanged(delta: number) {
  if (selectedTable.value && counts[selectedTable.value] != null) {
    counts[selectedTable.value] = Math.max(0, (counts[selectedTable.value] as number) + delta);
  }
}

function onTableCreated(name: string) {
  selectedTable.value = name;
  activeNav.value = "data";
  loadTables();
  setOp(`新建表 ${name}`, true);
}

/** 高级面板 / SQL 控制台共用的执行通道 */
async function executeSql(sql: string) {
  if (!sql.trim()) return;
  errorMessage.value = "";
  explainData.value = [];
  const startTime = performance.now();
  try {
    const result = await window.ipcRenderer.handlePromise("new-sql:execute", { sql });
    if (result.success) {
      resultData.value = result.data.rows || [];
      resultPanelRef.value?.addLog(`执行成功: ${sql.substring(0, 50)}${sql.length > 50 ? "..." : ""}`, "success");
      setOp(`执行 SQL`, true);
    } else {
      errorMessage.value = result.error;
      resultPanelRef.value?.addLog(`执行失败: ${result.error}`, "error");
      setOp(`执行 SQL`, false);
    }
  } catch (err) {
    errorMessage.value = (err as Error).message;
    resultPanelRef.value?.addLog(`执行异常: ${(err as Error).message}`, "error");
    setOp(`执行 SQL`, false);
  }
  executeTime.value = Math.round((performance.now() - startTime) * 10) / 10;
}

async function showExplain(sql: string) {
  if (!sql.trim()) return;
  errorMessage.value = "";
  resultData.value = [];
  const startTime = performance.now();
  try {
    const result = await window.ipcRenderer.handlePromise("new-sql:explain", { sql });
    if (result.success) {
      explainData.value = result.data;
    } else {
      errorMessage.value = result.error;
    }
  } catch (err) {
    errorMessage.value = (err as Error).message;
  }
  executeTime.value = Math.round((performance.now() - startTime) * 10) / 10;
}

onMounted(loadTables);
</script>

<template>
  <div class="db-workbench">
    <!-- 顶栏（设计稿 3:3：56px，标题 18 Bold + db.sqlite 徽标 + 右侧按钮组） -->
    <header class="wb-topbar">
      <div class="tb-left">
        <Database class="logo-icon" />
        <h1 class="wb-title">数据库管理</h1>
        <span class="db-badge">db.sqlite</span>
      </div>
      <div class="tb-right">
        <button class="ghost-btn" @click="usageOpen = true"><BookOpen class="btn-icon" />用法指南</button>
        <button class="ghost-btn" @click="refreshAll"><RefreshCw class="btn-icon" />刷新</button>
        <button class="primary-btn" @click="createOpen = true"><Plus class="btn-icon" />新建表</button>
      </div>
    </header>

    <!-- 主体（设计稿 3:4：左导航 260 + 主工作区，padding 16 / gap 16） -->
    <div class="wb-body">
      <TableNav
        :tables="tables"
        :counts="counts"
        :selectedTable="selectedTable"
        :activeNav="activeNav"
        @select-table="selectTable"
        @select-adv="selectAdv"
      />

      <section class="wb-main">
        <!-- 高级面板：替换整个主区（面板自带头部，见设计稿 3:346~3:457） -->
        <template v-if="isAdvanced">
          <div class="adv-panel">
            <div class="adv-panel-body">
              <IndexManager v-if="activeNav === 'adv:index'" :tables="tables" :tableFields="tableFields" @execute="executeSql" />
              <ViewManager v-else-if="activeNav === 'adv:view'" :tables="tables" @execute="executeSql" />
              <TriggerManager v-else-if="activeNav === 'adv:trigger'" :tables="tables" @execute="executeSql" />
              <TransactionManager v-else-if="activeNav === 'adv:transaction'" @execute="executeSql" />
              <ConcurrencyTester v-else-if="activeNav === 'adv:concurrency'" :tables="tables" @execute="executeSql" />
              <div v-else class="sql-console">
                <SqlExecutor :tables="tables" @execute="executeSql" @explain="showExplain" />
                <ResultPanel
                  ref="resultPanelRef"
                  :resultData="resultData"
                  :explainData="explainData"
                  :executeTime="executeTime"
                  :errorMessage="errorMessage"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- 分页主区（设计稿 3:30：横幅/页签/内容平铺，无大白卡包裹） -->
        <template v-else>
          <!-- 上手横幅（设计稿 3:96：仅分页主区顶部，高级面板不显示） -->
          <div v-if="showBanner" class="wb-banner">
            <Lightbulb class="banner-icon" />
            <span class="banner-text">
              上手三步走：① 在左侧选一张表 &nbsp;&nbsp;② 在右侧查看或修改数据 &nbsp;&nbsp;③ 需要时到「表结构」增删字段
            </span>
            <a class="banner-link" @click="showBanner = false">知道了</a>
          </div>

          <nav class="wb-tabs">
            <button
              v-for="tab in TABS"
              :key="tab.key"
              class="tab-item"
              :class="{ active: isTabActive(tab.key) }"
              @click="selectTab(tab.key)"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div class="tab-content">
            <DataBrowser
              v-if="activeNav === 'data' && selectedTable"
              :tableName="selectedTable"
              @op-done="setOp"
              @count-changed="onCountChanged"
            />
            <StructureView
              v-else-if="activeNav === 'structure'"
              :tableName="selectedTable"
              @op-done="setOp"
              @dropped="onTableDropped"
            />
            <VisualPipeline v-else-if="activeNav === 'visual'" />
            <div v-else-if="activeNav === 'sql'" class="sql-console">
              <QueryBuilder
                :tables="tables"
                :tableFields="tableFields"
                @execute="executeSql"
                @explain="showExplain"
              />
              <ResultPanel
                ref="resultPanelRef"
                :resultData="resultData"
                :explainData="explainData"
                :executeTime="executeTime"
                :errorMessage="errorMessage"
              />
            </div>
          </div>
        </template>
      </section>
    </div>

    <!-- 状态条 -->
    <footer class="wb-statusbar">
      <span class="status-left"><span class="ok-dot" />已连接 db.sqlite · 共 {{ tables.length }} 张表</span>
      <span class="status-right">{{ lastOp }}</span>
    </footer>

    <UsageDrawer :open="usageOpen" @close="usageOpen = false" />
    <CreateTableDialog :open="createOpen" @close="createOpen = false" @created="onTableCreated" />
  </div>
</template>

<style scoped lang="scss">
.db-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-base);
}

.wb-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-subtle);
}

.tb-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 22px;
  height: 22px;
  color: var(--color-primary);
}

.wb-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.db-badge {
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
}

.tb-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ghost-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.primary-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 10px var(--tag-bg-info, rgba(47, 107, 255, 0.3));

  &:hover {
    filter: brightness(1.08);
  }
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.wb-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  background: var(--color-primary-light);
  border-radius: 8px;
}

.banner-icon {
  width: 18px;
  height: 18px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.banner-link {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.wb-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
  padding: 16px;
}

/* 主工作区：无大白卡，横幅/页签/内容直接平铺（对齐设计稿 3:30） */
.wb-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wb-tabs {
  flex-shrink: 0;
  display: flex;
  gap: 24px;
  height: 44px;
  border-bottom: 1px solid var(--border-subtle);
}

.tab-item {
  position: relative;
  padding: 0 2px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;

  &:hover {
    color: var(--color-primary);
  }

  &.active {
    color: var(--color-primary);
    font-weight: 700;

    &::after {
      content: "";
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: -1px;
      width: 32px;
      height: 2px;
      border-radius: 1px;
      background: var(--color-primary);
    }
  }
}

.tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.adv-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.adv-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  > * {
    flex: 1;
    min-height: 0;
  }
}

.sql-console {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.wb-statusbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  padding: 0 20px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-secondary);
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ok-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
}

</style>
