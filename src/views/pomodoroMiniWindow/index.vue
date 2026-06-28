<template>
  <div class="pomodoro-mini-window" :class="statusClass">
    <div class="mouse-controls">
      <div class="mouse-left" @mousemove="enableMouseClickThroughFn"></div>
      <div class="mouse-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>

    <div class="content-area" @dblclick="cycleLayout">
      <component
        :is="currentLayoutComponent"
        :status="currentStatus"
        :countdown="nextDiffTime"
        :progress="progressPercentValue"
        :status-label="statusLabel"
        :status-subtitle="statusSubtitle"
        @cycle-theme="cycleTheme"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, markRaw } from 'vue';
import moment from 'moment';
import LayoutDefault from './layouts/LayoutDefault.vue';
import LayoutSimple from './layouts/LayoutSimple.vue';
import LayoutCircle from './layouts/LayoutCircle.vue';
import LayoutCompact from './layouts/LayoutCompact.vue';
import LayoutClassic from './layouts/LayoutClassic.vue';
import LayoutFlip from './layouts/LayoutFlip.vue';

const curStatusC = ref<any>({})
const nextTime = ref()
const nextDiffTime = ref('00:00:00')
const sysData = ref<any>({})
const progressPercentValue = ref(0)
const currentLayout = ref('default')

const themes = [
  'coral', 'mint', 'sky', 'lavender', 'sakura',
  'amber', 'white', 'dark', 'gray', 'aurora'
]

const layouts = ['default', 'simple', 'circle', 'compact', 'classic', 'flip']

const layoutComponents: Record<string, any> = {
  default: markRaw(LayoutDefault),
  simple: markRaw(LayoutSimple),
  circle: markRaw(LayoutCircle),
  compact: markRaw(LayoutCompact),
  classic: markRaw(LayoutClassic),
  flip: markRaw(LayoutFlip),
}

const currentLayoutComponent = computed(() => {
  return layoutComponents[currentLayout.value] || layoutComponents.default
})

const currentStatus = computed(() => {
  return curStatusC.value?.value || 'work'
})

const statusClass = computed(() => {
  const status = curStatusC.value?.value;
  return status === 'work' ? 'status-work' : 'status-rest';
});

const statusLabel = computed(() => {
  const status = curStatusC.value?.value;
  return status === 'work' ? '工作中' : '休息中';
});

const statusSubtitle = computed(() => {
  const status = curStatusC.value?.value;
  return status === 'work' ? '距离休息' : '距离工作';
});

const cycleTheme = () => {
  const currentSkin = document.documentElement.getAttribute('data-skin') || 'white'
  const idx = themes.indexOf(currentSkin)
  const nextTheme = themes[(idx + 1) % themes.length]

  applyTheme(nextTheme)
  saveConfig('skin', nextTheme)
}

const cycleLayout = () => {
  const idx = layouts.indexOf(currentLayout.value)
  currentLayout.value = layouts[(idx + 1) % layouts.length]
  saveConfig('layout', currentLayout.value)
}

const applyTheme = (theme: string) => {
  if (theme === 'white') {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', theme)
  }
}

const saveConfig = (key: string, value: string) => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', 'window-mode:pomodoro')
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {})
    config[key] = value
    window.ipcRenderer.sendSync('set-store', 'window-mode:pomodoro', JSON.stringify(config))
    window.ipcRenderer.send('sync-data-to-other-window', {
      pomodoroMiniWindowConfig: { ...config },
    })
  } catch (e) {
    console.log('保存配置失败:', e)
  }
}

const loadConfig = () => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', 'window-mode:pomodoro')
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {})
    if (config.skin) {
      applyTheme(config.skin)
    }
    if (config.layout) {
      currentLayout.value = config.layout
    }
  } catch (e) {
    console.log('加载配置失败:', e)
  }
}

