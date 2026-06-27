<template>
  <div class="pomodoro-mini-window" :class="[statusClass, `layout-${currentLayout}`]">
    <div class="mouse-controls">
      <div class="mouse-left" @mousemove="enableMouseClickThroughFn"></div>
      <div class="mouse-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>

    <div class="content-area">
      <div class="top-section">
        <div class="status-section">
          <div class="status-indicator">
            <div class="status-dot"></div>
          </div>
          <div class="status-info">
            <div class="status-label">{{ statusLabel }}</div>
            <div class="status-subtitle">{{ statusSubtitle }}</div>
          </div>
        </div>
        <div class="theme-switch" @click.stop="cycleTheme">
          <div class="switch-icon">◉</div>
        </div>
      </div>

      <div class="countdown-section">
        <div class="countdown-value">{{ nextDiffTime }}</div>
      </div>

      <div class="progress-section">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: progressPercentValue + '%' }"
          ></div>
        </div>
        <div class="progress-text">{{ Math.round(progressPercentValue) }}%</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import moment from 'moment';

const curStatusC = ref({})
const nextTime = ref()
const nextDiffTime = ref('00:00:00')
const sysData = ref({})
const progressPercentValue = ref(0)
const currentLayout = ref('default')

const themes = [
  'default', 'dark', 'midnight', 'nord', 'one-dark', 
  'dracula', 'github-dark', 'tokyo-night', 'solarized', 
  'gruvbox', 'catppuccin', 'catppuccin-mocha', 'ayu-dark', 'ayu-mirage'
]

const layouts = ['default', 'simple', 'circle', 'compact', 'classic']

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
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'default'
  const idx = themes.indexOf(currentTheme)
  const nextTheme = themes[(idx + 1) % themes.length]
  
  if (nextTheme === 'default') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', nextTheme)
  }
  
  saveConfig('skin', nextTheme)
}

const cycleLayout = () => {
  const idx = layouts.indexOf(currentLayout.value)
  currentLayout.value = layouts[(idx + 1) % layouts.length]
  saveConfig('layout', currentLayout.value)
}

const saveConfig = (key, value) => {
  window.ipcRenderer.handlePromise('set-data', {
    tableName: 'pomodoro_mini_config',
    data: { [key]: value },
    config: { primaryKey: 'key' }
  })
}

const loadConfig = async () => {
  try {
    const result = await window.ipcRenderer.handlePromise('query-data', {
      tableName: 'pomodoro_mini_config'
    })
    if (result.success && result.data.length > 0) {
      const config = result.data[0]
      if (config.skin) {
        if (config.skin === 'default') {
          document.documentElement.removeAttribute('data-theme')
        } else {
          document.documentElement.setAttribute('data-theme', config.skin)
        }
      }
      if (config.layout) {
        currentLayout.value = config.layout
      }
    }
  } catch (e) {
    console.log('加载配置失败:', e)
  }
}

window.ipcRenderer.on('sync-data-to-other-window', (event, arg) => {
  if (Object.prototype.toString.call(arg) === '[object Object]') {
    sysData.value = arg || {};
    sysData.value.globalFont && document.documentElement.style.setProperty('--jianli-global-font', sysData.value.globalFont);
    sysData.value.globalFontEN && document.documentElement.style.setProperty('--jianli-global-font-EN', sysData.value.globalFontEN);
    curStatusC.value = arg.curStatus;
    
    if (arg.curStatus && arg.curStatus.value === 'work') {
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
        const progress = (elapsed / duration) * 100;
        progressPercentValue.value = Math.max(0, Math.min(100, progress));
      }
    }
    
    countDown();
  }
});

