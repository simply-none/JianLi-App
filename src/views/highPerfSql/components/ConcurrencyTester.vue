<template>
  <div class="concurrency-tester">
    <div class="content-area">
      <div class="section-card">
        <div class="section-title">并发请求测试</div>
      </div>

      <div class="section-card">
        <div class="section-title">测试配置</div>
        <div class="config-row">
          <div class="config-item">
            <span class="config-label">并发数:</span>
            <div class="concurrency-options">
              <button
                v-for="num in [10, 50, 100, 500]"
                :key="num"
                :class="['concurrency-btn', { active: testConfig.concurrency === num }]"
                @click="testConfig.concurrency = num"
              >
                {{ num }}
              </button>
              <el-input-number
                v-model="testConfig.concurrency"
                :min="1"
                :max="1000"
                class="custom-concurrency"
              />
            </div>
          </div>
        </div>

        <div class="config-row">
          <div class="config-item">
            <span class="config-label">请求类型:</span>
            <div class="type-options">
              <button
                v-for="type in requestTypes"
                :key="type.value"
                :class="['type-btn', { active: testConfig.requestType === type.value }]"
                @click="testConfig.requestType = type.value"
              >
                {{ type.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="config-row">
          <div class="config-item">
            <span class="config-label">执行次数:</span>
            <div class="repeat-options">
              <button
                v-for="num in [1, 10, 100]"
                :key="num"
                :class="['repeat-btn', { active: testConfig.repeat === num }]"
                @click="testConfig.repeat = num"
              >
                {{ num }}次
              </button>
            </div>
          </div>
        </div>

        <div class="config-row">
          <div class="config-item">
            <span class="config-label">表名:</span>
            <el-select
              v-model="testConfig.tableName"
              placeholder="请选择或输入表名"
              filterable
              allow-create
              class="table-select"
              default-first-option
            >
              <el-option
                v-for="table in props.tables"
                :key="table.name"
                :label="table.name"
                :value="table.name"
              />
            </el-select>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">测试进度</div>
        <div class="progress-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: progressPercent + '%' }"
            />
          </div>
          <div class="progress-info">
            <span>已完成: {{ testStats.completed }}/{{ testStats.total }} 请求</span>
            <span>成功: {{ testStats.success }}</span>
            <span>失败: {{ testStats.failed }}</span>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">性能统计</div>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">平均响应时间</span>
            <span class="stat-value">{{ testStats.avgTime.toFixed(2) }}ms</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">最大响应时间</span>
            <span class="stat-value">{{ testStats.maxTime.toFixed(2) }}ms</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">最小响应时间</span>
            <span class="stat-value">{{ testStats.minTime.toFixed(2) }}ms</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">QPS</span>
            <span class="stat-value">{{ testStats.qps.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-area">
      <div class="action-buttons">
        <el-button
          :disabled="isTesting"
          type="primary"
          @click="startTest"
        >
          开始测试
        </el-button>
        <el-button
          :disabled="!isTesting"
          type="danger"
          @click="stopTest"
        >
          停止测试
        </el-button>
        <el-button @click="exportReport">导出报告</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from "vue";

interface Table {
  name: string;
}

const props = defineProps<{
  tables: Table[];
}>();

const emit = defineEmits<{
  (e: "execute", sql: string): void;
}>();

const requestTypes = [
  { label: "查询", value: "query" },
  { label: "插入", value: "insert" },
  { label: "更新", value: "update" },
  { label: "删除", value: "delete" },
  { label: "混合", value: "mixed" },
];

const testConfig = reactive({
  concurrency: 10,
  requestType: "query",
  repeat: 1,
  tableName: "",
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

const isTesting = ref(false);
const stopRequested = ref(false);
const startTime = ref(0);

const progressPercent = computed(() => {
  if (testStats.total === 0) return 0;
  return (testStats.completed / testStats.total) * 100;
});

function generateSql(): string {
  const table = testConfig.tableName || "basic_info";

  switch (testConfig.requestType) {
    case "query":
      return `SELECT * FROM ${table} LIMIT 10`;
    case "insert":
      return `INSERT INTO ${table} (name, value, created_at) VALUES ('test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}', 'value_${Math.random()}', ${Date.now()})`;
    case "update":
      return `UPDATE ${table} SET value = 'updated_${Date.now()}' WHERE id = (SELECT id FROM ${table} ORDER BY RANDOM() LIMIT 1)`;
    case "delete":
      return `DELETE FROM ${table} WHERE id = (SELECT id FROM ${table} ORDER BY RANDOM() LIMIT 1)`;
    case "mixed":
      const types = ["query", "insert", "update", "delete"];
      const randomType = types[Math.floor(Math.random() * types.length)];
      return generateSqlForType(randomType, table);
    default:
      return `SELECT * FROM ${table} LIMIT 10`;
  }
}

function generateSqlForType(type: string, table: string): string {
  switch (type) {
    case "query":
      return `SELECT * FROM ${table} LIMIT 10`;
    case "insert":
      return `INSERT INTO ${table} (name, value, created_at) VALUES ('test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}', 'value_${Math.random()}', ${Date.now()})`;
    case "update":
      return `UPDATE ${table} SET value = 'updated_${Date.now()}' WHERE id = (SELECT id FROM ${table} ORDER BY RANDOM() LIMIT 1)`;
    case "delete":
      return `DELETE FROM ${table} WHERE id = (SELECT id FROM ${table} ORDER BY RANDOM() LIMIT 1)`;
    default:
      return `SELECT * FROM ${table} LIMIT 10`;
  }
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

  const allTimes: number[] = [];

  for (let r = 0; r < testConfig.repeat; r++) {
    if (stopRequested.value) break;

    const promises: Promise<void>[] = [];

    for (let c = 0; c < testConfig.concurrency; c++) {
      promises.push(new Promise<void>(async (resolve) => {
        if (stopRequested.value) {
          resolve();
          return;
        }

        const sql = generateSql();
        const reqStartTime = performance.now();

        try {
          await window.ipcRenderer.handlePromise("new-sql:execute", { sql }).then(res => {
            console.log(res, '执行结果');
            if (res.success) {
              testStats.success++;
            } else {
              testStats.failed++;
            }
          });
        } catch {
          testStats.failed++;
        }

        const reqTime = performance.now() - reqStartTime;
        allTimes.push(reqTime);

        testStats.completed++;
        testStats.maxTime = Math.max(testStats.maxTime, reqTime);
        testStats.minTime = Math.min(testStats.minTime, reqTime);

        resolve();
      }));
    }

    await Promise.all(promises);
  }

  const totalTime = performance.now() - startTime.value;
  testStats.avgTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length || 0;
  testStats.qps = (testStats.completed / totalTime) * 1000;

  isTesting.value = false;
}

function stopTest() {
  stopRequested.value = true;
}

function exportReport() {}
</script>

<style scoped lang="scss">
.concurrency-tester {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

.section-card {
  margin-bottom: 24px;
  background: var(--bg-base);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  padding: 20px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary-light);
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--color-primary-light);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: "";
    width: 8px;
    height: 8px;
    background: var(--color-primary);
    border-radius: 50%;
  }
}

.config-row {
  margin-bottom: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.concurrency-options {
  display: flex;
  gap: 8px;
  align-items: center;
}

.concurrency-btn {
  padding: 10px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  &.active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
}

.custom-concurrency {
  width: 120px;
}

.table-select {
  width: 100%;
  max-width: 300px;
}

.type-options {
  display: flex;
  gap: 8px;
}

.type-btn {
  padding: 10px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  &.active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
}

.repeat-options {
  display: flex;
  gap: 8px;
}

.repeat-btn {
  padding: 10px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  &.active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
}

.progress-container {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 16px;
  border: 1px solid var(--border-subtle);
}

.progress-bar {
  height: 10px;
  background: var(--border-subtle);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 14px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-success));
  border-radius: 5px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  gap: 24px;
  font-size: 13px;
  color: var(--text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat-card {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  border: 1px solid var(--border-subtle);
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
  }
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.bottom-area {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  justify-content: flex-start;
}
</style>
