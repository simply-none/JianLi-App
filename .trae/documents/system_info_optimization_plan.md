# 系统信息页面优化计划

## 一、需求概述

优化系统信息页面的功能和排版布局，提升系统信息获取速度，使用主流网站样式。

## 二、现状分析

### 现有问题

1. **获取速度慢**：
   - `getStaticData()` 获取了所有静态数据（CPU、内存、磁盘、网络、BIOS 等全部信息）
   - 数据量过大，导致页面加载缓慢

2. **布局简陋**：
   - 使用 `el-form` 嵌套展示，不美观
   - 没有信息分类和层次结构
   - 实时数据和静态数据混在一起

3. **已有库**：
   - 项目已安装 `systeminformation@5.27.11`，功能强大且性能良好
   - 当前使用方式不够优化

## 三、优化方案

### 方案：使用 systeminformation 按需获取 + 卡片式布局

**核心思路**：
1. 静态数据改为按需获取关键信息（CPU、内存、系统、磁盘摘要）
2. 实时数据使用仪表盘/进度条可视化展示
3. 页面采用卡片式网格布局，分类展示
4. 支持主题切换

### 修改 1：优化 systemInfo worker - 按需获取静态数据

**文件**：`public/worker/systemInfo.cjs`

```javascript
// 新增：快速获取摘要信息
async function getSystemSummary() {
  try {
    // 并行获取关键信息，比 getStaticData 快很多
    const [os, cpu, mem, diskLayout, graphics, networkInterfaces] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.diskLayout(),
      si.graphics(),
      si.networkInterfaces(),
    ]);
    
    parentPort.postMessage({
      type: 'summary',
      data: {
        os: {
          platform: os.platform,
          distro: os.distro,
          release: os.release,
          arch: os.arch,
          hostname: os.hostname,
        },
        cpu: {
          brand: cpu.brand,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          speed: cpu.speed,
          speedMax: cpu.speedMax,
          manufacturer: cpu.manufacturer,
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          swaptotal: mem.swaptotal,
        },
        disks: diskLayout.map(d => ({
          device: d.device,
          type: d.type,
          name: d.name,
          size: d.size,
          vendor: d.vendor,
        })),
        graphics: {
          controllers: graphics.controllers?.map(g => ({
            model: g.model,
            vram: g.vram,
            vendor: g.vendor,
          })) || [],
          displays: graphics.displays?.map(d => ({
            model: d.model,
            resolution: `${d.resolutionx}x${d.resolutiony}`,
            refreshRate: d.refreshRate,
          })) || [],
        },
        network: networkInterfaces.filter(n => n.ip4 && n.type !== 'virtual').map(n => ({
          iface: n.iface,
          ip4: n.ip4,
          mac: n.mac,
          type: n.type,
        })),
      },
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取系统摘要失败:', error);
    parentPort.postMessage({
      type: 'summary',
      data: {},
      time: new Date().toISOString(),
    });
  }
}

// 修改消息处理
case 'summary':
  getSystemSummary();
  break;
```

### 修改 2：重写系统信息页面 - 卡片式布局

**文件**：`src/views/systemInfo/index.vue`（完全重写）

**页面结构**：
```
┌─────────────────────────────────────────────────────┐
│ 系统信息                       [开始监控] [停止监控]  │
│ 实时监控系统运行状态，了解您的设备性能                 │
├─────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│ │  CPU 使用率 │ │  内存使用  │ │  网络流量  │        │
│ │   [仪表盘]  │ │  [进度条]  │ │  [上下行]  │        │
│ └────────────┘ └────────────┘ └────────────┘        │
├─────────────────────────────────────────────────────┤
│ 系统信息                                             │
│ ┌──────────────────────────────────────────────┐     │
│ │ 操作系统    Windows 11 Pro                   │     │
│ │ 处理器      Intel Core i7-13700K @ 3.4GHz   │     │
│ │ 内存        32 GB DDR5                       │     │
│ └──────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────┤
│ 硬件信息                                             │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│ │  CPU 详情   │ │  内存详情  │ │  磁盘列表  │        │
│ └────────────┘ └────────────┘ └────────────┘        │
└─────────────────────────────────────────────────────┘
```

### 修改 3：创建系统信息卡片组件

**文件**：`src/views/systemInfo/InfoCard.vue`（新建）

通用信息卡片组件，用于展示各项系统信息。

### 修改 4：更新 systemInfo.vue

**文件**：`src/views/systemInfo/systemInfo.vue`

- 使用新的 summary 数据替代 getStaticData
- 重写页面布局为卡片式
- 添加 CPU、内存仪表盘
- 添加磁盘、网络信息卡片

## 四、具体实现

### 4.1 Worker 端修改

**文件**：`public/worker/systemInfo.cjs`

