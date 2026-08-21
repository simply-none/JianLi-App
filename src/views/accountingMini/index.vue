<!--
 * 记账 - 小窗口（薄壳）
 * 复用 AccountingPage 的 compact 模式；结构与「主题对话小窗口」一致：
 * 鼠标穿透控制、双击换肤、关闭按钮。窗口名为 accountingMini（与路由 hash 对应）。
-->
<template>
  <div class="accounting-mini-window" @dblclick="cycleTheme">
    <div class="mouse-controls">
      <div class="mouse-left" @mousemove="disableMouseClickThroughFn"></div>
      <div class="mouse-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>

    <div class="content-area">
      <div class="mini-header">
        <span class="mini-title">记一笔</span>
        <div class="mini-actions">
          <button class="header-btn" @click.stop="cycleTheme" title="切换主题">
            <LucideIcon name="Palette" :size="14" />
          </button>
          <button class="header-btn" @click.stop="closeWindow" title="关闭">
            <LucideIcon name="X" :size="14" />
          </button>
        </div>
      </div>
      <AccountingPage :compact="true" class="mini-body" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AccountingPage from '../accounting/components/AccountingPage.vue'
import LucideIcon from '@/components/LucideIcon.vue'
import useWindowMode from '@/store/useWindowMode'

const STORE_KEY = 'window-mode:accountingMini'
const WIN_NAME = 'accountingMini'

const themes = [
  'coral', 'mint', 'sky', 'lavender', 'sakura',
  'amber', 'white', 'dark', 'gray', 'aurora',
]

const applyTheme = (theme: string) => {
  if (theme === 'white') {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', theme)
  }
}

const saveConfig = (key: string, value: string) => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', STORE_KEY)
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {})
    config[key] = value
    window.ipcRenderer.sendSync('set-store', STORE_KEY, config)
    window.ipcRenderer.send('sync-data-to-other-window', {
      accountingMiniWindowConfig: { ...config },
    })
  } catch (e) {
    console.log('保存记账小窗配置失败:', e)
  }
}

const loadConfig = () => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', STORE_KEY)
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {})
    if (config.skin) applyTheme(config.skin)
  } catch (e) {
    console.log('加载记账小窗配置失败:', e)
  }
}

const cycleTheme = () => {
  const currentSkin = document.documentElement.getAttribute('data-skin') || 'white'
  const idx = themes.indexOf(currentSkin)
  const nextTheme = themes[(idx + 1) % themes.length]
  applyTheme(nextTheme)
  saveConfig('skin', nextTheme)
}

const closeWindow = () => {
  // 通过 windowMode store 关闭，保持设置页开关状态一致（会发送 close-new-window）
  useWindowMode().setShowAccountingMiniWindow(false)
}

const enableMouseClickThroughFn = () => {
  window.ipcRenderer.send('enable-mouse-click-through', WIN_NAME)
}
const disableMouseClickThroughFn = () => {
  window.ipcRenderer.send('disable-mouse-click-through', WIN_NAME)
}

// 接收其它窗口同步过来的皮肤配置
window.ipcRenderer.on('sync-data-to-other-window', (event: any, arg: any) => {
  if (arg && arg.accountingMiniWindowConfig && arg.accountingMiniWindowConfig.skin) {
    applyTheme(arg.accountingMiniWindowConfig.skin)
  }
})

loadConfig()
</script>

<style lang="scss" scoped>
.accounting-mini-window {
  -webkit-user-select: none;
  user-select: none;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 8px;
  background: var(--skin-bg);
  border-radius: 0.8em;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  font-size: clamp(12px, 3vmin, 16px);
  border: 1px solid var(--skin-border);

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
    .mouse-left { left: 0; }
    .mouse-right { right: 0; }
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    z-index: 1;
    min-height: 0;
  }

  /* 记账页占满 header 以外的剩余高度（其自身 height:100% 会多算 header 的 26px） */
  .mini-body {
    flex: 1;
    min-height: 0;
    height: auto;
  }

  .mini-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 26px;
    flex-shrink: 0;
    -webkit-app-region: drag;
    cursor: default;

    .mini-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--skin-text-primary);
    }
    .mini-actions {
      display: flex;
      gap: 4px;
      -webkit-app-region: no-drag;
    }
    .header-btn {
      -webkit-app-region: no-drag;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--skin-text-secondary);
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      &:hover {
        background: var(--skin-btn-hover);
        color: var(--skin-text-primary);
      }
    }
  }
}
</style>