let timer = null;

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
        startTime = data.startWorkTime;
        duration = data.workTimeGapUnit * data.workTimeGap;
      } else {
        startTime = data.closeWorkTime;
        duration = data.restTimeGapUnit * data.restTimeGap;
      }
      
      if (startTime && duration && duration > 0) {
        const elapsed = now.valueOf() - startTime;
        const progress = (elapsed / duration) * 100;
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
})
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
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 4% 5%;
  background: var(--bg-card, rgba(255, 255, 255, 0.85));
  border-radius: 0.8em;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  font-size: clamp(8px, 3vmin, 14px);
  border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.1));

  &.status-work {
    background: var(--status-work-bg, rgba(76, 175, 80, 0.08));
    border-color: rgba(76, 175, 80, 0.2);
    
    .status-dot {
      background: var(--color-success, #4caf50);
      box-shadow: 0 0 1em rgba(76, 175, 80, 0.6);
    }
    
    .status-label {
      color: var(--text-primary, #2e7d32);
    }
    
    .progress-fill {
      background: linear-gradient(90deg, var(--color-success, #4caf50) 0%, rgba(76, 175, 80, 0.7) 100%);
    }
    
    .countdown-value {
      color: var(--text-primary, #2e7d32);
    }
  }

  &.status-rest {
    background: var(--status-rest-bg, rgba(33, 150, 243, 0.08));
    border-color: rgba(33, 150, 243, 0.2);
    
    .status-dot {
      background: var(--color-info, #2196f3);
      box-shadow: 0 0 1em rgba(33, 150, 243, 0.6);
    }
    
    .status-label {
      color: var(--text-primary, #1565c0);
    }
    
    .progress-fill {
      background: linear-gradient(90deg, var(--color-info, #2196f3) 0%, rgba(33, 150, 243, 0.7) 100%);
    }
    
    .countdown-value {
      color: var(--text-primary, #1565c0);
    }
  }
}

.top-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.theme-switch {
  width: 1.8em;
  height: 1.8em;
  min-width: 14px;
  min-height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.1));
  
  &:hover {
    transform: scale(1.1);
    background: rgba(0, 0, 0, 0.1);
  }
  
  .switch-icon {
    font-size: 0.8em;
    color: var(--text-secondary, #666);
    line-height: 1;
  }
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
  justify-content: space-between;
  gap: 0.5em;
  z-index: 1;
  min-height: 0;
  
  &:dblclick {
    cursor: pointer;
  }
}

.status-section {
  display: flex;
  align-items: center;
  gap: 1em;
  flex-shrink: 0;
  
  .status-indicator {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-app-region: drag;
    
    .status-dot {
      width: 1.35em;
      height: 1.35em;
      min-width: 8px;
      min-height: 8px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
  }
  
  .status-info {
    display: flex;
    flex-direction: column;
    gap: 0.2em;
    min-width: 0;
    overflow: hidden;
    
    .status-label {
      font-size: 1.75em;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .status-subtitle {
      font-size: 1.3em;
      color: var(--text-secondary, #666);
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}

.countdown-section {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 0;
  
  .countdown-value {
    font-size: clamp(16px, 8vmin, 36px);
    font-weight: 900;
    font-family: 'SF Mono', Monaco, 'Consolas', monospace;
    text-shadow: 0 0.1em 0.3em rgba(0, 0, 0, 0.1);
    line-height: 1;
    white-space: nowrap;
  }
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 0.5em;
  flex-shrink: 0;
  
  .progress-bar {
    flex: 1;
    height: clamp(9px, 2vmin, 12px);
    min-height: 9px;
    background: var(--progress-bg, rgba(0, 0, 0, 0.1));
    border-radius: 0.3em;
    overflow: hidden;
    
    .progress-fill {
      height: 100%;
      border-radius: 0.3em;
      transition: width 1s ease;
    }
  }
  
  .progress-text {
    font-size: 1.35em;
    font-weight: 600;
    color: var(--text-secondary, #666);
    flex-shrink: 0;
    white-space: nowrap;
  }
}

.layout-simple {
  .top-section {
    justify-content: center;
    
    .theme-switch {
      position: absolute;
      top: 4%;
      right: 5%;
    }
  }
  
  .status-section {
    .status-info {
      align-items: center;
      
      .status-label {
        font-size: 1.2em;
        font-weight: 600;
      }
      
      .status-subtitle {
        display: none;
      }
    }
  }
  
  .countdown-section {
    flex: 2;
    
    .countdown-value {
      font-size: clamp(20px, 10vmin, 42px);
    }
  }
  
  .progress-section {
    display: none;
  }
}

.layout-circle {
  .top-section {
    justify-content: center;
    
    .theme-switch {
      position: absolute;
      top: 4%;
      right: 5%;
    }
  }
  
  .status-section {
    display: none;
  }
  
  .countdown-section {
    flex: 1;
    position: relative;
    
    .countdown-value {
      font-size: clamp(14px, 6vmin, 28px);
      position: relative;
      z-index: 2;
    }
    
    &::before {
      content: '';
      position: absolute;
      width: 70%;
      height: 70%;
      max-width: 80px;
      max-height: 80px;
      border-radius: 50%;
      border: 0.4em solid var(--progress-bg, rgba(0, 0, 0, 0.1));
      box-sizing: border-box;
    }
    
    &::after {
      content: '';
      position: absolute;
      width: 70%;
      height: 70%;
      max-width: 80px;
      max-height: 80px;
      border-radius: 50%;
      border: 0.4em solid transparent;
      border-top-color: var(--color-primary, #6366f1);
      transform: rotate(calc(var(--progress-rotate, 0deg)));
      box-sizing: border-box;
      transition: transform 1s ease;
    }
  }
  
  .progress-section {
    justify-content: center;
    
    .progress-bar {
      display: none;
    }
    
    .progress-text {
      font-size: 1.5em;
      font-weight: 700;
      color: var(--text-primary);
    }
  }
}

.layout-compact {
  flex-direction: row;
  align-items: center;
  gap: 0.5em;
  
  .top-section {
    flex-direction: column;
    justify-content: center;
    gap: 0.3em;
    
    .theme-switch {
      position: absolute;
      top: 4%;
      right: 5%;
    }
  }
  
  .status-section {
    flex-direction: row;
    gap: 0.3em;
    
    .status-indicator .status-dot {
      width: 1em;
      height: 1em;
    }
    
    .status-info {
      flex-direction: row;
      align-items: center;
      
      .status-label {
        font-size: 1.3em;
        font-weight: 600;
      }
      
      .status-subtitle {
        display: none;
      }
    }
  }
  
  .countdown-section {
    flex: 1;
    justify-content: flex-start;
    
    .countdown-value {
      font-size: clamp(14px, 6vmin, 28px);
    }
  }
  
  .progress-section {
    flex-direction: column;
    gap: 0.2em;
    
    .progress-bar {
      width: 3em;
      height: 0.5em;
    }
    
    .progress-text {
      font-size: 1em;
    }
  }
}

.layout-classic {
  .top-section {
    justify-content: center;
    
    .theme-switch {
      position: absolute;
      top: 4%;
      right: 5%;
    }
    
    .status-section {
      display: none;
    }
  }
  
  .header-title {
    text-align: center;
    font-size: 1.4em;
    font-weight: 600;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  
  .countdown-section {
    flex: 1;
    
    .countdown-value {
      font-size: clamp(18px, 9vmin, 38px);
    }
  }
  
  .progress-section {
    flex-direction: column;
    align-items: center;
    gap: 0.3em;
    
    .progress-bar {
      width: 100%;
    }
    
    .progress-text {
      font-size: 1.2em;
      color: var(--text-primary);
    }
  }
}
</style>