```javascript
// 新增 getSystemSummary 函数
// 新增 'summary' 消息类型处理
```

### 4.2 前端页面修改

**文件**：`src/views/systemInfo/systemInfo.vue`

```vue
<template>
  <div class="system-info-page">
    <div class="page-header">
      <div class="header-title">
        <h2>系统信息</h2>
        <p>实时监控系统运行状态，了解您的设备性能</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" v-if="!isMonitoring" @click="startMonitor">
          <el-icon><VideoPlay /></el-icon>
          开始监控
        </el-button>
        <el-button v-if="isMonitoring" @click="stopMonitor">
          <el-icon><VideoPause /></el-icon>
          停止监控
        </el-button>
      </div>
    </div>

    <div class="realtime-section">
      <h3 class="section-title">实时监控</h3>
      <div class="metric-cards">
        <div class="metric-card">
          <div class="metric-header">
            <el-icon class="metric-icon cpu-icon"><Cpu /></el-icon>
            <span class="metric-label">CPU 使用率</span>
          </div>
          <div class="metric-value">{{ cpuUsage }}%</div>
          <el-progress :percentage="cpuUsage" :stroke-width="8" />
        </div>
        <div class="metric-card">
          <div class="metric-header">
            <el-icon class="metric-icon memory-icon"><Coin /></el-icon>
            <span class="metric-label">内存使用</span>
          </div>
          <div class="metric-value">{{ memoryUsed }} / {{ memoryTotal }}</div>
          <el-progress :percentage="memoryPercent" :stroke-width="8" :color="'#409eff'" />
        </div>
        <div class="metric-card">
          <div class="metric-header">
            <el-icon class="metric-icon network-icon"><Connection /></el-icon>
            <span class="metric-label">网络流量</span>
          </div>
          <div class="metric-value network-value">
            <div class="network-item">
              <span class="network-label">↓</span>
              <span>{{ networkRx }}/s</span>
            </div>
            <div class="network-item">
              <span class="network-label">↑</span>
              <span>{{ networkTx }}/s</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="info-sections">
      <div class="info-section">
        <h3 class="section-title">系统信息</h3>
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
        </div>
      </div>

      <div class="info-section">
        <h3 class="section-title">内存信息</h3>
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">总内存</span>
            <span class="info-value">{{ formatBytes(summary.memory?.total) }}</span>
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
        <h3 class="section-title">磁盘信息</h3>
        <div class="disk-list">
          <div v-for="(disk, index) in summary.disks" :key="index" class="disk-card">
            <div class="disk-icon">
              <el-icon><Files /></el-icon>
            </div>
            <div class="disk-info">
              <div class="disk-name">{{ disk.name || disk.device }}</div>
              <div class="disk-size">{{ formatBytes(disk.size) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3 class="section-title">显卡信息</h3>
        <div class="gpu-list">
          <div v-for="(gpu, index) in summary.graphics?.controllers" :key="index" class="gpu-card">
            <div class="gpu-icon">
              <el-icon><MagicStick /></el-icon>
            </div>
            <div class="gpu-info">
              <div class="gpu-name">{{ gpu.model }}</div>
              <div class="gpu-memory">{{ gpu.vram }} MB</div>
            </div>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3 class="section-title">网络接口</h3>
        <div class="network-list">
          <div v-for="(net, index) in summary.network" :key="index" class="network-card">
            <div class="network-icon">
              <el-icon><Position /></el-icon>
            </div>
            <div class="network-info">
              <div class="network-name">{{ net.iface }}</div>
              <div class="network-ip">{{ net.ip4 }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

### 4.3 样式设计

使用 CSS 变量支持主题切换：
- `--bg-base` / `--bg-card` - 背景
- `--text-primary` / `--text-secondary` / `--text-muted` - 文字
- `--color-primary` - 主题色
- `--border-subtle` - 边框
- `--radius-card` - 圆角
- `--shadow-card` - 阴影

## 五、文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `public/worker/systemInfo.cjs` | 修改 | 新增 summary 快速获取接口 |
| `src/views/systemInfo/index.vue` | 修改 | 更新外层容器样式 |
| `src/views/systemInfo/systemInfo.vue` | 重写 | 卡片式布局、仪表盘、信息分类 |
| `src/views/systemInfo/form.vue` | 可选删除 | 不再使用嵌套表单 |

## 六、验证步骤

1. **性能测试**：
   - 进入系统信息页面
   - 静态数据加载时间应明显缩短

2. **实时监控测试**：
   - 点击开始监控
   - CPU、内存、网络数据应实时更新

3. **布局测试**：
   - 各项信息应按分类展示
   - 卡片布局整齐美观

4. **主题切换测试**：
   - 切换不同主题，页面样式应正确适配

5. **响应式测试**：
   - 调整窗口大小，布局应自适应
