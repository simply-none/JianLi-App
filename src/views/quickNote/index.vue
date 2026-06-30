<template>
  <div class="quick-note-window" :class="{ 'drag-disabled': !dragEnabled }">
    <div class="mouse-controls">
      <div class="mouse-left" @mousemove="disableMouseClickThroughFn"></div>
      <div class="mouse-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>

    <div class="content-area">
      <component
        :is="currentLayoutComponent"
        v-model="text"
        :skin="currentSkin"
        :layout="currentLayout"
        :note-list="noteList"
        :current-note="curNote"
        :word-count="wordCount"
        :save-status="saveStatus"
        :drag-enabled="dragEnabled"
        @save="saveNote"
        @load-note="loadNote"
        @change-note="saveCurrentNote"
        @new-note="newNote"
        @cycle-skin="cycleSkin"
        @cycle-layout="cycleLayout"
        @toggle-drag="toggleDrag"
        @close-window="closeWindow"
        @disabled-mouse-click-through="enableMouseClickThroughFn"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, markRaw } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { ElMessage } from 'element-plus';
import LayoutMinimal from './layouts/LayoutMinimal.vue';
import LayoutGlass from './layouts/LayoutGlass.vue';
import LayoutSidebar from './layouts/LayoutSidebar.vue';
import LayoutClassic from './layouts/LayoutClassic.vue';
import { formatDate } from '@/utils/time';

const layouts = ['minimal', 'glass', 'sidebar', 'classic']

const layoutComponents: Record<string, any> = {
  minimal: markRaw(LayoutMinimal),
  glass: markRaw(LayoutGlass),
  sidebar: markRaw(LayoutSidebar),
  classic: markRaw(LayoutClassic),
}

const currentLayout = ref('minimal')
const currentSkin = ref('white')

const currentLayoutComponent = computed(() => {
  return layoutComponents[currentLayout.value] || layoutComponents.minimal
})

const themes = [
  'coral', 'mint', 'sky', 'lavender', 'sakura',
  'amber', 'white', 'dark', 'gray', 'aurora'
]

const text = ref('')
const curNote = ref<any>({})
const noteList = ref<any[]>([])
const saveStatus = ref('saved')
const dragEnabled = ref(true)

const wordCount = computed(() => {
  return text.value ? text.value.replace(/\s/g, '').length : 0
})

loadCurrentNote();

function applyTheme(theme: string) {
  if (theme === 'white') {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', theme)
  }
  currentSkin.value = theme
}

function saveConfig(key: string, value: string) {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', 'window-mode:quickNote')
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {})
    config[key] = value
    window.ipcRenderer.sendSync('set-store', 'window-mode:quickNote', config)
    window.ipcRenderer.send('sync-data-to-other-window', {
      quickNoteWindowConfig: { ...config },
    })
  } catch (e) {
    console.log('保存配置失败:', e)
  }
}

function loadConfig() {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', 'window-mode:quickNote')
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {})
    if (config.skin) {
      applyTheme(config.skin)
    } else {
      applyTheme('white')
    }
    if (config.layout) {
      currentLayout.value = config.layout
    }
  } catch (e) {
    console.log('加载配置失败:', e)
    applyTheme('white')
  }
}

function cycleSkin() {
  const currentSkinAttr = document.documentElement.getAttribute('data-skin') || 'white'
  const idx = themes.indexOf(currentSkinAttr)
  const nextTheme = themes[(idx + 1) % themes.length]
  applyTheme(nextTheme)
  saveConfig('skin', nextTheme)
}

function cycleLayout() {
  const idx = layouts.indexOf(currentLayout.value)
  currentLayout.value = layouts[(idx + 1) % layouts.length]
  saveConfig('layout', currentLayout.value)
}

function toggleDrag() {
  dragEnabled.value = !dragEnabled.value
}

function closeWindow() {
  window.ipcRenderer.send('close-new-window', 'quickNote')
}

const enableMouseClickThroughFn = () => {
  window.ipcRenderer.send('enable-mouse-click-through', 'quickNote')
}