window.ipcRenderer.on('sync-data-to-other-window', (event: any, arg: any) => {
  if (Object.prototype.toString.call(arg) === '[object Object]') {
    Object.assign(sysData.value, arg || {})
    sysData.value.globalFont && document.documentElement.style.setProperty('--jianli-global-font', sysData.value.globalFont);
    sysData.value.globalFontEN && document.documentElement.style.setProperty('--jianli-global-font-EN', sysData.value.globalFontEN);

    if (arg.pomodoroMiniWindowConfig) {
      if (arg.pomodoroMiniWindowConfig.skin) {
        applyTheme(arg.pomodoroMiniWindowConfig.skin)
      }
      if (arg.pomodoroMiniWindowConfig.layout) {
        currentLayout.value = arg.pomodoroMiniWindowConfig.layout
      }
    }

    if (arg.curStatus) {
      curStatusC.value = arg.curStatus;

      if (arg.curStatus.value === 'work') {
        nextTime.value = moment(arg.startWorkTime + arg.workTimeGapUnit * arg.workTimeGap).format('YYYY-MM-DD HH:mm:ss');
      } else {
        nextTime.value = moment(arg.closeWorkTime + arg.restTimeGapUnit * arg.restTimeGap).format('YYYY-MM-DD HH:mm:ss');
      }

      const status = arg.curStatus?.value;
      if (status && arg) {
        let startTime, duration;

        if (status === 'work') {
          startTime = arg.startWorkTime;
          duration = arg.workTimeGapUnit * arg.workTimeGap;
        } else {
          startTime = arg.closeWorkTime;
          duration = arg.restTimeGapUnit * arg.restTimeGap;
        }

        if (startTime && duration && duration > 0) {
          const elapsed = moment().valueOf() - startTime;
          const progress = 100 - (elapsed / duration) * 100;
          progressPercentValue.value = Math.max(0, Math.min(100, progress));
        }
      }

      countDown();
    }
  }
});

let timer: any = null;

function countDown() {
  if (timer) {
    clearInterval(timer);
  }

  timer = setInterval(() => {
    if (!nextTime.value) {
      nextDiffTime.value = '等待中...';
      progressPercentValue.value = 0;
      return;
    }

    const now = moment();
    const next = moment(nextTime.value);
    const diff = next.diff(now);

    if (diff < 0) {
      nextDiffTime.value = '等待中...';
      progressPercentValue.value = 0;
      return;
    }

    const diffTime = moment.duration(diff);
    const diffHours = diffTime.hours().toString().padStart(2, '0');
    const diffMinutes = diffTime.minutes().toString().padStart(2, '0');
    const diffSeconds = diffTime.seconds().toString().padStart(2, '0');

    nextDiffTime.value = `${diffHours}:${diffMinutes}:${diffSeconds}`;

    const status = curStatusC.value?.value;
    const data = sysData.value;

    if (data && status) {
      let startTime, duration;

      if (status === 'work') {
        startTime = (data as any).startWorkTime;
        duration = (data as any).workTimeGapUnit * (data as any).workTimeGap;
      } else {
        startTime = (data as any).closeWorkTime;
        duration = (data as any).restTimeGapUnit * (data as any).restTimeGap;
      }

      if (startTime && duration && duration > 0) {
        const elapsed = now.valueOf() - startTime;
        const progress = 100 - (elapsed / duration) * 100;
        progressPercentValue.value = Math.max(0, Math.min(100, progress));
      }
    }
  }, 1000);
}

const enableMouseClickThroughFn = () => {
  window.ipcRenderer.send('enable-mouse-click-through', 'pomodoro');
}

const disableMouseClickThroughFn = () => {
  window.ipcRenderer.send('disable-mouse-click-through', 'pomodoro');
}

onMounted(() => {
  loadConfig()
  // 主动获取番茄钟数据
  fetchPomodoroData()
})

async function fetchPomodoroData() {
  try {
    // 使用 get-store-all 获取 base-info 表的所有数据
    const data = await window.ipcRenderer.invoke('get-store-all', 'base-info')
    
    if (data && typeof data === 'object') {
      // 处理数据并更新状态
      handlePomodoroData(data)
    }
  } catch (e) {
    console.log('获取番茄钟数据失败:', e)
  }
}

