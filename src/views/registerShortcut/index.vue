<template>
  <div class="shortcut-page">
    <header class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <LucideIcon name="Keyboard" :size="24" />
        </div>
        <div class="header-text">
          <h1 class="page-title">快捷键注册</h1>
          <p class="page-subtitle">配置全局快捷键，快速访问各项功能</p>
        </div>
      </div>
      <div>
        <el-button title="获取快捷键" size="large" type="primary" @click="getShortcuts">
          <LucideIcon name="Keyboard" :size="18" />
          获取注册快捷键
        </el-button>
      </div>
    </header>

    <main class="page-content">
      <div v-if="!shortcutGroups || shortcutGroups.length == 0" class="result-empty">
        <LucideIcon name="Crop" :size="40" />
        <p>点击右上角「获取注册快捷键」按钮 即可开始</p>
        <p class="tip">提示：点击右上角「获取注册快捷键」按钮 即可开始</p>
      </div>
      <template v-else>
        <section v-for="group in shortcutGroups" :key="group.title" class="shortcut-section">
          <h2 class="section-title">{{ group.title }}</h2>
          <div class="shortcuts-grid">
            <div v-for="item in group.items" :key="item.key" class="shortcut-card">
              <div class="card-icon" :class="getIconClass(item.key)">
                <LucideIcon :name="getIcon(item.key)" :size="24" />
              </div>

              <div class="card-info">
                <h3 class="card-title">{{ item.name }}</h3>
                <p class="card-desc" v-if="getDescription(item.key)">{{ getDescription(item.key) }}</p>
              </div>

              <div class="card-divider"></div>

              <div class="card-shortcut">
                <shortcut :shortcut="item.shortcut" @update:shortcut="(val) => item.shortcut = val" />
              </div>

              <div class="card-actions">
                <el-button type="primary" class="register-btn" @click="registerFn(item)"
                  :disabled="!canRegister(item.shortcut)">
                  <LucideIcon name="Check" :size="14" />
                  注册
                </el-button>
                <el-button type="default" class="reset-btn" @click="resetShortcut(item)">
                  <LucideIcon name="RefreshCcw" :size="14" />
                  重置
                </el-button>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>

    <footer class="tips-section">
      <div class="tips-card">
        <div class="tips-header">
          <LucideIcon name="Info" :size="18" />
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
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { layoutRouters } from '@/router';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
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

// 落库并通知主进程注册全局快捷键；全程异步，不阻塞渲染
const registerShortcut = async (shortcut) => {
  const curTime = moment().format('YYYY-MM-DD HH:mm:ss')
  const result = await window.ipcRenderer.handlePromise('new-sql:upsert', {
    tableName: tableName.value,
    data: {
      ...shortcut,
      createTime: curTime,
      mode: import.meta.env.MODE,
    },
    config: {
      primaryKey: 'key',
    }
  })
  if (result.success) {
    window.ipcRenderer.send('register-shortcut', shortcut)
  } else {
    console.log('设置失败:', result.error)
  }
}

const iconMap = {
  showAppShortcut: 'Monitor',
  homeShortcut: 'House',
  notebookShortcut: 'Notebook',
  pomodoroRecordShortcut: 'Clock',
  clipboardShortcut: 'Folder',
  netRequestShortcut: 'Globe',
  systemInfoShortcut: 'Toolbox',
  flowShortcut: 'Notebook',
  quickNoteShortcut: 'SquarePen',
  todoWindowShortcut: 'CircleCheckBig',
  pomodoroWindowShortcut: 'Timer',
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
  quickNoteShortcut: 'icon-indigo',
  todoWindowShortcut: 'icon-green',
  pomodoroWindowShortcut: 'icon-orange',
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
  quickNoteShortcut: '快速打开/关闭快速记录小窗口',
  todoWindowShortcut: '快速打开/关闭待办小窗口',
  pomodoroWindowShortcut: '快速打开/关闭番茄钟小窗口',
}

// 路由功能快捷键统一使用 Route 图标，且不展示描述
const ROUTE_SHORTCUT_PREFIX = 'routeShortcut:'

const getIcon = (key) => {
  if (key.startsWith(ROUTE_SHORTCUT_PREFIX)) return 'Route'
  return iconMap[key] || 'monitor'
}

