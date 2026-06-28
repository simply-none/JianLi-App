<template>
  <div>
    <el-button type="primary" @click="openAppDialog">
      <el-icon><LucideIcon name="ScanEye" /></el-icon>
      查看默认应用
    </el-button>

    <el-dialog v-model="dialogVisible" title="默认应用" width="600px" v-loading="loading">
      <div class="app-list">
        <div v-for="(item, ext) in defaultAppPaths" :key="ext" class="app-item">
          <span class="app-ext">{{ ext }}</span>
          <span class="app-path">{{ item.path }}</span>
        </div>
        <div v-if="!loading && Object.keys(defaultAppPaths).length === 0" class="empty-tip">
          暂无默认应用数据
        </div>
      </div>
      <template #footer>
        <el-button @click="refreshApps">刷新</el-button>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

const emit = defineEmits(['updateDefaultAppPaths']);

const dialogVisible = ref(false);
const loading = ref(false);

const commonExts = [
  '.mp4', '.avi', '.mov', '.mkv',
  '.mp3', '.wav', '.aac', '.flac',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf', '.txt', '.md', '.html', '.xml', '.json',
  '.zip', '.rar', '.7z', '.tar.gz', '.tar.bz2',
  '.exe', '.dll', '.bat', '.sh', '.py', '.js', '.css', '.sql', '.ini', '.conf', '.log'
];

const defaultAppPaths: Record<string, ObjectType> = reactive({});

function getDefaultFilePath(ext: string) {
  window.ipcRenderer.send('get-default-file-path', { ext });
}

window.ipcRenderer.on('get-default-file-path', (event, { ext, path }) => {
  if (typeof path === 'string' && path !== '') {
    defaultAppPaths[ext] = {
      ext,
      path
    };
    emit('updateDefaultAppPaths', { ...defaultAppPaths });
  }
});

function openAppDialog() {
  dialogVisible.value = true;
  loading.value = true;
  
  Object.keys(defaultAppPaths).forEach(key => {
    delete defaultAppPaths[key];
  });
  
  commonExts.forEach(ext => {
    getDefaultFilePath(ext);
  });
  
  setTimeout(() => {
    loading.value = false;
  }, 2000);
}

function refreshApps() {
  loading.value = true;
  
  Object.keys(defaultAppPaths).forEach(key => {
    delete defaultAppPaths[key];
  });
  
  commonExts.forEach(ext => {
    getDefaultFilePath(ext);
  });
  
  setTimeout(() => {
    loading.value = false;
  }, 2000);
}
</script>

<style scoped lang="scss">
.app-list {
  max-height: 400px;
  overflow-y: auto;
}

.app-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  gap: 16px;

  &:last-child {
    border-bottom: none;
  }
}

.app-ext {
  width: 80px;
  font-weight: 500;
  color: #2c3e50;
  font-family: 'Monaco', 'Menlo', monospace;
  flex-shrink: 0;
}

.app-path {
  flex: 1;
  color: #7f8c8d;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-tip {
  text-align: center;
  color: #95a5a6;
  padding: 40px;
}
</style>