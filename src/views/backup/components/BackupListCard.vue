<template>
  <div class="backup-card">
    <div class="backup-card-header">
      <LucideIcon name="ArchiveRestore" :size="18" />
      <span>备份列表</span>
      <div class="header-extra">
        <el-tag size="small" type="info">{{ backups.length }} 份</el-tag>
      </div>
    </div>
    <div class="backup-card-body">
      <el-empty v-if="backups.length === 0" description="暂无备份，点击上方「立即备份」创建" :image-size="80" />

      <div v-else class="backup-list">
        <div v-for="item in backups" :key="item.fileName" class="backup-item">
          <div class="item-main">
            <div class="item-title">
              <LucideIcon :name="typeIcon(item.manifest?.type)" :size="15" />
              <span class="file-name" :title="item.fileName">{{ item.fileName }}</span>
              <el-tag v-if="item.manifest?.type === 'auto'" size="small" type="info">自动</el-tag>
              <el-tag v-else-if="item.manifest?.type === 'safety'" size="small" type="warning">安全</el-tag>
              <el-tag v-else size="small">手动</el-tag>
              <el-tag v-if="!item.manifest" size="small" type="danger">文件损坏</el-tag>
            </div>
            <div class="item-meta">
              {{ item.manifest?.createdAtText || '未知时间' }} · {{ formatSize(item.size) }}
              <template v-if="item.manifest"> · v{{ item.manifest.appVersion }}</template>
              <template v-if="item.manifest?.note"> · {{ item.manifest.note }}</template>
            </div>
            <div v-if="item.manifest?.databases?.length" class="item-tables">
              {{ tableSummary(item.manifest) }}
            </div>
          </div>
          <div class="item-actions">
            <el-button size="small" type="primary" :disabled="!item.manifest" @click="handleRestore(item)">
              <LucideIcon name="ArchiveRestore" :size="14" />
              恢复
            </el-button>
            <el-button size="small" @click="openLocation(item.filePath)">
              <LucideIcon name="FolderOpen" :size="14" />
              位置
            </el-button>
            <el-button size="small" type="danger" plain @click="handleDelete(item)">
              <LucideIcon name="Trash2" :size="14" />
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { open as confirmOpen } from '@/utils/confirmDialog';
import { send } from '@/utils/common';
import type { BackupListItem, BackupType } from '../types';
import { restoreBackup, deleteBackup } from '../api/backupApi';

/** 组件入参：备份列表（父页面加载传入） */
defineProps<{
  /** 备份文件列表 */
  backups: BackupListItem[];
}>();

/** 组件事件：refresh 请求父页面刷新概况与列表 */
const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

/**
 * 根据备份类型返回展示图标名
 *
 * @param {BackupType} [type] - 备份类型
 * @returns {string} 图标名称
 */
function typeIcon(type?: BackupType): string {
  if (type === 'auto') return 'FolderSync';
  if (type === 'safety') return 'ShieldCog';
  return 'FileArchive';
}

/**
 * 汇总备份中各库的表数量与总行数，作为恢复前预览
 *
 * @param {BackupListItem['manifest']} manifest - 备份清单
 * @returns {string} 摘要文本，如：db.sqlite 12 表 3456 行；userDb.sqlite 2 表 10 行
 */
function tableSummary(manifest: NonNullable<BackupListItem['manifest']>): string {
  return manifest.databases
    .map((db) => {
      const totalRows = db.tables.reduce((sum, t) => sum + t.rows, 0);
      return `${db.name} ${db.tables.length} 表 ${totalRows} 行`;
    })
    .join('；');
}

/**
 * 恢复备份：二次确认（含破坏性警示）→ 调用主进程恢复 → 成功后提示重启
 *
 * @param {BackupListItem} item - 要恢复的备份项
 * @returns {Promise<void>}
 */
function handleRestore(item: BackupListItem): void {
  const created = item.manifest?.createdAtText || item.fileName;
  confirmOpen(
    `确认恢复该备份吗？当前数据将被覆盖！\n备份时间：${created}\n（恢复前会自动创建一份安全备份）`,
    5,
    async () => {
      try {
        const res = await restoreBackup(item.fileName);
        if (res.ok) {
          emit('refresh');
          ElMessage({
            type: 'success',
            message: '恢复成功，请重启应用使所有模块数据完全生效',
            duration: 8000,
            showClose: true,
          });
        } else {
          ElMessage.error('恢复失败：' + (res.error || '未知错误'));
        }
      } catch (err: any) {
        ElMessage.error('恢复失败：' + (err?.message || String(err)));
      }
    }
  );
}

/**
 * 在资源管理器中定位备份文件
 *
 * @param {string} filePath - 文件绝对路径
 * @returns {void}
 */
function openLocation(filePath: string): void {
  send('open-file-in-assets-manager', { path: filePath });
}

/**
 * 删除备份：二次确认后删除并刷新列表
 *
 * @param {BackupListItem} item - 要删除的备份项
 * @returns {Promise<void>}
 */
function handleDelete(item: BackupListItem): void {
  confirmOpen(`确认删除备份「${item.fileName}」吗？删除后不可恢复。`, 3, async () => {
    try {
      const res = await deleteBackup(item.fileName);
      if (res.ok) {
        ElMessage.success('删除成功');
        emit('refresh');
      } else {
        ElMessage.error('删除失败：' + (res.error || '未知错误'));
      }
    } catch (err: any) {
      ElMessage.error('删除失败：' + (err?.message || String(err)));
    }
  });
}

/**
 * 格式化文件大小展示
 *
 * @param {number} size - 字节数
 * @returns {string} 人类可读大小文本
 */
function formatSize(size: number): string {
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / 1024 / 1024).toFixed(2) + ' MB';
}
</script>

<style scoped lang="scss">
@use '../styles/backup-shared.scss';

.backup-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 480px;
  overflow-y: auto;
}

.backup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
  }

  .item-main {
    flex: 1;
    min-width: 0;

    .item-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);

      .file-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .item-meta {
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .item-tables {
      margin-top: 2px;
      font-size: 12px;
      color: var(--text-muted);
    }
  }

  .item-actions {
    display: flex;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
  }
}
</style>
