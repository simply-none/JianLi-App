<template>
  <div class="shortcut-page">
    <header class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <Keyboard />
        </div>
        <div class="header-text">
          <h1 class="page-title">快捷键注册</h1>
          <p class="page-subtitle">配置全局快捷键，快速访问各项功能</p>
        </div>
      </div>
    </header>

    <main class="page-content">
      <div class="shortcuts-grid">
        <div 
          v-for="(item, index) in allShortcuts" 
          :key="item.key" 
          class="shortcut-card"
        >
          <div class="card-icon" :class="getIconClass(item.key)">
            <component :is="getIcon(item.key)" />
          </div>
          
          <div class="card-info">
            <h3 class="card-title">{{ item.name }}</h3>
            <p class="card-desc">{{ getDescription(item.key) }}</p>
          </div>

          <div class="card-divider"></div>

          <div class="card-shortcut">
            <shortcut 
              :shortcut="item.shortcut" 
              @update:shortcut="(val) => updateShortcut(index, val)"
            />
          </div>

          <div class="card-actions">
            <el-button 
              type="primary" 
              class="register-btn" 
              @click="registerCommonFn(item)"
              :disabled="!canRegister(item.shortcut)"
            >
              <el-icon><Check /></el-icon>
              注册
            </el-button>
            <el-button 
              type="default" 
              class="reset-btn"
              @click="resetShortcut(index)"
            >
              <el-icon><Refresh /></el-icon>
              重置
            </el-button>
          </div>
        </div>
      </div>
    </main>

    <footer class="tips-section">
      <div class="tips-card">
        <div class="tips-header">
          <el-icon><InfoFilled /></el-icon>
          <span>使用说明</span>
        </div>
        <ul class="tips-list">
          <li>⌨️ <strong>键盘输入</strong>：点击按键区域后直接按下键盘上的键</li>
          <li>📋 <strong>下拉选择</strong>：点击按键区域也可以从下拉列表中选择</li>
          <li>⚠️ <strong>快捷键要求</strong>：必须至少选择 2 个按键组合</li>
          <li>🔄 <strong>重复检测</strong>：同一快捷键组合中不允许重复的键</li>
        </ul>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, markRaw } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { 
  Monitor, 
  House, 
  Document, 
  Clock, 
  Files, 
  Connection, 
  Tools, 
  Notebook,
  Check,
  Refresh,
  InfoFilled
} from '@element-plus/icons-vue';
import moment from 'moment';
import shortcut from './shortcut.vue';
import { mergeShortcuts } from '@/utils';

const route = useRoute();

const tableName = ref('register_shortcut')

watch(() => route.path, (newPath) => {
  if (newPath === '/registerShortcut') {
    getShortcut();
  }
}, { immediate: true });

const registerShortcut = (shortcut) => {
  const curTime = moment().format('YYYY-MM-DD HH:mm:ss')
  window.ipcRenderer.handlePromise('set-data', {
    tableName: tableName.value,
    data: {
      ...shortcut,
      createTime: curTime,
      mode: import.meta.env.MODE,
    },
    config: {
      primaryKey: 'key',
    }
  }).then(result => {
    if (result.success) {
      window.ipcRenderer.send('register-shortcut', shortcut)
    } else {
      console.log('设置失败:', result.error);
    }
  })
}

const iconMap = {
  showAppShortcut: markRaw(Monitor),
  homeShortcut: markRaw(House),
  notebookShortcut: markRaw(Document),
  pomodoroRecordShortcut: markRaw(Clock),
  clipboardShortcut: markRaw(Files),
  netRequestShortcut: markRaw(Connection),
  systemInfoShortcut: markRaw(Tools),
  flowShortcut: markRaw(Notebook),
}

const iconClassMap = {
  showAppShortcut: 'icon-blue',
  homeShortcut: 'icon-green',
  notebookShortcut: 'icon-purple',
  pomodoroRecordShortcut: 'icon-orange',
  clipboardShortcut: 'icon-yellow',
  netRequestShortcut: 'icon-cyan',
  systemInfoShortcut: 'icon-red',
  flowShortcut: 'icon-pink',
}

const descriptionMap = {
  showAppShortcut: '快速显示/隐藏应用窗口',
  homeShortcut: '快速跳转到首屏页面',
  notebookShortcut: '快速打开记事本功能',
  pomodoroRecordShortcut: '快速查看番茄钟记录',
  clipboardShortcut: '快速打开剪贴板历史',
  netRequestShortcut: '快速打开网络请求记录',
  systemInfoShortcut: '快速查看系统信息',
  flowShortcut: '快速打开流程图工具',
}

const getIcon = (key) => {
  return iconMap[key] || Monitor
}

const getIconClass = (key) => {
  return iconClassMap[key] || 'icon-blue'
}

const getDescription = (key) => {
  return descriptionMap[key] || ''
}

