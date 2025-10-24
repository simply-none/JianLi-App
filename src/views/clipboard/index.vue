<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">剪切板历史</div>
      </template>
    </el-form-item>

    <el-form-item label="剪切板历史" class="mode-wrapper">
      <el-timeline>
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
import { useRoute, useRouter } from 'vue-router'

// 判断路由变更
const route = useRoute()
watch(() => route.path, (newPath) => {
  if (newPath !== '/clipboard') return
  getClipboardHistory()
})


const clipboardItems = ref([])

// 获取剪切板历史
function getClipboardHistory() {
  window.ipcRenderer.handlePromise('query-data', {
    tableName: 'clipboard_history',
    conditions: {
      orderBy: 'create_time',
      orderByDesc: true,
      limit: 100
    }
  }).then(result => {
    if (result.success) {
      clipboardItems.value = result.data
    }
  }).catch(err => {
    console.log('查询失败:', err);
  })
}

// 清空剪切板
function clearClipboard() {
  clipboardItems.value = []
  ElMessage.success('已清空剪切板历史')
}

// 复制到剪切板
function copyToClipboard(text) {
  window.electron.clipboard.writeText(text)
  ElMessage.success('已复制到剪切板')
}

// 删除剪切板历史
function deleteClipboardItem(item) {
  console.log(item)
  window.ipcRenderer.handlePromise('delete-data', {
    tableName: 'clipboard_history',
    condition: {
      id: item.id,
    }
  }).then(result => {
    console.log(result, '删除剪切板历史')

    if (result.success) {
      ElMessage.success('删除成功')
      getClipboardHistory()
    }
  }).catch(err => {
    console.log('删除失败:', err);
  })

}

onMounted(() => {
  getClipboardHistory()
})
</script>

<style scoped lang="scss">
.fileRela-form {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
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
</style>