<template>
  <div class="pomodoro-mini-window" :class="statusClass">
    <div class="mouse-controls">
      <div class="mouse-left" @mousemove="disableMouseClickThroughFn"></div>
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
      fetchPomodoroData();
      return;
    }

    const now = moment();
    const next = moment(nextTime.value);
    const diff = next.diff(now);

    if (diff < 0) {
      nextDiffTime.value = '等待中...';
      progressPercentValue.value = 0;
      fetchPomodoroData();
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
    const result = await window.ipcRenderer.handlePromise('new-sql:execute', {
      sql: 'SELECT * FROM basic_info',
      params: [],
    });
    if (result.success && result.data && result.data.rows) {
      let rows = result.data.rows || [];
      rows = rows.reduce((acc: any, row: any) => {
        acc[row.key] = typeof row.value == 'string' ? JSON.parse(row.value) : row.value;
        return acc
      }, {})

      handlePomodoroData(rows);
    }
  } catch (e) {
    console.log('获取番茄钟数据失败:', e)
  }
}

function handlePomodoroData(data: any) {
  // 设置当前状态
  curStatusC.value = { value: data.curStatus?.value || data.curStatus || 'work' }
  
  // 计算下一个状态切换时间
  if (data.curStatus?.value === 'work' || data.curStatus === 'work') {
    nextTime.value = moment(data.startWorkTime + data.workTimeGapUnit * data.workTimeGap).format('YYYY-MM-DD HH:mm:ss')
  } else {
    nextTime.value = moment(data.closeWorkTime + data.restTimeGapUnit * data.restTimeGap).format('YYYY-MM-DD HH:mm:ss')
  }
  
  // 计算进度
  if (data.curStatus?.value === 'work' || data.curStatus === 'work') {
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

</style>

<style lang="scss" scoped>
.pomodoro-mini-window {
  // 禁止复制
  -webkit-user-select: none;
  user-select: none;
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