function handlePomodoroData(data: any) {
  // 设置当前状态
  curStatusC.value = { value: data.curStatus?.value || 'work' }
  
  // 计算下一个状态切换时间
  if (data.curStatus?.value === 'work') {
    nextTime.value = moment(data.startWorkTime + data.workTimeGapUnit * data.workTimeGap).format('YYYY-MM-DD HH:mm:ss')
  } else {
    nextTime.value = moment(data.closeWorkTime + data.restTimeGapUnit * data.restTimeGap).format('YYYY-MM-DD HH:mm:ss')
  }
  
  // 计算进度
  if (data.curStatus?.value === 'work') {
    const startTime = data.startWorkTime
    const duration = data.workTimeGapUnit * data.workTimeGap
    if (startTime && duration && duration > 0) {
      const elapsed = moment().valueOf() - startTime
      const progress = 100 - (elapsed / duration) * 100
      progressPercentValue.value = Math.max(0, Math.min(100, progress))
    }
  } else {
    const startTime = data.closeWorkTime
    const duration = data.restTimeGapUnit * data.restTimeGap
    if (startTime && duration && duration > 0) {
      const elapsed = moment().valueOf() - startTime
      const progress = 100 - (elapsed / duration) * 100
      progressPercentValue.value = Math.max(0, Math.min(100, progress))
    }
  }
  
  // 同步到 sysData
  sysData.value = data
  
  // 启动倒计时
  countDown()
}
</script>

<style lang="scss">
:root {
  --jianli-global-font: "";
  --jianli-global-font-EN: "";
}

html, body {
  font-family: var(--jianli-global-font-EN), var(--jianli-global-font);
}

/* ==================== 10套独立皮肤 ==================== */

