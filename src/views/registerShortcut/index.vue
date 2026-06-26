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
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
}

.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 32px 24px;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
  
  .header-content {
    display: flex;
    align-items: center;
    gap: 20px;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .header-icon {
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    
    .el-icon {
      font-size: 32px;
      color: #fff;
    }
  }
  
  .header-text {
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 8px;
    }
    
    .page-subtitle {
      font-size: 15px;
      color: rgba(255, 255, 255, 0.8);
      margin: 0;
    }
  }
}

.page-content {
  flex: 1;
  padding: 32px 24px;
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
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
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
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    
    &.icon-green {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
    
    &.icon-purple {
      background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
      
      .el-icon {
        color: #667eea;
      }
    }
    
    &.icon-orange {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
    
    &.icon-yellow {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    
    &.icon-cyan {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    
    &.icon-red {
      background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
      
      .el-icon {
        color: #ff6b6b;
      }
    }
    
    &.icon-pink {
      background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
      
      .el-icon {
        color: #ff8a65;
      }
    }
  }
  
  .card-info {
    margin-bottom: 20px;
    
    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 8px;
    }
    
    .card-desc {
      font-size: 13px;
      color: #909399;
      margin: 0;
    }
  }
  
  .card-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #e4e7ed, transparent);
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
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
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
        background: #f5f7fa;
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

  .tips-card {
    background: #fff;
    border-radius: 16px;
    padding: 20px 24px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    border-left: 4px solid #667eea;
    
    .tips-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      
      .el-icon {
        font-size: 18px;
        color: #667eea;
      }
      
      span {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }
    }
    
    .tips-list {
      margin: 0;
      padding-left: 20px;
      
      li {
        font-size: 14px;
        color: #606266;
        margin-bottom: 8px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        strong {
          color: #303133;
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
    padding: 24px 16px;
    
    .header-content {
      flex-direction: column;
      text-align: center;
    }
    
    .page-title {
      font-size: 24px;
    }
  }
  
  .page-content {
    padding: 20px 16px;
  }
  
  .shortcut-card {
    padding: 20px;
  }

  .tips-section {
    padding: 0 16px 20px;
  }
}
</style>
