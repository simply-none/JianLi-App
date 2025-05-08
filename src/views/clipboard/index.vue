<template>
  <div class="clipboard">
    <el-card class="clipboard-card">
      <template #header>
        <div class="card-header">
          <span>剪切板历史</span>
          <el-button 
            type="primary" 
            size="small" 
            @click="clearClipboard"
            :disabled="!clipboardItems.length"
          >
            清空
          </el-button>
        </div>
      </template>
      
      <el-scrollbar height="400px">
        <el-timeline>
          <el-timeline-item
            v-for="(item, index) in clipboardItems"
            :key="index"
            :timestamp="item.timestamp"
            placement="top"
          >
            <el-card class="clipboard-item" shadow="hover">
              <div class="item-content">
                <el-tooltip 
                  :content="item.content" 
                  placement="top"
                  :disabled="item.content.length <= 50"
                >
                  <span>{{ truncateText(item.content) }}</span>
                </el-tooltip>
                <el-button 
                  type="success" 
                  size="small" 
                  @click="copyToClipboard(item.content)"
                >
                  复制
                </el-button>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </el-scrollbar>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const clipboardItems = ref([])

window.ipcRenderer.on('clipboard-change', (event, arg) => {
  console.log(arg, 'clipboard-change')
})

// 获取剪切板历史
function getClipboardHistory() {
  // 这里使用 Electron 的 clipboard 模块
  // const clipboard = window.electron.clipboard
  // 获取历史记录的逻辑
  // 示例数据
  clipboardItems.value = [
    {
      content: '这是一条剪切板内容',
      timestamp: '2023-10-01 10:00:00'
    },
    // 更多记录...
  ]
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

// 截断长文本
function truncateText(text, maxLength = 50) {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

onMounted(() => {
  getClipboardHistory()
})
</script>

<style scoped lang="scss">
.clipboard {
  padding: 20px;

  &-card {
    max-width: 800px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &-item {
    margin: 10px 0;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 8px;

    .item-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
    }
  }
}
</style>