const disableMouseClickThroughFn = () => {
  window.ipcRenderer.send('disable-mouse-click-through', 'quickNote')
}

function fetchNoteData(options: any = {}) {
  const { days = 90, specificDate = null, startDate = null, endDate = null } = options

  let whereStr: string

  if (specificDate) {
    whereStr = `createTime BETWEEN '${specificDate}' AND datetime('${specificDate}', '+1 day')`
  } else if (startDate && endDate) {
    whereStr = `createTime BETWEEN '${startDate}' AND '${endDate}'`
  } else {
    whereStr = `createTime >= DATE('now', '-${days} days')`
  }

  return window.ipcRenderer.handlePromise('query-data', {
    tableName: 'note_book',
    conditions: {
      whereStr: whereStr,
      limit: 50,
      orderByDesc: true,
      orderBy: 'createTime'
    }
  }).then((result: any) => {
    if (result.success) {
      return result.data
    }
    return []
  }).catch((err: any) => {
    ElMessage.error('查询失败:' + err)
    return []
  })
}

async function loadNoteList() {
  const data = await fetchNoteData({
    days: 360,
    startDate: formatDate(new Date()).dateStr
  })
  noteList.value = data
}

function loadNote(row: any) {
  console.log('加载笔记:', row)
  curNote.value = row
  text.value = row.mdText || ''
}

function newNote() {
  curNote.value = {}
  text.value = ''
  saveStatus.value = 'saved'
}

async function loadCurrentNote() { 
  const currentNoteStr = localStorage.getItem('quickNote:currentNote')
  if (currentNoteStr) {
    curNote.value = JSON.parse(currentNoteStr)
    text.value = curNote.value.mdText || ''
  }
}

async function saveCurrentNote(newText: string) { 
  let data = {
    mdText: newText,
    createTime: curNote.value.createTime || moment().format('YYYY-MM-DD HH:mm:ss'),
    updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
  }
  localStorage.setItem('quickNote:currentNote', JSON.stringify(data))
}

async function saveNote() {
  if (!text.value.trim()) {
    ElMessage.warning('内容不能为空')
    return
  }

  saveStatus.value = 'saving'

  try {
    const result = await window.ipcRenderer.handlePromise('set-data', {
      tableName: 'note_book',
      data: {
        ...curNote.value,
        key: curNote.value.key || uuidv4(),
        excerpt: (text.value || '').substring(0, 20) + '...',
        mdText: text.value,
        html: text.value,
        createTime: curNote.value.createTime || moment().format('YYYY-MM-DD HH:mm:ss'),
        updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      },
      config: {
        primaryKey: 'key',
      }
    })

    if (result.success) {
      ElMessage.success('保存成功')
      saveStatus.value = 'saved'
      curNote.value.key = curNote.value.key || uuidv4()
      // 清空笔记
      text.value = ''
      localStorage.removeItem('quickNote:currentNote')
      loadNoteList()
      return true
    } else {
      ElMessage.error('保存失败:' + result.error)
      saveStatus.value = 'error'
      return false
    }
  } catch (error) {
    ElMessage.error('保存失败:' + error)
    saveStatus.value = 'error'
    return false
  }
}

window.ipcRenderer.on('sync-data-to-other-window', (_event: any, arg: any) => {
  if (Object.prototype.toString.call(arg) === '[object Object]') {
    if (arg.quickNoteWindowConfig) {
      if (arg.quickNoteWindowConfig.skin) {
        applyTheme(arg.quickNoteWindowConfig.skin)
      }
      if (arg.quickNoteWindowConfig.layout) {
        currentLayout.value = arg.quickNoteWindowConfig.layout
      }
    }
  }
})

onMounted(() => {
  loadConfig()
  loadNoteList()
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
.quick-note-window {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;

  &.drag-disabled {
    cursor: default;

    :deep(.drag-bar),
    :deep(.title-bar),
    :deep(.editor-header),
    :deep(.menu-bar) {
      cursor: default;
      -webkit-app-region: no-drag;
    }
  }
}

.mouse-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 100;

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
  width: 100%;
  height: 100%;
  z-index: 1;
}
</style>
