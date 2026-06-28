<template>
  <div class="app-cache">
    <div class="section-header">
      <h3 class="section-title">
        <LucideIcon name="FolderOpen" />
        应用缓存
      </h3>
    </div>

    <div class="cache-card">
      <div class="cache-card-header">
        <LucideIcon name="CloudBackup" :size="18" />
        <span>数据还原</span>
      </div>
      <div class="cache-card-body">
        <UploadVue :limit="1" @updateData="handleChange">
          <template #btnHandle>
            <div></div>
          </template>
        </UploadVue>

        <div v-if="Object.keys(uploadCacheData).length > 0" class="restore-preview">
          <div class="preview-header">
            <span class="preview-title">待还原数据预览</span>
            <el-button type="primary" @click="restore" class="restore-btn">
              <el-icon><RefreshLeft /></el-icon>
              备份还原
            </el-button>
          </div>
          <div class="preview-content">
            <JsonTree :data="uploadCacheData" />
          </div>
        </div>
      </div>
    </div>

    <div class="cache-card">
      <div class="cache-card-header">
        <el-icon :size="18"><Box /></el-icon>
          <span>当前缓存数据</span>
      </div>
      <div class="cache-card-body">
        <div class="cache-data-content">
          <JsonTree :data="cacheData" />
        </div>
      </div>
    </div>

    <div class="cache-card">
      <div class="cache-card-header">
          <LucideIcon name="CloudSync" :size="18" />
        <span>数据备份</span>
      </div>
      <div class="cache-card-body">
        <el-button type="primary" @click="generateRestore" class="backup-btn">
                    <LucideIcon name="CloudUpload" :size="18" />
          开始备份
        </el-button>
        <p class="backup-hint">备份文件将保存到设置的缓存目录中</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, toRaw } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import useCacheSetStore from '@/store/useCacheSet';
import { send, sendSync } from '@/utils/common';
import moment from 'moment';
import UploadVue from '@/components/upload.vue';
import JsonTree from '@/components/JsonTree.vue';
import { open } from '@/utils/confirmDialog';

const { fileCachePathC } = storeToRefs(useCacheSetStore());
const cacheData = ref<ObjectType>({});
const uploadCacheData = ref<ObjectType>({});

getCacheData();

function getCacheData() {
  const res = sendSync('get-stort-all', '');
  cacheData.value = res;
}

function generateRestore() {
  const data = toRaw(cacheData.value);
  const path = fileCachePathC.value + '/渐离App数据备份_' + moment().format('YYYY-MM-DD_HH-mm-ss') + '.json';
  const res = sendSync('export-data-to-json', {
    path,
    data,
  });
  if (res == 'ok') {
    const msg = ElMessage({
      duration: 0,
      showClose: true,
      message: h('p', { style: 'line-height: 1; font-size: 14px' }, [
        h('div', {
          style: 'font-size: 16px;font-weight: 600;',
        }, '备份成功'),
        h('div', {
          style: 'padding-top: 12px;',
        }, {
          default: () => '备份路径:' + path,
        }),
        h('div', {
          style: 'color: #409eff;padding: 12px 0;cursor: pointer;',
          onClick: () => {
            send('open-file-in-assets-manager', {
              path,
            });
            msg.close();
          },
        }, '点击打开'),
      ]),
    });
  } else {
    ElMessage.error('备份失败');
  }
}

function handleChange(uploadRef: any, fileList: any) {
  const file = fileList[0].raw as unknown as any;
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function (e: any) {
    const res = reader.result as string;
    uploadCacheData.value = JSON.parse(res || '') || {};
  };
}

function restore() {
  open(
    '确认还原数据吗？',
    15,
    restoreData,
  );
}

function restoreData() {
  const data = toRaw(uploadCacheData.value);
  const length = Object.keys(data).length;
  if (length <= 0) {
    ElMessage.error('请选择备份文件');
    return;
  }
  const res = sendSync('replace-store', data);
  ElMessage.success('还原成功');
}
</script>

<style scoped lang="scss">
.app-cache {
  width: 100%;
}

.section-header {
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--color-primary);

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;

    .el-icon {
      color: var(--color-primary);
    }
  }
}

.cache-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  margin-bottom: 16px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
  }

  .cache-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);

    .el-icon {
      color: var(--color-primary);
    }
  }

  .cache-card-body {
    padding: 20px;
  }
}

.restore-preview {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    .preview-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .restore-btn {
      font-size: 13px;
      padding: 6px 14px;
    }
  }

  .preview-content {
    background: var(--bg-hover);
    border-radius: 8px;
    padding: 12px;
    max-height: 300px;
    overflow-y: auto;
  }
}

.backup-btn {
  font-size: 14px;
  padding: 10px 20px;
  font-weight: 500;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.backup-hint {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 0;
}

.cache-data-content {
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}
</style>