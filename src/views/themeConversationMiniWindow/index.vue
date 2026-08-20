<template>
  <div class="theme-conversation-mini-window" @dblclick="cycleTheme">
    <div class="mouse-controls">
      <div class="mouse-left" @mousemove="disableMouseClickThroughFn"></div>
      <div class="mouse-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>

    <div class="content-area">
      <div class="mini-header" @dblclick="cycleTheme">
        <span class="header-title">主题对话</span>
      </div>
      <ThemeConversationPage :compact="true" />
      <div class="mini-footer">
        <span class="footer-hint">双击切换主题</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ThemeConversationPage from '../themeConversation/components/ThemeConversationPage.vue';

const STORE_KEY = 'window-mode:themeConversationMini';

const themes = [
  'coral', 'mint', 'sky', 'lavender', 'sakura',
  'amber', 'white', 'dark', 'gray', 'aurora'
];

const applyTheme = (theme: string) => {
  if (theme === 'white') {
    document.documentElement.removeAttribute('data-skin');
  } else {
    document.documentElement.setAttribute('data-skin', theme);
  }
};

const saveConfig = (key: string, value: string) => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', STORE_KEY);
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {});
    config[key] = value;
    // 直接传对象，避免二次 JSON.stringify 导致双重序列化
    window.ipcRenderer.sendSync('set-store', STORE_KEY, config);
    window.ipcRenderer.send('sync-data-to-other-window', {
      themeConversationMiniWindowConfig: { ...config },
    });
  } catch (e) {
    console.log('保存主题对话小窗配置失败:', e);
  }
};

const loadConfig = () => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', STORE_KEY);
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {});
    if (config.skin) {
      applyTheme(config.skin);
    }
  } catch (e) {
    console.log('加载主题对话小窗配置失败:', e);
  }
};

const cycleTheme = () => {
  console.log('Theme conversation mini skin cycle');
  const currentSkin = document.documentElement.getAttribute('data-skin') || 'white';
  const idx = themes.indexOf(currentSkin);
  const nextTheme = themes[(idx + 1) % themes.length];

  applyTheme(nextTheme);
  saveConfig('skin', nextTheme);
};

const enableMouseClickThroughFn = () => {
  window.ipcRenderer.send('enable-mouse-click-through', 'themeConversationMini');
};

const disableMouseClickThroughFn = () => {
  window.ipcRenderer.send('disable-mouse-click-through', 'themeConversationMini');
};

window.ipcRenderer.on('sync-data-to-other-window', (event: any, arg: any) => {
  if (arg && arg.themeConversationMiniWindowConfig && arg.themeConversationMiniWindowConfig.skin) {
    applyTheme(arg.themeConversationMiniWindowConfig.skin);
  }
});

loadConfig();
</script>

<style lang="scss" scoped>
.theme-conversation-mini-window {
  // 禁止复制
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
  cursor: default;
}

.mini-header {
  display: flex;
  align-items: center;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--skin-border);
  // Electron 原生窗口拖拽区域：顶部可拖拽移动小窗
  -webkit-app-region: drag;
  cursor: default;
  flex-shrink: 0;

  .header-title {
    font-size: 1.2em;
    font-weight: 600;
    color: var(--skin-text-primary);
  }
}

.mini-footer {
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid var(--skin-border);
  flex-shrink: 0;

  .footer-hint {
    font-size: 0.85em;
    color: var(--skin-text-primary);
    opacity: 0.5;
  }
}
</style>
