<template>
  <div class="backup-card">
    <div class="backup-card-header">
      <LucideIcon name="DatabaseZap" :size="18" />
      <span>整库迁移（移动端互通）</span>
    </div>
    <div class="backup-card-body">
      <!-- 导出：PC → 移动端同格式整库快照 -->
      <div class="block">
        <div class="block-title">
          <LucideIcon name="FileDown" :size="15" />
          <span>导出整库（db_导出_时间戳.sqlite）</span>
        </div>
        <p class="block-desc">
          对 PC 主库 db.sqlite 生成一致快照，文件名与移动端完全一致，可直接拷贝到移动端「数据管理 → 导入」。
          仅含业务数据，本机配置（账户 / 应用锁 / 2FA）不会随文件外泄。
        </p>
        <div class="block-actions">
          <el-button @click="handleSelectExportDir">
            <LucideIcon name="FolderCog" :size="14" />
            {{ exportDir || '选择导出目录' }}
          </el-button>
          <el-button type="primary" :loading="exporting" :disabled="!exportDir" @click="handleExport">
            <LucideIcon name="FileDown" :size="14" />
            导出整库
          </el-button>
        </div>
        <div v-if="exportResult" class="result-box">
          <div class="info-row">
            <span class="info-label">导出文件</span>
            <span class="info-value link" @click="openLocation(exportResult.filePath!)">{{ exportResult.filePath }}（点击打开）</span>
          </div>
          <div class="info-row">
            <span class="info-label">文件大小</span>
            <span class="info-value">{{ formatSize(exportResult.size!) }}</span>
          </div>
        </div>
      </div>

      <el-divider />

      <!-- 导入：移动端 db.sqlite → PC 主库合并 -->
      <div class="block">
        <div class="block-title">
          <LucideIcon name="FileUp" :size="15" />
          <span>导入整库（合并到 PC 主库）</span>
        </div>
        <p class="block-desc">
          选择移动端导出的 db.sqlite，把其中的业务表<b>合并</b>进 PC 主库（按主键 upsert，已有数据被覆盖更新）。
          出于安全考虑，<b>basic_info（本机配置）</b>与 userDb.sqlite（账户 / 2FA）一律不参与，仅操作 db.sqlite。
        </p>
        <div class="block-actions">
          <el-button @click="handleSelectFile">
            <LucideIcon name="FileUp" :size="14" />
            {{ importFile || '选择 .sqlite 文件' }}
          </el-button>
          <el-button type="warning" :loading="importing" :disabled="!importFile" @click="handleImport">
            <LucideIcon name="Replace" :size="14" />
            导入并合并
          </el-button>
        </div>
        <div v-if="importResult" class="result-box">
          <div class="info-row">
            <span class="info-label">合并结果</span>
            <span class="info-value">{{ importResult.message || (importResult.ok ? '成功' : '失败') }}</span>
          </div>
          <div v-if="importResult.needRestart" class="restart-tip">
            <LucideIcon name="RotateCw" :size="14" />
            导入已完成，建议重启应用使各模块缓存完全生效。
          </div>
        </div>
      </div>

      <p class="backup-hint">
        导入为「合并」而非「覆盖」：源有而本机没有的字段会被新增（自增主键等无法新增的列自动跳过），本机多余的字段与表不会被删除。
        少数无主键的流水表（如剪贴板 / 天气历史）可能因此产生重复行，属正常合并行为。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { send } from '@/utils/common';
import { open as confirmOpen } from '@/utils/confirmDialog';
import type { ImportResult } from '../types';
import { selectExportDir, exportSqlite, selectSqliteFile, importSqlite } from '../api/backupApi';

/** 导出目标目录 */
const exportDir = ref('');
/** 是否正在导出 */
const exporting = ref(false);
/** 导出结果 */
const exportResult = ref<{ filePath: string; size: number } | null>(null);

/** 待导入的源文件路径 */
const importFile = ref('');
/** 是否正在导入 */
const importing = ref(false);
/** 导入结果 */
const importResult = ref<ImportResult | null>(null);

/**
 * 选择导出目录
 *
 * @returns {Promise<void>}
 */
async function handleSelectExportDir(): Promise<void> {
  const dir = await selectExportDir();
  if (dir) {
    exportDir.value = dir;
    exportResult.value = null;
  }
}

/**
 * 执行整库导出
 *
 * @returns {Promise<void>}
 */
async function handleExport(): Promise<void> {
  if (exporting.value || !exportDir.value) return;
  exporting.value = true;
  exportResult.value = null;
  try {
    const res = await exportSqlite(exportDir.value);
    if (res.ok && res.filePath) {
      exportResult.value = { filePath: res.filePath, size: res.size || 0 };
      ElMessage.success('整库导出完成');
    } else {
      ElMessage.error('导出失败：' + (res.error || '未知错误'));
    }
  } catch (err: any) {
    ElMessage.error('导出失败：' + (err?.message || String(err)));
  } finally {
    exporting.value = false;
  }
}

/**
 * 选择要导入的 .sqlite 文件
 *
 * @returns {Promise<void>}
 */
async function handleSelectFile(): Promise<void> {
  const file = await selectSqliteFile();
  if (file) {
    importFile.value = file;
    importResult.value = null;
  } else {
    // 用户取消选择不打扰
  }
}

/**
 * 执行整库导入（先二次确认，避免误合并覆盖数据）
 *
 * @returns {Promise<void>}
 */
async function handleImport(): Promise<void> {
  if (importing.value || !importFile.value) return;
  confirmOpen(
    `确认将该文件合并进 PC 主库吗？\n文件：${importFile.value}\n\n合并按主键 upsert（已有数据被更新），basic_info 与账户库不参与；合并后建议重启应用。`,
    5,
    () => doImport(),
  );
}

/**
 * 执行导入并展示结果
 *
 * @returns {Promise<void>}
 */
async function doImport(): Promise<void> {
  importing.value = true;
  importResult.value = null;
  try {
    const res = await importSqlite(importFile.value);
    importResult.value = res;
    if (res.ok) {
      ElMessage({
        type: 'success',
        message: res.message || '导入完成',
        duration: 6000,
        showClose: true,
      });
    } else {
      ElMessage.error('导入失败：' + (res.error || '未知错误'));
    }
  } catch (err: any) {
    ElMessage.error('导入失败：' + (err?.message || String(err)));
  } finally {
    importing.value = false;
  }
}

/**
 * 在资源管理器中定位文件
 *
 * @param {string} filePath - 文件绝对路径
 * @returns {void}
 */
function openLocation(filePath: string): void {
  send('open-file-in-assets-manager', { path: filePath });
}

/**
 * 字节数格式化（人类可读）
 *
 * @param {number} bytes - 字节数
 * @returns {string} 格式化文本
 */
function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
</script>

<style scoped lang="scss">
@use '../styles/backup-shared.scss';

.block {
  & + .block {
    margin-top: 4px;
  }

  .block-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .block-desc {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);

    b {
      color: var(--text-primary);
    }
  }

  .block-actions {
    display: flex;
    align-items: center;
    gap: 12px;

    .el-button:first-child {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.result-box {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);

  .restart-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--color-warning, #e6a23c);
  }
}

:deep(.el-divider) {
  margin: 18px 0;
}
</style>
