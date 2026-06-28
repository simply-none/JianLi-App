<template>
  <div class="system-info-page">
    <div class="page-header">
      <div class="header-title">
        <h2>系统信息</h2>
        <p>实时监控系统运行状态，了解您的设备性能</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" v-if="!isMonitoring" @click="startMonitor">
          <LucideIcon name="Webcam" :size="16" />
          开始监控
        </el-button>
        <el-button v-if="isMonitoring" @click="stopMonitor">
          <LucideIcon name="WebcamOff" :size="16" />
          停止监控
        </el-button>
        <el-button @click="toggleExtended">
          <LucideIcon :name="showExtended ? 'ListChevronsDownUp' : 'ListChevronsUpDown'" :size="16" />
          {{ showExtended ? '收起全部' : '展示所有' }}
        </el-button>
      </div>
    </div>

    <div class="realtime-section">
      <h3 class="section-title">实时监控</h3>
      <div class="metric-cards">
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-title">
              <LucideIcon class="metric-icon cpu-icon" name="Cpu" :size="20" />
              <span class="metric-label">CPU 使用率</span>
            </div>
            <el-tag size="small" :type="isMonitoring ? 'success' : 'info'">
              {{ isMonitoring ? '监控中' : '未开始' }}
            </el-tag>
          </div>
          <div class="metric-value">{{ cpuUsage }}%</div>
          <el-progress :percentage="cpuUsage" :stroke-width="10" />
        </div>
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-title">
              <LucideIcon class="metric-icon memory-icon" name="HardDrive" :size="20" />
              <span class="metric-label">内存使用</span>
            </div>
            <el-tag size="small" type="info">{{ memoryPercent }}%</el-tag>
          </div>
          <div class="metric-value memory-value-text">
            {{ formatBytes(summary.memory?.used || 0) }}
            <span class="metric-unit">/ {{ formatBytes(summary.memory?.total || 0) }}</span>
          </div>
          <el-progress :percentage="memoryPercent" :stroke-width="10" status="success" />
        </div>
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-title">
              <LucideIcon class="metric-icon network-icon" name="Globe" :size="20" />
              <span class="metric-label">网络流量</span>
            </div>
          </div>
          <div class="network-stats">
            <div class="network-item">
              <span class="network-label down">↓</span>
              <span class="network-text">{{ networkRx }}/s</span>
            </div>
            <div class="network-item">
              <span class="network-label up">↑</span>
              <span class="network-text">{{ networkTx }}/s</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="info-sections">
      <div class="info-section">
        <h3 class="section-title">
          <LucideIcon name="MonitorCog" :size="16" />
          系统信息
        </h3>
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">操作系统</span>
            <span class="info-value">{{ summary.os?.distro }} {{ summary.os?.release }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">系统架构</span>
            <span class="info-value">{{ summary.os?.arch }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">主机名</span>
            <span class="info-value">{{ summary.os?.hostname }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">处理器</span>
            <span class="info-value">{{ summary.cpu?.brand }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">核心/线程</span>
            <span class="info-value">{{ summary.cpu?.physicalCores }} 核 / {{ summary.cpu?.cores }} 线程</span>
          </div>
          <div class="info-row">
            <span class="info-label">CPU 主频</span>
            <span class="info-value">{{ summary.cpu?.speed }} GHz (最大 {{ summary.cpu?.speedMax }} GHz)</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3 class="section-title">
          <LucideIcon name="HardDrive" :size="16" />
          内存信息
        </h3>
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">总内存</span>
            <span class="info-value">{{ formatBytes(summary.memory?.total) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">已使用</span>
            <span class="info-value">{{ formatBytes(summary.memory?.used) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">可用内存</span>
            <span class="info-value">{{ formatBytes(summary.memory?.free) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">交换空间</span>
            <span class="info-value">{{ formatBytes(summary.memory?.swaptotal) }}</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3 class="section-title">
          <LucideIcon name="Folders" :size="16" />
          磁盘信息
        </h3>
        <div class="card-grid">
          <div v-for="(disk, index) in summary.disks" :key="index" class="mini-card">
            <div class="mini-card-icon">
              <LucideIcon name="Folder" :size="20" />
            </div>
            <div class="mini-card-content">
              <div class="mini-card-title">{{ disk.name || disk.device }}</div>
              <div class="mini-card-subtitle">{{ formatBytes(disk.size) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="info-section" v-if="summary.graphics?.controllers?.length">
        <h3 class="section-title">
          <LucideIcon name="Server" :size="16" />
          显卡信息
        </h3>
        <div class="card-grid">
          <div v-for="(gpu, index) in summary.graphics.controllers" :key="index" class="mini-card">
            <div class="mini-card-icon gpu-icon">
              <LucideIcon name="Server" :size="20" />
            </div>
            <div class="mini-card-content">
              <div class="mini-card-title">{{ gpu.model }}</div>
              <div class="mini-card-subtitle">{{ gpu.vram }} MB 显存</div>
            </div>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3 class="section-title">
          <LucideIcon name="PlugZap" :size="16" />
          网络接口
        </h3>
        <div class="card-grid">
          <div v-for="(net, index) in summary.network" :key="index" class="mini-card">
            <div class="mini-card-icon network-card-icon">
              <LucideIcon name="Plug2" :size="20" />
            </div>
            <div class="mini-card-content">
              <div class="mini-card-title">{{ net.iface }}</div>
              <div class="mini-card-subtitle">{{ net.ip4 }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="showExtended" class="extended-section">
      <h3 class="section-title">
        <LucideIcon name="BookOpenText" :size="16" />
        更多系统信息
      </h3>
      
      <div class="extended-grid">
        <div v-if="extended.bios?.vendor" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="LaptopMinimal" :size="16" />
            <span>BIOS 信息</span>
          </div>
          <div class="extended-card-body">
            <div class="info-row">
              <span class="info-label">厂商</span>
              <span class="info-value">{{ extended.bios.vendor }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">版本</span>
              <span class="info-value">{{ extended.bios.version }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">发布日期</span>
              <span class="info-value">{{ extended.bios.releaseDate }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">序列号</span>
              <span class="info-value">{{ extended.bios.serial }}</span>
            </div>
          </div>
        </div>

        <div v-if="extended.baseboard?.manufacturer" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="TvMinimal" :size="16" />
            <span>主板信息</span>
          </div>
          <div class="extended-card-body">
            <div class="info-row">
              <span class="info-label">厂商</span>
              <span class="info-value">{{ extended.baseboard.manufacturer }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">型号</span>
              <span class="info-value">{{ extended.baseboard.model }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">版本</span>
              <span class="info-value">{{ extended.baseboard.version }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">序列号</span>
              <span class="info-value">{{ extended.baseboard.serial }}</span>
            </div>
          </div>
        </div>

        <div v-if="extended.battery?.length" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="Battery" :size="16" />
            <span>电池信息</span>
          </div>
          <div class="extended-card-body">
            <div v-for="(bat, idx) in extended.battery" :key="idx">
              <div class="info-row">
                <span class="info-label">型号</span>
                <span class="info-value">{{ bat.model }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">状态</span>
                <span class="info-value">{{ bat.status }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">电量</span>
                <span class="info-value">{{ bat.percent }}%</span>
              </div>
              <div class="info-row">
                <span class="info-label">健康度</span>
                <span class="info-value">{{ bat.health }}%</span>
              </div>
              <div class="info-row">
                <span class="info-label">容量</span>
                <span class="info-value">{{ formatBytes(bat.maxCapacity) }} / {{ formatBytes(bat.designCapacity) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="extended.audio?.length" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="Headset" :size="16" />
            <span>音频设备</span>
          </div>
          <div class="extended-card-body">
            <div v-for="(dev, idx) in extended.audio" :key="idx" class="device-item">
              <div class="device-icon">
                <LucideIcon name="Headset" :size="18" />
              </div>
              <div class="device-info">
                <div class="device-name">{{ dev.name }}</div>
                <div class="device-detail">{{ dev.type }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="extended.bluetooth?.length" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="Bluetooth" :size="16" />
            <span>蓝牙设备</span>
          </div>
          <div class="extended-card-body">
            <div v-for="(dev, idx) in extended.bluetooth" :key="idx" class="device-item">
              <div class="device-icon">
                <LucideIcon name="Bluetooth" :size="18" />
              </div>
              <div class="device-info">
                <div class="device-name">{{ dev.name }}</div>
                <div class="device-detail">{{ dev.address }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="extended.usb?.length" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="Usb" :size="16" />
            <span>USB 设备</span>
          </div>
          <div class="extended-card-body">
            <div v-for="(dev, idx) in extended.usb" :key="idx" class="device-item">
              <div class="device-icon">
                <LucideIcon name="Usb" :size="18" />
              </div>
              <div class="device-info">
                <div class="device-name">{{ dev.name }}</div>
                <div class="device-detail">{{ dev.vendor }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="extended.printer?.length" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="Printer" :size="16" />
            <span>打印机</span>
          </div>
          <div class="extended-card-body">
            <div v-for="(prt, idx) in extended.printer" :key="idx" class="device-item">
              <div class="device-icon">
                <LucideIcon name="Printer" :size="18" />
              </div>
              <div class="device-info">
                <div class="device-name">{{ prt.name }}</div>
                <div class="device-detail">{{ prt.status }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="Object.keys(extended.docker).length" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="Container" :size="16" />
            <span>Docker 信息</span>
          </div>
          <div class="extended-card-body">
            <div class="info-row">
              <span class="info-label">版本</span>
              <span class="info-value">{{ extended.docker.version }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">容器数</span>
              <span class="info-value">{{ extended.docker.containers }} (运行中: {{ extended.docker.containersRunning }})</span>
            </div>
            <div class="info-row">
              <span class="info-label">镜像数</span>
              <span class="info-value">{{ extended.docker.images }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">存储驱动</span>
              <span class="info-value">{{ extended.docker.storageDriver }}</span>
            </div>
          </div>
        </div>

        <div v-if="Object.keys(extended.versions).length" class="extended-card wide-card">
          <div class="extended-card-header">
            <LucideIcon name="GamepadDirectional" :size="16" />
            <span>软件版本</span>
          </div>
          <div class="extended-card-body">
            <div class="versions-grid">
              <div class="version-item">
                <span class="version-label">Node.js</span>
                <span class="version-value">{{ extended.versions.node }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">NPM</span>
                <span class="version-value">{{ extended.versions.npm }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">Git</span>
                <span class="version-value">{{ extended.versions.git }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">TypeScript</span>
                <span class="version-value">{{ extended.versions.tsc }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">Python</span>
                <span class="version-value">{{ extended.versions.python }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">Java</span>
                <span class="version-value">{{ extended.versions.java || '未安装' }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">Docker</span>
                <span class="version-value">{{ extended.versions.docker || '未安装' }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">V8</span>
                <span class="version-value">{{ extended.versions.v8 || '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="extended.users?.length" class="extended-card">
          <div class="extended-card-header">
            <LucideIcon name="User" :size="16" />
            <span>在线用户</span>
          </div>
          <div class="extended-card-body">
            <div v-for="(user, idx) in extended.users" :key="idx" class="device-item">
              <div class="device-icon">
                <LucideIcon name="User" :size="18" />
              </div>
              <div class="device-info">
                <div class="device-name">{{ user.user }}</div>
                <div class="device-detail">{{ user.tty }} - {{ user.time }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

const summary = ref<any>({
  os: {},
  cpu: {},
  memory: {},
  disks: [],
  graphics: { controllers: [], displays: [] },
  network: [],
});

const extended = ref<any>({
  bios: {},
  baseboard: {},
  battery: [],
  audio: [],
  bluetooth: [],
  usb: [],
  printer: [],
  docker: {},
  versions: {},
  users: [],
});

const showExtended = ref(false);
const isMonitoring = ref(false);
const cpuUsage = ref(0);
const networkRx = ref('0 B');
const networkTx = ref('0 B');

const memoryPercent = computed(() => {
  if (!summary.value.memory?.total) return 0;
  return Math.round((summary.value.memory.used / summary.value.memory.total) * 100);
});

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
  return (bytesPerSec / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

function getSummary() {
  window.ipcRenderer.send('system-info-static', { type: 'summary' });
}

function getExtendedInfo() {
  window.ipcRenderer.send('system-info-static', { type: 'extended' });
}

function toggleExtended() {
  showExtended.value = !showExtended.value;
  if (showExtended.value && !Object.keys(extended.value.bios).length) {
    getExtendedInfo();
  }
}

function startMonitor() {
  isMonitoring.value = true;
  window.ipcRenderer.send('system-info', { type: 'start' });
}

function stopMonitor() {
  isMonitoring.value = false;
  window.ipcRenderer.send('system-info', { type: 'stop' });
}

function handleSystemInfo(event: any, arg: any) {
  if (arg.type === 'system-data' && arg.data) {
    if (arg.data.cpuCurrentSpeed) {
      const avgSpeed = arg.data.cpuCurrentSpeed.avg || 0;
      const maxSpeed = summary.value.cpu?.speedMax || avgSpeed || 1;
      cpuUsage.value = Math.min(100, Math.round((avgSpeed / maxSpeed) * 100));
    }
    if (arg.data.networkStats && arg.data.networkStats.length > 0) {
      const stats = arg.data.networkStats[0];
      networkRx.value = formatSpeed(stats.rx_sec || 0);
      networkTx.value = formatSpeed(stats.tx_sec || 0);
    }
    if (arg.data.mem) {
      summary.value.memory = {
        total: arg.data.mem.total,
        used: arg.data.mem.used,
        free: arg.data.mem.free,
        swaptotal: arg.data.mem.swaptotal,
      };
    }
  }
}

function handleSummary(event: any, arg: any) {
  if (arg.type === 'summary' && arg.data) {
    summary.value = { ...summary.value, ...arg.data };
  } else if (arg.type === 'extended' && arg.data) {
    extended.value = { ...extended.value, ...arg.data };
  }
}

onMounted(() => {
  getSummary();
  window.ipcRenderer.on('system-info', handleSystemInfo);
  window.ipcRenderer.on('system-info-static', handleSummary);
});

onUnmounted(() => {
  stopMonitor();
  setTimeout(() => {
    window.ipcRenderer.removeAllListeners('system-info');
    window.ipcRenderer.removeAllListeners('system-info-static');
  }, 10);
});
</script>

<style scoped lang="scss">
.system-info-page {
  width: 100%;
  height: 100%;
  // background: var(--bg-base);
  display: flex;
  flex-direction: column;
  gap: 20px;
  // padding: 20px 24px;
  box-sizing: border-box;
  overflow: auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-title {
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }

    p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-muted);
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;

  .el-icon {
    color: var(--color-primary);
  }
}

.realtime-section {
  .metric-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-card);
    }

    .metric-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .metric-title {
        display: flex;
        align-items: center;
        gap: 10px;

        .metric-icon {
          font-size: 20px;

          &.cpu-icon {
            color: #f56c6c;
          }

          &.memory-icon {
            color: #67c23a;
          }

          &.network-icon {
            color: #409eff;
          }
        }

        .metric-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
        }
      }
    }

    .metric-value {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;

      &.memory-value-text {
        font-size: 24px;

        .metric-unit {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 400;
        }
      }
    }

    .network-stats {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 8px;

      .network-item {
        display: flex;
        align-items: center;
        gap: 8px;

        .network-label {
          font-size: 18px;
          font-weight: 700;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;

          &.down {
            background: rgba(64, 158, 255, 0.1);
            color: #409eff;
          }

          &.up {
            background: rgba(103, 194, 58, 0.1);
            color: #67c23a;
          }
        }

        .network-text {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }
      }
    }
  }
}

.info-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.info-section {
  .info-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 4px 16px;
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-subtle);

    &:last-child {
      border-bottom: none;
    }

    .info-label {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .info-value {
      font-size: 13px;
      color: var(--text-primary);
      font-weight: 500;
      text-align: right;
      max-width: 60%;
      word-break: break-all;
    }
  }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.mini-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
    transform: translateY(-2px);
  }

  .mini-card-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;

    &.gpu-icon {
      background: rgba(155, 89, 182, 0.1);
      color: #9b59b6;
    }

    &.network-card-icon {
      background: rgba(52, 152, 219, 0.1);
      color: #3498db;
    }
  }

  .mini-card-content {
    flex: 1;
    min-width: 0;

    .mini-card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mini-card-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
  }
}

.extended-section {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 20px;

  .extended-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
    margin-top: 12px;
  }

  .extended-card {
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    overflow: hidden;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-card);
    }

    &.wide-card {
      grid-column: span 2;
    }

    .extended-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-subtle);
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);

      .el-icon {
        color: var(--color-primary);
        font-size: 16px;
      }
    }

    .extended-card-body {
      padding: 4px 16px;

      .info-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-subtle);

        &:last-child {
          border-bottom: none;
        }

        .info-label {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .info-value {
          font-size: 13px;
          color: var(--text-primary);
          font-weight: 500;
          text-align: right;
          max-width: 60%;
          word-break: break-all;
        }
      }

      .device-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-subtle);

        &:last-child {
          border-bottom: none;
        }

        .device-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: var(--color-primary-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .device-info {
          flex: 1;
          min-width: 0;

          .device-name {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .device-detail {
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 2px;
          }
        }
      }

      .versions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        padding: 8px 0;

        .version-item {
          display: flex;
          flex-direction: column;
          gap: 4px;

          .version-label {
            font-size: 12px;
            color: var(--text-secondary);
          }

          .version-value {
            font-size: 13px;
            color: var(--text-primary);
            font-weight: 500;
          }
        }
      }
    }
  }
}
</style>