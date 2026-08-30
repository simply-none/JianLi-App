<template>
  <div class="backup-card">
    <div class="backup-card-header">
      <LucideIcon name="ArchiveRestore" :size="18" />
      <span>数据还原与操作说明</span>
      <div class="header-extra">
        <el-button type="success" size="small" @click="handlePickFile">
          <LucideIcon name="FileUp" :size="14" />
          从文件恢复
        </el-button>
      </div>
    </div>
    <div class="backup-card-body">
      <!-- 操作说明 -->
      <div class="guide">
        <div class="guide-item">
          <span class="guide-step">1</span>
          <div class="guide-text">
            <b>备份数据</b>：点击下方「立即备份」生成 .jlbak 备份文件；也可在「自动备份」页开启定时备份。
          </div>
        </div>
        <div class="guide-item">
          <span class="guide-step">2</span>
          <div class="guide-text">
            <b>恢复数据（方式一）</b>：在下方「备份列表」中找到目标备份，点击该条目右侧的<b>「恢复」</b>按钮。
          </div>
        </div>
        <div class="guide-item">
          <span class="guide-step">3</span>
          <div class="guide-text">
            <b>恢复数据（方式二）</b>：其他电脑或手动保存的备份文件，点击右上角<b>「从文件恢复」</b>选择 .jlbak 文件恢复。
          </div>
        </div>
        <div class="guide-item">
          <span class="guide-step">4</span>
          <div class="guide-text">
            <b>注意事项</b>：恢复会<b>覆盖当前全部数据</b>（恢复前会自动创建一份安全备份）；恢复完成后需<b>重启应用</b>使所有模块数据生效。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { open as confirmOpen } from '@/utils/confirmDialog';
import type { BackupManifest } from '../types';
import { selectBackupFile, restoreFromPath } from '../api/backupApi';

/** 组件事件：refresh 恢复成功后请求父页面刷新概况与列表 */
const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

/** 恢复执行中标记（防重复点击） */
const restoring = ref(false);

/**
 * 汇总备份清单的可读描述（时间/版本/各库表行数），用于恢复前确认
 *
 * @param {BackupManifest} manifest - 备份清单
 * @returns {string} 摘要文本
 */
function summaryText(manifest: BackupManifest): string {
  const dbs = manifest.databases
    .map((db) => {
      const totalRows = db.tables.reduce((sum, t) => sum + t.rows, 0);
      return `${db.name}（${db.tables.length} 表 / ${totalRows} 行）`;
    })
    .join('、');
  return `${manifest.createdAtText} · v${manifest.appVersion} · ${dbs}`;
}

/**
 * 从外部文件恢复：选择 .jlbak → 展示备份信息并二次确认 → 执行恢复
 *
 * @returns {Promise<void>}
 */
async function handlePickFile(): Promise<void> {
  if (restoring.value) return;
  try {
    const picked = await selectBackupFile();
    if (!picked.ok) {
      // 用户取消选择不打扰，仅对真实错误提示
      if (picked.error && picked.error !== '未选择文件') {
        ElMessage.error(picked.error);
      }
      return;
    }

    const filePath = picked.filePath as string;
    const manifest = picked.manifest as BackupManifest;
    confirmOpen(
      `确认从该文件恢复吗？当前数据将被覆盖！\n备份信息：${summaryText(manifest)}\n文件：${filePath}\n（恢复前会自动创建安全备份，恢复后需重启应用）`,
      5,
      () => doRestore(filePath)
    );
  } catch (err: any) {
    ElMessage.error('选择备份文件失败：' + (err?.message || String(err)));
  }
}

/**
 * 执行按路径恢复并提示结果
 *
 * @param {string} filePath - 备份文件绝对路径
 * @returns {Promise<void>}
 */
async function doRestore(filePath: string): Promise<void> {
  restoring.value = true;
  try {
    const res = await restoreFromPath(filePath);
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
  } finally {
    restoring.value = false;
  }
}
</script>

<style scoped lang="scss">
@use '../styles/backup-shared.scss';

.guide {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.guide-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  .guide-step {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  .guide-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);

    b {
      color: var(--text-primary);
    }
  }
}
</style>
