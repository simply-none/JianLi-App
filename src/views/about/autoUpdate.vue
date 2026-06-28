<template>
  <div class="update-card">
    <h2 class="section-title">
      <LucideIcon name="CloudBackup" />
      自动更新
    </h2>
    <div class="update-item">
        <span class="update-label">当前版本</span>
        <el-tag type="info" size="large">v{{ currentVersion }}</el-tag>
      </div>

      <div class="update-item">
        <span class="update-label">检查更新</span>
        <div class="update-actions">
          <el-button
            type="primary"
            :loading="checkLoading"
            :disabled="downloadLoading"
            @click="checkForUpdate"
          >
            {{ hasUpdate ? '发现新版本' : '检查更新' }}
          </el-button>
          <el-tag v-if="checkDone && !hasUpdate" type="success">
            已是最新版本
          </el-tag>
          <el-tag v-if="hasUpdate" type="danger">
            有可用更新: v{{ latestVersion }}
          </el-tag>
        </div>
      </div>

      <div v-if="hasUpdate" class="update-item">
        <span class="update-label">最新版本</span>
        <div class="update-info">
          <div class="update-version">
            <el-tag type="success">v{{ latestVersion }}</el-tag>
            <span v-if="releaseName" class="release-name">{{ releaseName }}</span>
          </div>
          <div v-if="releaseBody" class="release-body">
            <pre>{{ releaseBody }}</pre>
          </div>
          <div v-if="publishedAt" class="release-date">
            发布时间: {{ formatDate(publishedAt) }}
          </div>
        </div>
      </div>

      <div v-if="hasUpdate" class="update-item">
        <span class="update-label">下载更新</span>
        <div class="download-section">
          <div class="download-buttons">
            <el-button
              type="success"
              :loading="downloadLoading"
              :disabled="installReady"
              @click="downloadUpdate"
            >
              {{ downloadLoading ? `下载中 ${downloadProgress}%` : (installReady ? '已下载' : '下载更新') }}
            </el-button>
            <el-button
              v-if="installReady"
              type="warning"
              @click="installUpdate"
            >
              安装并重启
            </el-button>
          </div>
          <el-progress
            v-if="downloadLoading || downloadProgress >= 100"
            :percentage="downloadProgress"
            :status="downloadProgress >= 100 ? 'success' : undefined"
          />
          <div v-if="selectedAsset" class="asset-info">
            安装包: {{ selectedAsset.name }} ({{ formatSize(selectedAsset.size) }})
          </div>
        </div>
      </div>

      <div v-if="releaseUrl" class="update-item">
        <span class="update-label">发布详情</span>
        <el-button type="primary" link @click="openReleaseUrl">
          查看 GitHub 发布页 ↗
        </el-button>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';

// 状态
const currentVersion = ref('');
const latestVersion = ref('');
const releaseName = ref('');
const releaseBody = ref('');
const releaseUrl = ref('');
const publishedAt = ref('');
const assets = ref<any[]>([]);
const selectedAsset = ref<any>(null);

const checkLoading = ref(false);
const checkDone = ref(false);
const hasUpdate = ref(false);

const downloadLoading = ref(false);
const downloadProgress = ref(0);
const installReady = ref(false);
const downloadedFilePath = ref('');

// 检查更新
async function checkForUpdate() {
  checkLoading.value = true;
  checkDone.value = false;
  hasUpdate.value = false;
  installReady.value = false;
  downloadProgress.value = 0;

  try {
    const result = await window.ipcRenderer.handlePromise('check-for-update', {});
    currentVersion.value = result.currentVersion;
    latestVersion.value = result.latestVersion;
    releaseName.value = result.releaseName || '';
    releaseBody.value = result.releaseBody || '';
    releaseUrl.value = result.releaseUrl || '';
    publishedAt.value = result.publishedAt || '';
    assets.value = result.assets || [];

    // 自动选择 Windows exe 安装包（优先 x64）
    selectedAsset.value =
      assets.value.find((a: any) => /\.exe$/i.test(a.name) && /x64/i.test(a.name)) ||
      assets.value.find((a: any) => /\.exe$/i.test(a.name)) ||
      assets.value[0] || null;

    hasUpdate.value = result.hasUpdate;
    checkDone.value = true;

    console.log('检查更新结果:', result);
    if (result.hasUpdate) {
      ElMessage.success(`发现新版本 v${result.latestVersion}`);
    } else {
      ElMessage.info('当前已是最新版本');
    }
  } catch (err: any) {
    console.error('检查更新失败:', err);
    ElMessage.error(err.message || '检查更新失败，请稍后重试');
    checkDone.value = true;
  } finally {
    checkLoading.value = false;
  }
}

// 下载更新
async function downloadUpdate() {
  if (!selectedAsset.value) {
    ElMessage.warning('没有找到可用的安装包');
    return;
  }

  downloadLoading.value = true;
  downloadProgress.value = 0;

  try {
    const result = await window.ipcRenderer.handlePromise('download-update', {
      downloadUrl: selectedAsset.value.downloadUrl,
      fileName: selectedAsset.value.name,
    });

    if (result.success) {
      downloadedFilePath.value = result.filePath;
      installReady.value = true;
      downloadProgress.value = 100;
      ElMessage.success('下载完成，可点击安装');
    }
  } catch (err: any) {
    console.error('下载更新失败:', err);
    ElMessage.error(err.message || '下载失败，请稍后重试');
  } finally {
    downloadLoading.value = false;
  }
}

// 安装更新
async function installUpdate() {
  if (!downloadedFilePath.value) {
    ElMessage.warning('请先下载更新包');
    return;
  }

  try {
    await window.ipcRenderer.handlePromise('install-update', {
      filePath: downloadedFilePath.value,
    });
    ElMessage.success('安装包已打开，请在安装完成后手动关闭旧版应用');
  } catch (err: any) {
    console.error('安装更新失败:', err);
    ElMessage.error(err.message || '安装失败');
  }
}

// 打开 GitHub 发布页
function openReleaseUrl() {
  if (releaseUrl.value) {
    window.ipcRenderer.handlePromise('open-external-url', { url: releaseUrl.value });
  }
}

// 格式化日期
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return moment(dateStr).format('YYYY-MM-DD HH:mm:ss');
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '未知大小';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
}

// 监听下载进度
function onDownloadProgress(_event: any, percent: number) {
  downloadProgress.value = percent;
}

onMounted(async () => {
  // 初始化获取当前应用版本
  try {
    const version = await window.ipcRenderer.handlePromise('get-app-version', {});
    currentVersion.value = version || '';
  } catch (err) {
    console.error('获取应用版本失败:', err);
  }
  window.ipcRenderer.on('download-progress', onDownloadProgress);
});

onUnmounted(() => {
  window.ipcRenderer.off('download-progress', onDownloadProgress);
});
</script>

<style scoped lang="scss">
.update-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 20px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--color-primary);
  }
}

.update-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    border-bottom: none;
  }

  .update-label {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
  }
}

.update-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.update-info {
  width: 100%;

  .update-version {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;

    .release-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
    }
  }

  .release-body {
    padding: 12px 14px;
    background-color: var(--bg-subtle);
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.6;
      font-family: inherit;
      color: var(--text-regular);
    }
  }

  .release-date {
    color: var(--text-secondary);
    font-size: 12px;
    margin-top: 8px;
  }
}

.download-section {
  width: 100%;
}

.download-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.asset-info {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
