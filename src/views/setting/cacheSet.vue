<template>
  <div class="cache-set">
    <div class="cache-card">
      <div class="cache-card-header">
        <LucideIcon name="FolderOpen" :size="20" />
        <span>文件存放目录</span>
      </div>
      <div class="cache-card-body">
        <div class="path-display">
          <LucideIcon name="Folder" :size="18" class="path-icon" />
          <span class="path-text" :title="fileCachePathCc">{{ fileCachePathCc || '请选择文件存放目录' }}</span>
        </div>
        <el-button type="primary" @click="selectFileDir" class="select-btn">
          <LucideIcon name="FolderPlus" />
          选择目录
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useCacheSetStore from '@/store/useCacheSet';
import { sendSync } from '@/utils/common';

const { fileCachePathC } = storeToRefs(useCacheSetStore());
const { setFileCachePath } = useCacheSetStore();

const fileCachePathCc = ref(fileCachePathC.value);

watch(() => fileCachePathC.value, (newVal) => {
  fileCachePathCc.value = newVal;
});

function selectFileDir() {
  const res = sendSync('get-file-list', 'select-dir');
  if (Array.isArray(res)) {
    fileCachePathCc.value = res[0];
    setFileCachePath(fileCachePathCc.value);
  }
}
</script>

<style scoped lang="scss">
.cache-set {
  width: 100%;
}

.cache-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 20px;
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
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-subtle);

    .el-icon {
      color: var(--color-primary);
    }
  }

  .cache-card-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;

    .path-display {
      flex: 1;
      min-width: 200px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg-hover);
      border-radius: 8px;
      padding: 12px 16px;

      .path-icon {
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .path-text {
        font-size: 14px;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .select-btn {
      flex-shrink: 0;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
    }
  }
}
</style>