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
        :enabled="currentEnabled"
        @cycle-theme="cycleTheme"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from 'vue';
import moment from 'moment';
import LayoutDefault from './layouts/LayoutDefault.vue';
import LayoutSimple from './layouts/LayoutSimple.vue';
import LayoutCircle from './layouts/LayoutCircle.vue';
import LayoutCompact from './layouts/LayoutCompact.vue';
import LayoutClassic from './layouts/LayoutClassic.vue';
import LayoutFlip from './layouts/LayoutFlip.vue';
import useTipsRuntime from '@/store/useTipsRuntime';
import useNewReminder from '@/store/useNewReminder';
import { setupTipsBridge } from '@/hooks/useTipsBridge';

// 复用与主窗口一致的番茄钟运行时 store（时间线完全由主进程 stateful 引擎下发，杜绝旧锚点漂移）
const runtime = useTipsRuntime()
// 读取番茄钟提醒的 enabled 开关，作为 props 下发给各 layout 组件（关闭时各 layout 显示「番茄钟已关闭」）
const reminderStore = useNewReminder()
const pomodoroReminder = computed(() => reminderStore.reminders.find((r) => r.id === 'pomodoro'))
// 综合「本地提醒表 enabled」与「主进程下发 stopped 同步」判定是否开启：
// - 冷启动读 enabled 字段，覆盖「打开小窗时番茄钟已被关闭」、主进程无状态下发的情形；
// - 主窗口切换开关时，主进程下发 stopped 同步（关闭）或状态进入（开启），据此刷新本地表，实现跨窗口同步。
const currentEnabled = computed(() => {
  const localEnabled = pomodoroReminder.value ? pomodoroReminder.value.enabled === 1 : true
  if (!localEnabled) return false
  return !runtime.stopped
})
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
  return runtime.currentStateKey || 'work'
})

const statusClass = computed(() => {
  const status = runtime.currentStateKey;
  return status === 'work' ? 'status-work' : 'status-rest';
});

const statusLabel = computed(() => {
  if (runtime.idle) return '空闲中';
  const status = runtime.currentStateKey;
  return status === 'work' ? '工作中' : '休息中';
});

const statusSubtitle = computed(() => {
  if (runtime.idle) return '免打扰时段';
  const status = runtime.currentStateKey;
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
    // 直接传对象，避免二次 JSON.stringify 导致双重序列化
    window.ipcRenderer.sendSync('set-store', 'window-mode:pomodoro', config)
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

// 番茄钟运行时状态由 useTipsBridge 统一监听主进程下发的 tips-state-change 写入
// useTipsRuntime store（与主窗口 home 完全一致的逻辑），本窗口只消费 store，不再自行监听。

// 主进程切换番茄钟开关时，会下发 stopped 同步（关闭）或状态进入（开启）；据此刷新本地提醒表 enabled，
// 使小窗口跨窗口同步显示「番茄钟已关闭 / 运行中」（小窗口是独立渲染进程，store 不共享）。
function onPomodoroStateSync(_e: any, arg: any) {
  if (arg && arg.reminderId === 'pomodoro') {
    reminderStore.load()
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
  }
});

let timer: any = null;

function countDown() {
  if (timer) {
    clearInterval(timer);
  }

  timer = setInterval(() => {
    const nextTimeTs = runtime.nextStateTime;
    // 序列已结束（nextTime 为 null，如停止态/非序列永久态）：显示等待，等主进程下发新状态
    // 空闲中（免打扰时段）：显示「空闲中」，不跑倒计时
    if (!nextTimeTs || runtime.idle) {
      nextDiffTime.value = runtime.idle ? '空闲中' : '等待中...';
      progressPercentValue.value = 0;
      return;
    }

    const now = moment();
    const next = moment(nextTimeTs);
    const diff = next.diff(now);

    if (diff < 0) {
      nextDiffTime.value = '即将切换';
      progressPercentValue.value = 100;
      return;
    }

    const diffTime = moment.duration(diff);
    const diffHours = diffTime.hours().toString().padStart(2, '0');
    const diffMinutes = diffTime.minutes().toString().padStart(2, '0');
    const diffSeconds = diffTime.seconds().toString().padStart(2, '0');

    nextDiffTime.value = `${diffHours}:${diffMinutes}:${diffSeconds}`;
    updateProgressByRange(runtime.stateStartTime, nextTimeTs);
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
  // 拉取提醒表，确保 currentEnabled 能读到 pomodoro 的 enabled 开关
  reminderStore.load()
  // 接入番茄钟桥接：注册全局监听主进程下发的权威状态事件，并主动 request-tips-state
  // 补偿启动竞态首帧（与主窗口 home 完全一致的运行展示逻辑）。小窗口是独立渲染进程，
  // 必须自己注册，否则收不到状态 → 倒计时卡在「同步中」。
  setupTipsBridge()
  // 监听主进程状态下发，跨窗口同步 enabled 开关（主窗口拨动开关时刷新本地提醒表）
  window.ipcRenderer.on('tips-state-sync', onPomodoroStateSync)
  window.ipcRenderer.on('tips-state-change', onPomodoroStateSync)
  countDown()
})

// 由主进程权威区间 [stateStartTime, nextStateTime] 计算进度，杜绝旧锚点漂移
function updateProgressByRange(startTime: number | null, nextTimeTs: number | null) {
  if (!startTime || !nextTimeTs) {
    progressPercentValue.value = 0;
    return;
  }
  const total = nextTimeTs - startTime;
  const elapsed = Date.now() - startTime;
  if (total <= 0) {
    progressPercentValue.value = 0;
    return;
  }
  progressPercentValue.value = Math.max(0, Math.min(100, (elapsed / total) * 100));
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

// 番茄钟关闭时各 layout 统一展示的占位（全局样式，覆盖所有小窗 layout 组件）
.pomodoro-mini-disabled {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--skin-text-secondary);
  font-size: 1.4em;
  font-weight: 600;
  -webkit-app-region: drag;
  user-select: none;
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