const getIconClass = (key) => {
  if (key.startsWith(ROUTE_SHORTCUT_PREFIX)) return 'icon-blue'
  return iconClassMap[key] || 'icon-blue'
}

const getDescription = (key) => {
  if (key.startsWith(ROUTE_SHORTCUT_PREFIX)) return ''
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
  {
    type: 'open_quick_note',
    url: '',
    name: '快速记录',
    key: 'quickNoteShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_todo_window',
    url: '',
    name: '待办小窗口',
    key: 'todoWindowShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_pomodoro_window',
    url: '',
    name: '番茄钟小窗口',
    key: 'pomodoroWindowShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_clipboard_window',
    url: '',
    name: '剪贴板快速粘贴',
    key: 'clipboardWindowShortcut',
    shortcut: ['', '', ''],
  },
])

// 路由功能：基于 layoutRouters 动态生成，所有布局内路由均可注册快捷键。
// 复用既有 open_match_page 触发链路（主进程 openMatchPage -> 渲染端 open-match-page -> router.push({ name: url })）。
const routeShortcuts = ref(
  layoutRouters.map((r) => ({
    type: 'open_match_page',
    url: r.name,
    name: (r.meta && r.meta.title) || r.name,
    key: `${ROUTE_SHORTCUT_PREFIX}${r.name}`,
    shortcut: ['', '', ''],
  }))
)

// 初始即用默认快捷键列表渲染，避免等待异步查询导致卡片区域延迟出现
const allCommonShortcuts = ref(JSON.parse(JSON.stringify(originShortcuts.value)))
const allRouteShortcuts = ref(JSON.parse(JSON.stringify(routeShortcuts.value)))

// 分类分组：常用功能（既有列表） + 路由功能（layoutRouters 全量）
const shortcutGroups = ref([])

const getShortcuts = () => {
  shortcutGroups.value = [
    { title: '常用功能', items: originShortcuts.value },
    { title: '路由功能', items: allRouteShortcuts.value },
  ]
}

const resetShortcut = (item) => {
  item.shortcut = ['', '', '']
}

const canRegister = (shortcut) => {
  return shortcut.filter(item => item !== '').length >= 2
}

// 常用功能与路由功能共用同一注册逻辑：校验 -> 落库并通知主进程注册全局快捷键
const registerFn = (item) => {
  const isMust = item.shortcut.filter(s => s !== '').length >= 2
  if (!isMust) {
    ElMessage.error('请选择至少两个快捷键')
    return
  }
  registerShortcut({
    ...item,
    shortcut: item.shortcut.join('+'),
  });
  ElMessage.success('快捷键注册成功')
}

// 将数据库中以 '+' 连接的快捷键字符串归一化为长度为 3 的数组
function normalizeShortcut(item) {
  if (typeof item.shortcut === 'string') {
    item.shortcut = item.shortcut.split('+')
  }
  while (item.shortcut.length < 3) {
    item.shortcut.push('')
  }
  return item
}

// 从数据库拉取已保存的快捷键并合并到默认列表；异步执行，不阻塞首次渲染
async function getShortcut() {
  const result = await window.ipcRenderer.handlePromise('new-sql:query', {
    tableName: tableName.value,
    conditions: {}
  })
  if (result.success) {
    const data = result.data
    allCommonShortcuts.value = mergeShortcuts(originShortcuts.value, data).map(normalizeShortcut)
    allRouteShortcuts.value = mergeShortcuts(routeShortcuts.value, data).map(normalizeShortcut)
  }
}
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
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
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
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.shortcut-section {
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px;
    padding-left: 12px;
    border-left: 4px solid var(--color-primary);
    line-height: 1.2;
  }
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

    &.icon-indigo {
      background: linear-gradient(135deg, var(--icon-cyan-from) 0%, var(--icon-cyan-to) 100%);
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
        background: var(--bg-base);
      }
    }
  }
}

.tips-section {
  padding: 24px;
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

.result-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  text-align: center;
  height: 100%;
  display: flex;
  justify-content: center;

  p {
    margin: 0;
    font-size: 13px;
  }

  .tip {
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.8;
  }
}
</style>
