<template>
  <!--
    命令面板主体：顶部拖拽栏（标题 + 关闭）+ 搜索行 + 结果列表 + 底部提示。
    拖拽完全交给 CSS（-webkit-app-region: drag），不做任何 JS 拖拽监听，与 quickNote 一致。
  -->
  <div class="command-palette" @mouseenter="disableClickThrough">
    <header class="palette-header">
      <div class="palette-header__title">
        <LucideIcon name="Command" :size="14" class="palette-header__icon" />
        <span>命令面板</span>
      </div>
      <button type="button" class="palette-header__close" title="关闭 (Esc)" @click="hidePalette">
        <LucideIcon name="X" :size="14" />
      </button>
    </header>

    <PaletteInput
      ref="inputRef"
      :model-value="keyword"
      :scope="scope"
      placeholder="搜索功能、笔记、待办… 用 ! 直接打卡习惯"
      @update:model-value="onInput"
      @clear="onClear"
    />

    <PaletteResultList
      :items="items"
      :active-index="activeIndex"
      :loading="loading"
      :query="query"
      @select="onSelect"
      @run="onRun"
    />

    <!-- 底部栏同样可拖拽（与 quickNote 的 status-bar 一致），扩大可抓区域 -->
    <footer class="palette-footer">
      <span>↑↓ 选择 · Enter 执行 · Esc 关闭</span>
      <span class="palette-footer__scope">@ 笔记 · # 待办 · / 功能</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import PaletteInput from './components/PaletteInput.vue'
import PaletteResultList from './components/PaletteResultList.vue'
import { useCommandPalette } from './composables/useCommandPalette'
import { usePaletteKeyboard } from './composables/usePaletteKeyboard'
import { WINDOW_NAME, STORE_KEY } from './config/paletteConfig'

const inputRef = ref<InstanceType<typeof PaletteInput> | null>(null)
let focusTimer: ReturnType<typeof setTimeout> | null = null

/** 隐藏窗口（不是销毁）：下次唤出直接复用，避免重建开销 */
function hidePalette() {
  window.ipcRenderer?.send('hide-new-window', WINDOW_NAME)
}

/** 显示主窗口并跳转到指定路由，由主进程转发 open-match-page 给渲染端 */
function navigate(routeName: string) {
  window.ipcRenderer?.send('palette-navigate', routeName)
}

const {
  keyword,
  items,
  loading,
  activeIndex,
  scope,
  query,
  queryNow,
  onKeywordChange,
  move,
  runAt,
  runActive,
  reset,
} = useCommandPalette({ hidePalette, navigate })

function onInput(value: string) {
  keyword.value = value
  onKeywordChange()
}

function onClear() {
  keyword.value = ''
  activeIndex.value = 0
  void queryNow()
}

function onSelect(index: number) {
  activeIndex.value = index
}

function onRun(index: number) {
  void runAt(index)
}

/** 输入只剩一个作用域前缀时，一次退格清掉整个前缀 */
function onBackspace(value: string): boolean {
  if (/^[@#/]$/.test(value)) {
    onClear()
    return true
  }
  return false
}

/**
 * 鼠标进入面板 → 关闭鼠标穿透，让窗口捕获事件（可拖拽、可输入、可点击）。
 * 窗口处于穿透态时 CSS app-region 拖拽会失效，所以必须先切回捕获态才拖得动。
 *
 * 这里刻意**不监听 mouseleave 去重新开启穿透**（与 quickNote 一致）：
 * 拖拽过程中窗口位置在变，一旦中途切回穿透态，这次拖拽会直接断掉。
 * 面板只在被唤出时可见、Esc 即关，不需要「浮层不挡下层」的常驻穿透。
 */
function disableClickThrough() {
  window.ipcRenderer?.send('disable-mouse-click-through', WINDOW_NAME)
}

usePaletteKeyboard({
  onEscape: hidePalette,
  onMoveDown: () => move(1),
  onMoveUp: () => move(-1),
  onEnter: () => void runActive(),
  onBackspace,
})

/** 应用小窗皮肤：white 即默认皮肤，移除 data-skin 属性 */
function applySkin(skin: string) {
  if (skin === 'white') {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', skin)
  }
}

/** 读取小窗配置（设置页保存在 window-mode:commandPaletteMiniWindow） */
function loadConfig() {
  try {
    const configStr = window.ipcRenderer?.sendSync('get-store', STORE_KEY)
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : configStr || {}
    if (config?.skin) applySkin(config.skin)
  } catch (e) {
    console.log('加载命令面板配置失败:', e)
  }
}

/**
 * 窗口重新显示（再次唤出）时恢复干净状态。
 * 用 visibilitychange 而不是 window focus：后者在输入过程中可能被反复触发，
 * 会把刚输入的关键词清空，表现为「输入框打不了字」。
 */
function onVisibilityChange() {
  if (document.hidden) return
  reset()
  focusTimer = setTimeout(() => inputRef.value?.focus(), 50)
}

onMounted(() => {
  loadConfig()
  void queryNow()
  // 小窗打开即聚焦输入框（延后一帧，确保窗口已完成显示）
  focusTimer = setTimeout(() => inputRef.value?.focus(), 50)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (focusTimer) clearTimeout(focusTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped lang="scss">
.command-palette {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  // 与 quickNote 一致：整窗禁止选中。可拖区域内若还能选中文字，
  // 按下鼠标会变成划选而不是拖窗口
  -webkit-user-select: none;
  user-select: none;

  // —— 顶部拖拽栏 ——
  .palette-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 34px;
    padding: 0 8px;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border-subtle);
    -webkit-app-region: drag;
    cursor: grab;
    user-select: none;
    flex-shrink: 0;

    &:active {
      cursor: grabbing;
    }

    &__title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    &__icon {
      color: var(--color-primary);
    }

    &__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--text-muted);
      cursor: pointer;
      // 拖拽区内的按钮必须显式 no-drag，否则点不动
      -webkit-app-region: no-drag;
      transition:
        background 0.15s ease,
        color 0.15s ease;

      &:hover {
        background: var(--bg-hover);
        color: var(--color-error);
      }
    }
  }

  // —— 底部提示（同样可拖拽） ——
  .palette-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
    height: 26px;
    padding: 0 10px;
    background: var(--bg-base);
    border-top: 1px solid var(--border-subtle);
    font-size: 11px;
    color: var(--text-muted);
    user-select: none;
    -webkit-app-region: drag;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }

    &__scope {
      opacity: 0.75;
    }
  }
}
</style>