const originShortcuts = ref([
  {
    type: 'show_app',
    url: '',
    name: '显示应用',
    key: 'showAppShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'home',
    name: '打开首屏',
    key: 'homeShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'notebook',
    name: '打开记事本',
    key: 'notebookShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'pomodoroRecord',
    name: '打开番茄钟记录',
    key: 'pomodoroRecordShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'clipboard',
    name: '打开剪贴板',
    key: 'clipboardShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'netRequest',
    name: '打开网络请求',
    key: 'netRequestShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'systemInfo',
    name: '打开系统信息',
    key: 'systemInfoShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'flow',
    name: '打开流程图',
    key: 'flowShortcut',
    shortcut: ['', '', ''],
  },
])

const allShortcuts = ref([])

const updateShortcut = (index, val) => {
  allShortcuts.value[index].shortcut = val
}

const resetShortcut = (index) => {
  allShortcuts.value[index].shortcut = ['', '', '']
}

const canRegister = (shortcut) => {
  return shortcut.filter(item => item !== '').length >= 2
}

const registerCommonFn = (item) => {
  const isMust = item.shortcut.filter(item => item !== '').length >= 2
  if (!isMust) {
    ElMessage.error('请选择至少两个快捷键')
    return
  }
  const cur = allShortcuts.value.find(c => c.key === item.key)
  if (!cur) {
    return
  }
  registerShortcut({
    ...cur,
    shortcut: item.shortcut.join('+'),
  });
  ElMessage.success('快捷键注册成功')
}

function getShortcut() {
  window.ipcRenderer.handlePromise('query-data', {
    tableName: tableName.value,
    conditions: {
    }
  }).then(result => {
    if (result.success) {
      const r = mergeShortcuts(originShortcuts.value, result.data)
      allShortcuts.value = r.map(item => {
        if (Array.isArray(item.shortcut)) {
          return item
        }
        item.shortcut = item.shortcut.split('+')
        while (item.shortcut.length < 3) {
          item.shortcut.push('')
        }
        return item
      })
    }
  })
}

onMounted(() => {
  getShortcut()
})
</script>

<style scoped lang="scss">
.shortcut-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
}

.page-header {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 20px 24px;
  margin: 20px 24px;

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;

    .el-icon {
      font-size: 24px;
      color: #fff;
    }
  }

  .header-text {
    .page-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .page-subtitle {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0;
    }
  }
}

.page-content {
  flex: 1;
  padding: 0 24px 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 24px;
}

.shortcut-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-card);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .card-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;

    .el-icon {
      font-size: 24px;
      color: #fff;
    }

    &.icon-blue {
      background: linear-gradient(135deg, var(--icon-blue-from) 0%, var(--icon-blue-to) 100%);
    }

    &.icon-green {
      background: linear-gradient(135deg, var(--icon-green-from) 0%, var(--icon-green-to) 100%);
    }

    &.icon-purple {
      background: linear-gradient(135deg, var(--icon-purple-from) 0%, var(--icon-purple-to) 100%);

      .el-icon {
        color: var(--icon-purple-icon);
      }
    }

    &.icon-orange {
      background: linear-gradient(135deg, var(--icon-orange-from) 0%, var(--icon-orange-to) 100%);
    }

    &.icon-yellow {
      background: linear-gradient(135deg, var(--icon-yellow-from) 0%, var(--icon-yellow-to) 100%);
    }

    &.icon-cyan {
      background: linear-gradient(135deg, var(--icon-cyan-from) 0%, var(--icon-cyan-to) 100%);
    }

    &.icon-red {
      background: linear-gradient(135deg, var(--icon-red-from) 0%, var(--icon-red-to) 100%);

      .el-icon {
        color: var(--icon-red-icon);
      }
    }

    &.icon-pink {
      background: linear-gradient(135deg, var(--icon-pink-from) 0%, var(--icon-pink-to) 100%);

      .el-icon {
        color: var(--icon-pink-icon);
      }
    }
  }

  .card-info {
    margin-bottom: 20px;

    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 8px;
    }

    .card-desc {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
    }
  }

  .card-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-color), transparent);
    margin-bottom: 20px;
  }

  .card-shortcut {
    margin-bottom: 20px;
  }

  .card-actions {
    display: flex;
    gap: 12px;

    .register-btn {
      flex: 1;
      height: 40px;
      font-weight: 600;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .reset-btn {
      width: 80px;
      height: 40px;
      border-radius: 8px;

      &:hover {
        background: var(--bg-subtle);
      }
    }
  }
}

.tips-section {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  border-top: 1px solid var(--border-subtle);

  .tips-card {
    background: var(--bg-card);
    border-radius: var(--radius-card);
    padding: 20px 24px;
    box-shadow: var(--shadow-card);
    border-left: 4px solid var(--color-primary);

    .tips-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;

      .el-icon {
        font-size: 18px;
        color: var(--color-primary);
      }

      span {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .tips-list {
      margin: 0;
      padding-left: 20px;

      li {
        font-size: 14px;
        color: var(--text-regular);
        margin-bottom: 8px;

        &:last-child {
          margin-bottom: 0;
        }

        strong {
          color: var(--text-primary);
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .shortcuts-grid {
    grid-template-columns: 1fr;
  }

  .page-header {
    padding: 16px;
    margin: 12px;
  }

  .page-content {
    padding: 0 12px 12px;
  }

  .shortcut-card {
    padding: 20px;
  }

  .tips-section {
    padding: 16px;
  }
}
</style>
