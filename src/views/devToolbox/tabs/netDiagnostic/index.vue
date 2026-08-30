<template>
  <div class="net-diagnostic">
    <!-- 目标输入 -->
    <div class="target-bar">
      <el-input v-model="host" placeholder="输入域名或 IP，如 google.com / 8.8.8.8" class="host-input" @keyup.enter="runActive" />
      <el-select v-model="preset" placeholder="常用" style="width:160px;" @change="applyPreset">
        <el-option label="baidu.com" value="baidu.com" />
        <el-option label="github.com" value="github.com" />
        <el-option label="google.com" value="google.com" />
        <el-option label="8.8.8.8 (Google DNS)" value="8.8.8.8" />
        <el-option label="127.0.0.1 (本地)" value="127.0.0.1" />
        <el-option label="localhost" value="localhost" />
      </el-select>
    </div>

    <!-- 子 Tab -->
    <el-tabs v-model="activeSub" class="net-tabs" stretch>
      <el-tab-pane label="Ping" name="ping" />
      <el-tab-pane label="Traceroute" name="trace" />
      <el-tab-pane label="DNS 查询" name="dns" />
      <el-tab-pane label="端口检测" name="port" />
    </el-tabs>

    <!-- Ping -->
    <div v-show="activeSub === 'ping'" class="diag-panel">
      <div class="options-row">
        <span>次数:</span>
        <el-radio-group v-model="pingCount" size="small">
          <el-radio-button :value="2">2</el-radio-button>
          <el-radio-button :value="4">4</el-radio-button>
          <el-radio-button :value="8">8</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Play" :loading="running" @click="runPing" :disabled="!host">▶ 开始</el-button>
        <el-button v-if="running" :icon="Square" type="danger" @click="cancelCurrent">⏹ 停止</el-button>
        <el-button :icon="Trash2" @click="clearPing">清空</el-button>
      </div>
      <el-table v-if="pingPackets.length" :data="pingPackets" size="small" stripe height="200">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="bytes" label="字节" width="70" />
        <el-table-column prop="ttl" label="TTL" width="70" />
        <el-table-column prop="time" label="时间(ms)" width="90">
          <template #default="{ row }">
            <span v-if="row.time !== undefined" :class="{ 'high-latency': row.time > 150 }">{{ row.time }} ms</span>
            <span v-else class="timeout">超时</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="stats-bar" v-if="pingStats.sent">
        发送 {{ pingStats.sent }} / 接收 {{ pingStats.received }} / 丢包 {{ pingStats.loss }}%
        <span v-if="pingStats.avg">最短 {{ pingStats.min }}ms · 最长 {{ pingStats.max }}ms · 平均 {{ pingStats.avg }}ms</span>
      </div>
      <TerminalOutput :raw="pingRaw" />
    </div>

    <!-- Traceroute -->
    <div v-show="activeSub === 'trace'" class="diag-panel">
      <div class="options-row">
        <span>最大跳数:</span>
        <el-input-number v-model="traceHop" :min="3" :max="30" size="small" />
        <el-button type="primary" :icon="Play" :loading="running" @click="runTraceroute" :disabled="!host">▶ 开始</el-button>
        <el-button v-if="running" :icon="Square" type="danger" @click="cancelCurrent">⏹ 停止</el-button>
        <el-button :icon="Trash2" @click="traceRaw = ''">清空</el-button>
      </div>
      <TerminalOutput :raw="traceRaw" />
    </div>

    <!-- DNS 查询 -->
    <div v-show="activeSub === 'dns'" class="diag-panel">
      <div class="options-row">
        <el-button type="primary" :icon="Play" :loading="running" @click="runDns" :disabled="!host">▶ 查询</el-button>
        <el-button :icon="Trash2" @click="dnsResults = {}">清空</el-button>
      </div>
      <div v-if="Object.keys(dnsResults).length" class="dns-grid">
        <div v-for="(val, key) in dnsResults" :key="key" class="dns-block">
          <div class="dns-type">{{ key }}</div>
          <pre class="dns-value">{{ formatDns(val) }}</pre>
        </div>
      </div>
      <el-empty v-else description="等待查询..." />
    </div>

    <!-- 端口检测 -->
    <div v-show="activeSub === 'port'" class="diag-panel">
      <div class="options-row">
        <el-input v-model="portInput" size="small" placeholder="如 80,443,3000-4000,8080" style="width:320px;" />
        <el-button size="small" @click="useCommon">常用端口</el-button>
        <el-button type="primary" :icon="Play" :loading="running" @click="runPortCheck" :disabled="!host || !portInput">▶ 扫描</el-button>
      </div>
      <el-progress v-if="running || portResults.length" :percentage="Math.round((portDone / portTotal) * 100)" :show-text="true" style="margin:6px 0;" />
      <el-table v-if="portResults.length" :data="portResults" size="small" stripe height="260">
        <el-table-column prop="port" label="端口" width="80" />
        <el-table-column prop="service" label="常见服务" width="110">
          <template #default="{ row }">
            <span class="service-tag">{{ row.service || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="portStatusType(row.status)" size="small" effect="dark">{{ portStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="耗时(ms)" width="100" />
      </el-table>
      <el-empty v-else description="输入端口后点击扫描" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 网络诊断 - Tab4
 * 走主进程 sys:ping / sys:traceroute / sys:dns-lookup / sys:port-check IPC
 */
import { ref, onUnmounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Play, Square, Trash2 } from '@lucide/vue';
import { PORT_SERVICES } from '../../shared/types';
import TerminalOutput from './components/TerminalOutput.vue';

const host = ref('');
const preset = ref('');
const activeSub = ref<'ping' | 'trace' | 'dns' | 'port'>('ping');
const running = ref(false);
const currentTaskId = ref('');

function applyPreset(v: string) { host.value = v; }

// ============== Ping ==============
const pingCount = ref(4);
const pingPackets = ref<{ bytes?: number; ttl?: number; time?: number }[]>([]);
const pingRaw = ref('');
const pingStats = ref({ sent: 0, received: 0, loss: 0, min: 0, max: 0, avg: 0 });

function parsePingPackets(raw: string) {
  const packets: any[] = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    const m = line.match(/Reply from\s+[\d.]+\s*:\s*bytes=(\d+)\s*Time[=<](\d+)\s*ms\s*TTL=(\d+)/i);
    if (m) packets.push({ bytes: +m[1], time: +m[2], ttl: +m[3] });
  }
  // Windows ping 汇总
  const mRaw = raw.match(/(\d+)\s+sent[,\s]+(\d+)\s+received[,\s]+([\d.]+)%\s+loss/);
  if (mRaw) {
    const times = packets.map(p => p.time).filter((x): x is number => x !== undefined);
    pingStats.value = {
      sent: +mRaw[1], received: +mRaw[2], loss: +mRaw[3],
      min: times.length ? Math.min(...times) : 0,
      max: times.length ? Math.max(...times) : 0,
      avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    };
  }
  pingPackets.value = packets;
}

async function runPing() {
  pingPackets.value = []; pingRaw.value = '';
  running.value = true;
  currentTaskId.value = crypto.randomUUID();
  // 流式监听
  const onData = (_e: any, payload: any) => {
    if (payload.taskId !== currentTaskId.value) return;
    pingRaw.value += payload.data;
  };
  (window as any).ipcRenderer.on('sys:ping-data', onData);
  try {
    const r = await (window as any).ipcRenderer.invoke('sys:ping', host.value, pingCount.value, currentTaskId.value);
    pingRaw.value = r.raw;
    parsePingPackets(r.raw);
  } finally {
    (window as any).ipcRenderer.removeListener('sys:ping-data', onData);
    running.value = false;
  }
}

function clearPing() { pingPackets.value = []; pingRaw.value = ''; pingStats.value = { sent: 0, received: 0, loss: 0, min: 0, max: 0, avg: 0 }; }

// ============== Traceroute ==============
const traceHop = ref(10);
const traceRaw = ref('');

async function runTraceroute() {
  traceRaw.value = '';
  running.value = true;
  currentTaskId.value = crypto.randomUUID();
  const onData = (_e: any, payload: any) => {
    if (payload.taskId !== currentTaskId.value) return;
    traceRaw.value += payload.data;
  };
  (window as any).ipcRenderer.on('sys:traceroute-data', onData);
  try {
    const r = await (window as any).ipcRenderer.invoke('sys:traceroute', host.value, traceHop.value, currentTaskId.value);
    traceRaw.value = r.raw;
  } finally {
    (window as any).ipcRenderer.removeListener('sys:traceroute-data', onData);
    running.value = false;
  }
}

// ============== DNS ==============
const dnsResults = ref<Record<string, any>>({});

async function runDns() {
  running.value = true;
  try {
    const r = await (window as any).ipcRenderer.invoke('sys:dns-lookup', host.value);
    if (r.ok) {
      dnsResults.value = r.results;
    } else {
      ElMessage.error('DNS 查询失败: ' + (r.error || '未知'));
    }
  } finally { running.value = false; }
}

function formatDns(val: any): string {
  if (Array.isArray(val)) {
    if (val.length && typeof val[0] === 'object') {
      return JSON.stringify(val, null, 2);
    }
    return val.join('\n');
  }
  if (val && typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

// ============== Port Scan ==============
const portInput = ref('80,443,8080,3000,3306,6379,8888');
const portResults = ref<{ port: number; status: string; duration: number; service?: string }[]>([]);
const portTotal = ref(0);
const portDone = ref(0);

function useCommon() {
  portInput.value = '21,22,23,25,53,80,110,143,443,3306,3389,5432,6379,8080,8443,27017';
}

function parsePortList(): number[] {
  const arr: number[] = [];
  const parts = portInput.value.split(',').map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (p.includes('-')) {
      const [a, b] = p.split('-').map(Number);
      if (!isNaN(a) && !isNaN(b) && a < b) {
        for (let i = a; i <= b; i++) arr.push(i);
      }
    } else {
      const n = Number(p);
      if (!isNaN(n)) arr.push(n);
    }
  }
  return Array.from(new Set(arr)).filter(n => n >= 1 && n <= 65535).sort((a, b) => a - b);
}

async function runPortCheck() {
  const ports = parsePortList();
  if (!ports.length) { ElMessage.warning('请输入有效端口'); return; }
  running.value = true; portDone.value = 0; portTotal.value = ports.length;
  portResults.value = [];
  try {
    const r = await (window as any).ipcRenderer.invoke('sys:port-check', host.value, ports, 3000, 50);
    portResults.value = (r.results || []).map((p: any) => ({
      ...p, service: PORT_SERVICES[p.port],
    }));
    portDone.value = portTotal.value;
  } finally { running.value = false; }
}

function portStatusType(s: string): string {
  return s === 'open' ? 'success' : s === 'closed' ? 'danger' : 'warning';
}
function portStatusLabel(s: string): string {
  return s === 'open' ? '开放' : s === 'closed' ? '关闭' : '过滤';
}

// ============== 取消 ==============
async function cancelCurrent() {
  if (!currentTaskId.value) return;
  await (window as any).ipcRenderer.invoke('sys:cancel-task', currentTaskId.value);
  running.value = false;
}

function runActive() {
  if (activeSub.value === 'ping') runPing();
  else if (activeSub.value === 'trace') runTraceroute();
  else if (activeSub.value === 'dns') runDns();
  else runPortCheck();
}

onUnmounted(() => { cancelCurrent(); });
</script>

<style lang="scss" scoped>
.net-diagnostic { display: flex; flex-direction: column; gap: 12px; }
.target-bar { display: flex; gap: 10px; align-items: center; }
.host-input { flex: 1; }
.net-tabs { flex-shrink: 0; }

.diag-panel { display: flex; flex-direction: column; gap: 10px; }
.options-row {
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  padding: 10px 14px; background: var(--el-fill-color-light); border-radius: 8px;
}

.stats-bar {
  font-size: 13px; font-family: Consolas, monospace;
  padding: 6px 12px; background: var(--el-fill-color-lighter); border-radius: 6px;
  display: flex; gap: 12px; color: var(--el-text-color-regular);
}
.high-latency { color: #e6a23c; }
.timeout { color: #f56c6c; }

.dns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.dns-block { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow: hidden; }
.dns-type { background: var(--el-color-primary-light-9); padding: 6px 12px; font-weight: 600; font-size: 13px; color: var(--el-color-primary); }
.dns-value { margin: 0; padding: 10px 12px; font-size: 12px; font-family: Consolas, monospace; white-space: pre-wrap; word-break: break-all; max-height: 160px; overflow: auto; }

.service-tag {
  font-family: Consolas, monospace; font-size: 12px;
  padding: 1px 6px; background: var(--el-fill-color-lighter); border-radius: 3px;
}
</style>