/* 默认皮肤（白色透明） */
:root,
[data-skin="white"] {
  --skin-bg: rgba(255, 255, 255, 0.95);
  --skin-border: rgba(99, 102, 241, 0.25);
  --skin-text-primary: #4338ca;
  --skin-text-secondary: #6366f1;
  --skin-dot: #6366f1;
  --skin-dot-glow: rgba(99, 102, 241, 0.6);
  --skin-progress-bg: rgba(99, 102, 241, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #6366f1, #818cf8);
  --skin-circle-ring: #6366f1;
  --skin-btn-bg: rgba(99, 102, 241, 0.12);
  --skin-btn-hover: rgba(99, 102, 241, 0.22);
}

/* 珊瑚橙 */
[data-skin="coral"] {
  --skin-bg: rgba(255, 230, 230, 0.92);
  --skin-border: rgba(220, 38, 38, 0.25);
  --skin-text-primary: #DC2626;
  --skin-text-secondary: #991B1B;
  --skin-dot: #EF4444;
  --skin-dot-glow: rgba(239, 68, 68, 0.6);
  --skin-progress-bg: rgba(220, 38, 38, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #EF4444, #F87171);
  --skin-circle-ring: #EF4444;
  --skin-btn-bg: rgba(239, 68, 68, 0.12);
  --skin-btn-hover: rgba(239, 68, 68, 0.22);
}

/* 薄荷绿 */
[data-skin="mint"] {
  --skin-bg: rgba(209, 250, 240, 0.92);
  --skin-border: rgba(5, 150, 105, 0.25);
  --skin-text-primary: #059669;
  --skin-text-secondary: #047857;
  --skin-dot: #10B981;
  --skin-dot-glow: rgba(16, 185, 129, 0.6);
  --skin-progress-bg: rgba(5, 150, 105, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #10B981, #34D399);
  --skin-circle-ring: #10B981;
  --skin-btn-bg: rgba(16, 185, 129, 0.12);
  --skin-btn-hover: rgba(16, 185, 129, 0.22);
}

/* 星空蓝 */
[data-skin="sky"] {
  --skin-bg: rgba(219, 234, 254, 0.92);
  --skin-border: rgba(37, 99, 235, 0.25);
  --skin-text-primary: #1D4ED8;
  --skin-text-secondary: #2563EB;
  --skin-dot: #3B82F6;
  --skin-dot-glow: rgba(59, 130, 246, 0.6);
  --skin-progress-bg: rgba(37, 99, 235, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #3B82F6, #60A5FA);
  --skin-circle-ring: #3B82F6;
  --skin-btn-bg: rgba(59, 130, 246, 0.12);
  --skin-btn-hover: rgba(59, 130, 246, 0.22);
}

/* 薰衣草 */
[data-skin="lavender"] {
  --skin-bg: rgba(237, 233, 254, 0.92);
  --skin-border: rgba(124, 58, 237, 0.25);
  --skin-text-primary: #6D28D9;
  --skin-text-secondary: #7C3AED;
  --skin-dot: #8B5CF6;
  --skin-dot-glow: rgba(139, 92, 246, 0.6);
  --skin-progress-bg: rgba(124, 58, 237, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #8B5CF6, #A78BFA);
  --skin-circle-ring: #8B5CF6;
  --skin-btn-bg: rgba(139, 92, 246, 0.12);
  --skin-btn-hover: rgba(139, 92, 246, 0.22);
}

/* 樱花粉 */
[data-skin="sakura"] {
  --skin-bg: rgba(252, 231, 243, 0.92);
  --skin-border: rgba(219, 39, 119, 0.25);
  --skin-text-primary: #BE185D;
  --skin-text-secondary: #DB2777;
  --skin-dot: #EC4899;
  --skin-dot-glow: rgba(236, 72, 153, 0.6);
  --skin-progress-bg: rgba(219, 39, 119, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #EC4899, #F472B6);
  --skin-circle-ring: #EC4899;
  --skin-btn-bg: rgba(236, 72, 153, 0.12);
  --skin-btn-hover: rgba(236, 72, 153, 0.22);
}

/* 琥珀金 */
[data-skin="amber"] {
  --skin-bg: rgba(254, 243, 199, 0.92);
  --skin-border: rgba(217, 119, 6, 0.25);
  --skin-text-primary: #B45309;
  --skin-text-secondary: #D97706;
  --skin-dot: #F59E0B;
  --skin-dot-glow: rgba(245, 158, 11, 0.6);
  --skin-progress-bg: rgba(217, 119, 6, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #F59E0B, #FBBF24);
  --skin-circle-ring: #F59E0B;
  --skin-btn-bg: rgba(245, 158, 11, 0.12);
  --skin-btn-hover: rgba(245, 158, 11, 0.22);
}

/* 暗夜黑 */
[data-skin="dark"] {
  --skin-bg: rgba(31, 41, 55, 0.95);
  --skin-border: rgba(255, 255, 255, 0.1);
  --skin-text-primary: #F3F4F6;
  --skin-text-secondary: #D1D5DB;
  --skin-dot: #60A5FA;
  --skin-dot-glow: rgba(96, 165, 250, 0.6);
  --skin-progress-bg: rgba(255, 255, 255, 0.1);
  --skin-progress-fill: linear-gradient(90deg, #60A5FA, #93C5FD);
  --skin-circle-ring: #60A5FA;
  --skin-btn-bg: rgba(96, 165, 250, 0.15);
  --skin-btn-hover: rgba(96, 165, 250, 0.25);
}

/* 薄雾灰 */
[data-skin="gray"] {
  --skin-bg: rgba(243, 244, 246, 0.92);
  --skin-border: rgba(75, 85, 99, 0.25);
  --skin-text-primary: #1F2937;
  --skin-text-secondary: #4B5563;
  --skin-dot: #6B7280;
  --skin-dot-glow: rgba(107, 114, 128, 0.6);
  --skin-progress-bg: rgba(75, 85, 99, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #6B7280, #9CA3AF);
  --skin-circle-ring: #6B7280;
  --skin-btn-bg: rgba(107, 114, 128, 0.12);
  --skin-btn-hover: rgba(107, 114, 128, 0.22);
}

/* 极光青 */
[data-skin="aurora"] {
  --skin-bg: rgba(207, 250, 255, 0.92);
  --skin-border: rgba(8, 145, 178, 0.25);
  --skin-text-primary: #0E7490;
  --skin-text-secondary: #0891B2;
  --skin-dot: #06B6D4;
  --skin-dot-glow: rgba(6, 182, 212, 0.6);
  --skin-progress-bg: rgba(8, 145, 178, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #06B6D4, #22D3EE);
  --skin-circle-ring: #06B6D4;
  --skin-btn-bg: rgba(6, 182, 212, 0.12);
  --skin-btn-hover: rgba(6, 182, 212, 0.22);
}
</style>

<style lang="scss" scoped>
.pomodoro-mini-window {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 4% 5%;
  background: var(--skin-bg);
  border-radius: 0.8em;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  font-size: clamp(8px, 3vmin, 14px);
  border: 1px solid var(--skin-border);
}

.mouse-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;

  .mouse-left,
  .mouse-right {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8%;
    max-width: 16px;
    min-width: 8px;
    pointer-events: auto;
    cursor: default;
  }

  .mouse-left {
    left: 0;
  }

  .mouse-right {
    right: 0;
  }
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  z-index: 1;
  min-height: 0;
  cursor: pointer;
}
</style>
