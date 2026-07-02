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
