<template>
  <!-- 快速粘贴面板：顶部拖拽栏（标题 + 关闭）+ 搜索行 + 结果列表 -->
  <div
    class="quick-paste-panel"
    @mouseenter="onPanelEnter"
    @mouseleave="onPanelEnter"
  >
    <!-- 顶部拖拽栏：整行可拖拽移动窗口。与 quickNote 一致，直接用 CSS
         -webkit-app-region:drag，不做任何 JS 拖拽监听；关闭按钮设 no-drag 才能点 -->
    <div class="panel-header">
      <div class="header-title">
        <LucideIcon name="Copy" :size="14" class="header-icon" />
        <span>剪贴板</span>
      </div>
      <button
        type="button"
        class="header-close"
        title="关闭"
        @click="hideWindow"
      >
        <LucideIcon name="X" :size="14" />
      </button>
    </div>

    <!-- 第二行：搜索框（不再占用拖拽区，留出更大的拖拽面积） -->
    <div class="panel-search-row">
      <LucideIcon name="Search" :size="14" class="search-icon" />
      <!-- 键盘操作统一挂在 document 上：点击列表项后输入框会失焦，
           只在输入框上监听会导致失焦后方向键失效 -->
      <input
        ref="inputRef"
        v-model="keyword"
        class="panel-input"
        placeholder="搜索…"
        @input="onKeywordInput"
      />
    </div>

    <div class="panel-list" :class="{ 'is-grid': layout === 'grid' }">
      <QuickPasteItem
        v-for="(item, index) in items"
        :key="item.id ?? index"
        :item="item"
        :active="index === activeIndex"
        :layout="layout"
        @mouseenter="activeIndex = index"
        @click="activeIndex = index"
        @dblclick="onEnter"
      />
      <div v-if="!items.length && !loading" class="panel-empty">暂无记录</div>
    </div>

    <div class="panel-tip">↑↓ 选择 · Enter 或双击粘贴 · Esc 关闭 · 拖动顶部移动</div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import QuickPasteItem from './QuickPasteItem.vue'
import { useQuickPaste } from '../clipboard/composables/useQuickPaste'

const WINDOW_NAME = 'clipboardMiniWindow'

const { keyword, items, loading, activeIndex, query, onKeywordInput, move, pasteActive } = useQuickPaste()

const inputRef = ref<HTMLInputElement | null>(null)
let inputTimer: ReturnType<typeof setTimeout> | null = null

// 排版方式：list 列表 / grid 图文网格，来自小窗设置
const layout = ref<'list' | 'grid'>('list')

// 拖拽完全交给 CSS：顶部栏 .panel-header 用 -webkit-app-region:drag（同 quickNote），
// 这里不再有任何 mousedown / mousemove 拖拽监听。

// 隐藏窗口（不是销毁）：下次唤出直接复用，避免重建开销
function hideWindow() {
  ;(window as any).ipcRenderer?.send('hide-new-window', WINDOW_NAME)
}

// 应用小窗皮肤（与 todoMiniWindow 一致：白色即默认皮肤，移除 data-skin 属性）
function applySkin(skin: string) {
  if (skin === 'white') {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', skin)
  }
}

// 读取小窗配置：皮肤主题与排版样式（设置页保存在 window-mode:clipboardMiniWindow）
function loadConfig() {
  try {
    const configStr = (window as any).ipcRenderer?.sendSync('get-store', 'window-mode:clipboardMiniWindow')
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : configStr || {}
    if (config?.skin) applySkin(config.skin)
    if (config?.layout === 'grid') layout.value = 'grid'
  } catch (e) {
    console.log('加载剪贴板面板配置失败:', e)
  }
}

// 回车或双击：写入剪贴板 → 隐藏面板 → 尝试自动粘贴
async function onEnter() {
  await pasteActive({ hide: hideWindow, autoPaste: true })
}

/**
 * 鼠标进入面板 → 关闭鼠标穿透（setIgnoreMouseEvents(false)），让窗口捕获事件：
 * 顶部栏可拖拽、搜索框可输入、列表可点击。
 * 这是 quickNote 同款的 disable-mouse-click-through 模式，避免透明浮层一直挡住下层应用。
 * 注意：窗口处于穿透（ignore）状态时 CSS app-region 拖拽会失效，
 * 所以鼠标必须先进入面板（触发本事件）才能拖动顶部栏。
 */
function onPanelEnter() {
  ;(window as any).ipcRenderer?.send('disable-mouse-click-through', WINDOW_NAME)
}

/**
 * 鼠标离开面板 → 开启鼠标穿透（setIgnoreMouseEvents(true, { forward: true })），
 * 浮层不挡下层应用。拖拽由系统（app-region）接管，鼠标始终跟随窗口，不会误触发。
 */
function onPanelLeave() {
  ;(window as any).ipcRenderer?.send('enable-mouse-click-through', WINDOW_NAME)
}

/**
 * 键盘操作挂在 document 上而非输入框：
 * 点击列表项后输入框会失焦，若只在输入框监听，失焦后方向键 / Enter / Esc 全部失效。
 */
function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    hideWindow()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    void onEnter()
  }
}

/**
 * 窗口重新显示（再次唤出）时恢复干净状态。
 * 这里用 visibilitychange 而不是 window focus：后者在输入过程中可能被反复触发，
 * 一旦触发就会把刚输入的关键词清空，表现为「输入框打不了字」。
 */
function onVisibilityChange() {
  if (document.hidden) return
  keyword.value = ''
  activeIndex.value = 0
  query()
  inputTimer = setTimeout(() => inputRef.value?.focus(), 50)
}

onMounted(() => {
  loadConfig()
  query()
  // 小窗打开即聚焦输入框（延后一帧，确保窗口已完成显示）
  inputTimer = setTimeout(() => inputRef.value?.focus(), 50)
  document.addEventListener('keydown', onDocumentKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (inputTimer) clearTimeout(inputTimer)
  document.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped lang="scss">
.quick-paste-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;

  // —— 顶部拖拽栏 ——
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 34px;
    padding: 0 8px;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border-subtle);
    // 与 quickNote 一致：由系统接管拖拽，不做任何 JS 监听
    -webkit-app-region: drag;
    cursor: grab;
    user-select: none;

    // 拖拽中光标（纯 CSS，无需 JS 状态）
    &:active {
      cursor: grabbing;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);

      .header-icon {
        color: var(--color-primary);
      }
    }

    .header-close {
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

  // —— 第二行搜索 ——
  .panel-search-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 8px 8px 4px;
    height: 30px;
    padding: 0 10px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;

    &:focus-within {
      border-color: var(--color-primary);
    }

    .search-icon {
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .panel-input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      font-size: 13px;
      color: var(--text-primary);
      // 输入框显式 no-drag 并放开选中，避免被拖拽区吞掉焦点/无法选中
      -webkit-app-region: no-drag;
      user-select: text;

      &::placeholder {
        color: var(--text-muted);
      }
    }
  }

  .panel-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;

    // 图文网格排版：三列，适合翻找图片历史
    &.is-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      align-content: start;
    }

    .panel-empty {
      padding: 24px 0;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
    }
  }

  .panel-tip {
    flex-shrink: 0;
    padding: 5px 10px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-base);
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
  }
}
</style>
