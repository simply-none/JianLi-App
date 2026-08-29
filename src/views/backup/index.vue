<template>
  <div class="backup-page">
    <div class="section-header">
      <h3 class="section-title">
        <LucideIcon name="HardDriveDownload" />
        备份与恢复
      </h3>
    </div>

    <el-tabs v-model="activeTab" class="backup-tabs">
      <!-- 备份与恢复 -->
      <el-tab-pane label="备份与恢复" name="backup">
        <BackupInfoCard :info="info" @created="refresh" @refresh="refresh" />
        <BackupListCard :backups="backups" @refresh="refresh" />
      </el-tab-pane>

      <!-- 自动备份 -->
      <el-tab-pane label="自动备份" name="auto">
        <AutoBackupCard :config="info?.autoConfig || null" @change="refresh" />
      </el-tab-pane>

      <!-- 数据导出 -->
      <el-tab-pane label="数据导出" name="export">
        <ExportCenterCard />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import type { BackupInfo, BackupListItem } from './types';
import { getBackupInfo, listBackups } from './api/backupApi';
import BackupInfoCard from './components/BackupInfoCard.vue';
import BackupListCard from './components/BackupListCard.vue';
import AutoBackupCard from './components/AutoBackupCard.vue';
import ExportCenterCard from './components/ExportCenterCard.vue';

/** 当前激活的 Tab */
const activeTab = ref('backup');

/** 备份概况信息 */
const info = ref<BackupInfo | null>(null);
/** 备份文件列表 */
const backups = ref<BackupListItem[]>([]);

onMounted(refresh);

/**
 * 刷新概况与备份列表（子组件操作成功后也会回调此方法）
 *
 * @returns {Promise<void>}
 */
async function refresh(): Promise<void> {
  try {
    info.value = await getBackupInfo();
  } catch (err) {
    console.error('加载备份概况失败:', err);
  }
  try {
    backups.value = await listBackups();
  } catch (err) {
    console.error('加载备份列表失败:', err);
  }
}
</script>

<style scoped lang="scss">
.backup-page {
  width: 100%;
}

.section-header {
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid transparent;
  background: linear-gradient(90deg, var(--color-primary), transparent) no-repeat left bottom / 100% 1px;

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

.backup-tabs {
  :deep(.el-tabs__item) {
    font-size: 14px;
  }
}
</style>
