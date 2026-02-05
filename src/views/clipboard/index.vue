<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">剪切板历史</div>
      </template>
    </el-form-item>

    <el-form-item label="关键字查询" class="mode-wrapper fixed">
      <div class="fileRela-form-search">
        <el-input v-model="searchKey" placeholder="请输入关键字查询剪切板历史"></el-input>
        <el-button type="primary"  @click="search">查询</el-button>
        <el-button  @click="refresh">重置</el-button>
      </div>
    </el-form-item>

    <el-form-item label="剪切板历史" class="mode-wrapper">
      <el-timeline v-infinite-scroll="load" :infinite-scroll-distance="100">
        <el-timeline-item v-for="(item, index) in clipboardItems" :key="index" :timestamp="item.create_time"
          placement="top">
          <el-card class="clipboard-item" shadow="hover">
            <div class="item-content">
              <el-input spellcheck="false" v-model="item.text" type="textarea" :autosize="{ minRows: 1, maxRows: 30 }" />

            </div>
            <div class="item-actions">
              <el-button type="success" size="small" @click="copyToClipboard(item.text)">
                复制
              </el-button>
              <!-- 删除 -->
              <el-button type="danger" size="small" @click="deleteClipboardItem(item)">删除</el-button>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'

const clipboardItems = ref([])

let pageSize = ref(50)
let currentPage = ref(1)
let searchKey = ref('')

function search() {
  currentPage.value = 1
  clipboardItems.value = []
  getClipboardHistory(searchKey.value).then(data => {
    clipboardItems.value = data
  })
}

function refresh() {
  searchKey.value = ''
  currentPage.value = 1
  clipboardItems.value = []
  getClipboardHistory().then(data => {
    clipboardItems.value = data
  })
}

// 获取剪切板历史
function getClipboardHistory() {
  const offset = (currentPage.value - 1) * pageSize.value;

  return window.ipcRenderer.handlePromise('query-data', {
    tableName: 'clipboard_history',
    conditions: {
      whereStr: `text LIKE '%${searchKey.value}%' ORDER BY create_time DESC LIMIT ${pageSize.value} OFFSET ${offset}`,
    }
  }).then(result => {
    if (result.success) {
      return result.data || [];
    }
    return [];
  }).catch(err => {
    console.log('查询失败:', err);
    return [];
  });
}

// 清空剪切板
function clearClipboard() {
  clipboardItems.value = []
  ElMessage.success('已清空剪切板历史')
}

// 复制到剪切板
function copyToClipboard(text) {
  window.ipcRenderer.clipboard.writeText(text)
  ElMessage.success('已复制到剪切板')
}

// 删除剪切板历史
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

function load() {
  getClipboardHistory().then(res => {
    clipboardItems.value.push(...res);
    currentPage.value++
  })
}

</script>

<style scoped lang="scss">
.fileRela-form {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  position: relative;
  &-search {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 12px;
    .el-button + .el-button {
      margin-left: 0 !important;
    }
  }
}

.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.el-timeline {
  width: 100%;
}

.clipboard-item {
  margin: 10px 0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
}

.item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 10px;

}

.fixed {
  position: sticky;
  background-color: #fff;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 999;
}
</style>