<template>
  <div class="clipboard-page">
    <div class="clipboard-header">
      <div class="clipboard-title">
        <h2>剪贴板历史</h2>
        <p>记录您的复制历史，随时查看和管理</p>
      </div>
      <el-button type="danger" @click="clearAll">
        <LucideIcon name="Trash2" />
        清空全部
      </el-button>
    </div>

    <div class="clipboard-toolbar">
      <div class="search-box">
        <el-icon class="search-icon"><Search /></el-icon>
        <el-input v-model="searchKey" placeholder="搜索剪贴板内容..." clearable />
      </div>
      <div class="toolbar-actions">
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="refresh">重置</el-button>
      </div>
    </div>

    <div class="clipboard-content">
      <el-scrollbar ref="scrollbarRef" class="content-scrollbar" @scroll="handleScroll">
        <div v-if="clipboardItems.length === 0" class="empty-state">
          <el-empty description="暂无剪贴板记录" />
        </div>
        <div v-else class="content-list">
          <div
            v-for="(item, index) in clipboardItems"
            :key="item.id || index"
            class="clipboard-card"
          >
            <div class="card-content">
              <el-input spellcheck="false" v-model="item.text" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" />
            </div>
            <div class="card-footer">
              <span class="card-time">{{ formatTime(item.create_time) }}</span>
              <div class="card-actions">
                <el-button type="primary" size="small" @click="copyToClipboard(item.text)">
                  <LucideIcon name="Copy" :size="12"/>
                  复制
                </el-button>
                <el-button type="danger" size="small" @click="deleteClipboardItem(item)">
                  <LucideIcon name="Trash" :size="12"/>
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="loading" class="loading-state">
          <el-loading text="加载中..." />
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import moment from 'moment'
import LucideIcon from '@/components/LucideIcon.vue'

const scrollbarRef = ref(null)
const clipboardItems = ref([])
const loading = ref(false)
const hasMore = ref(true)

let pageSize = ref(50)
let currentPage = ref(1)
let searchKey = ref('')

function search() {
  currentPage.value = 1
  clipboardItems.value = []
  hasMore.value = true
  getClipboardHistory().then(data => {
    clipboardItems.value = data
  })
}

function refresh() {
  searchKey.value = ''
  currentPage.value = 1
  clipboardItems.value = []
  hasMore.value = true
  getClipboardHistory().then(data => {
    clipboardItems.value = data
  })
}

function handleScroll() {
  const scrollbar = scrollbarRef.value
  if (!scrollbar) return

  const wrap = scrollbar.wrapRef
  if (!wrap) return

  const { scrollTop, scrollHeight, clientHeight } = wrap
  const distance = 100

  if (scrollTop + clientHeight + distance >= scrollHeight) {
    if (!loading.value && hasMore.value) {
      loadMore()
    }
  }
}

function loadMore() {
  loading.value = true
  getClipboardHistory().then(res => {
    clipboardItems.value.push(...res)
    currentPage.value++
    hasMore.value = res.length >= pageSize.value
    loading.value = false
  })
}

function getClipboardHistory() {
  const offset = (currentPage.value - 1) * pageSize.value

  return window.ipcRenderer.handlePromise('query-data', {
    tableName: 'clipboard_history',
    conditions: {
      SqlStr: `SELECT * FROM clipboard_history WHERE text LIKE '%${searchKey.value}%' ORDER BY create_time DESC LIMIT ${pageSize.value} OFFSET ${offset}`,
    }
  }).then(result => {
    if (result.success) {
      return result.data || []
    }
    return []
  }).catch(err => {
    console.log('查询失败:', err)
    return []
  })
}

function formatTime(time) {
  if (!time) return '--'
  const now = moment()
  const itemTime = moment(time)
  const diffDays = now.diff(itemTime, 'days')

  if (diffDays === 0) {
    return itemTime.format('HH:mm:ss')
  } else if (diffDays === 1) {
    return '昨天 ' + itemTime.format('HH:mm')
  } else if (diffDays < 7) {
    return diffDays + '天前'
  } else {
    return itemTime.format('YYYY-MM-DD HH:mm')
  }
}

async function clearAll() {
  try {
    await ElMessageBox.confirm('确定要清空所有剪贴板记录吗？此操作不可恢复。', '确认清空', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const result = await window.ipcRenderer.handlePromise('delete-data', {
      tableName: 'clipboard_history',
      condition: {}
    })

    if (result.success) {
      ElMessage.success('已清空剪贴板历史')
      clipboardItems.value = []
      currentPage.value = 1
      hasMore.value = true
    }
  } catch {
  }
}

function copyToClipboard(text) {
  window.ipcRenderer.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
}

function deleteClipboardItem(item) {
  window.ipcRenderer.handlePromise('delete-data', {
    tableName: 'clipboard_history',
    condition: {
      id: item.id,
    }
  }).then(result => {
    if (result.success) {
      ElMessage.success('删除成功')
      clipboardItems.value = clipboardItems.value.filter(i => i.id !== item.id)
    }
  }).catch(err => {
    ElMessage.error('删除失败')
  })
}

onMounted(() => {
  getClipboardHistory().then(data => {
    clipboardItems.value = data
  })
})
</script>

<style scoped lang="scss">
.clipboard-page {
  width: 100%;
  height: 100%;
  // background: var(--bg-base);
  display: flex;
  flex-direction: column;
  gap: 16px;
  // padding: 20px 24px;
  box-sizing: border-box;
}

.clipboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .clipboard-title {
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }

    p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-muted);
    }
  }
}

.clipboard-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 12px 16px;
  gap: 12px;

  .search-box {
    flex: 1;
    max-width: 400px;
    position: relative;

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 16px;
      z-index: 1;
    }

    :deep(.el-input__wrapper) {
      padding-left: 36px;
      background: var(--bg-base);
      box-shadow: 0 0 0 1px var(--border-subtle) inset;

      &:hover {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }
    }
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;

    .el-button + .el-button {
      margin-left: 0 !important;
    }
  }
}

.clipboard-content {
  flex: 1;
  min-height: 0;

  .content-scrollbar {
    height: 100%;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.content-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

.clipboard-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
  }

  .card-content {
    :deep(.el-textarea__inner) {
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      color: var(--text-primary);
      font-size: 14px;
      line-height: 1.6;

      &:hover {
        border-color: var(--color-primary);
      }

      &:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 1px var(--color-primary) inset;
      }
    }
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid var(--border-subtle);

    .card-time {
      font-size: 12px;
      color: var(--text-muted);
    }

    .card-actions {
      display: flex;
      gap: 8px;
    }
  }
}

.loading-state {
  text-align: center;
  padding: 16px;
}
</style>