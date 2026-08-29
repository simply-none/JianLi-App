<template>
  <div class="backup-card">
    <div class="backup-card-header">
      <LucideIcon name="DatabaseBackup" :size="18" />
      <span>数据库概况与立即备份</span>
      <div class="header-extra">
        <el-button size="small" @click="openDir">
          <LucideIcon name="FolderOpen" :size="14" />
          打开备份目录
        </el-button>
        <el-button type="primary" size="small" :loading="creating" @click="handleCreate">
          <LucideIcon name="SaveAll" :size="14" />
          立即备份
        </el-button>
      </div>
    </div>
    <div class="backup-card-body">
      <!-- 各数据库概况 -->
      <div v-if="info" class="db-list">
        <div v-for="db in info.dbs" :key="db.name" class="info-row">
          <span class="info-label">
            <LucideIcon name="DatabaseZap" :size="14" />
            {{ db.file }}
          </span>
          <span class="info-value">
            <template v-if="db.exists">{{ formatSize(db.size) }} · 更新于 {{ formatTime(db.mtime) }}</template>
            <template v-else>文件不存在</template>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">备份目录</span>
          <span class="info-value">{{ info.backupDir }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">最近备份</span>
          <span class="info-value">
            <template v-if="info.lastBackup && info.lastBackup.manifest">
              {{ info.lastBackup.manifest.createdAtText }} · 共 {{ info.backupCount }} 份
            </template>
            <template v-else>暂无备份</template>
          </span>
        </div>
      </div>

      <!-- 备份备注 -->
      <el-input
        v-model="note"
        placeholder="备份备注（可选），如：恢复前的安全备份"
        maxlength="50"
        clearable
        class="note-input"
      />
      <p class="backup-hint">
        备份包含 db.sqlite 与 userDb.sqlite 全部数据（配置、习惯、待办、记账、笔记等）；
        备份文件为 .jlbak 单文件（zip 格式），可直接复制到其他电脑恢复。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import moment from 'moment';
import LucideIcon from '@/components/LucideIcon.vue';
import type { BackupInfo } from '../types';
import { createBackup, openBackupDir } from '../api/backupApi';

/** 组件入参：备份概况信息（由父页面加载传入） */
const props = defineProps<{
  /** 备份概况信息，加载中可为 null */
  info: BackupInfo | null;
}>();

/** 组件事件：created 备份创建成功（父页面刷新列表）；refresh 请求刷新概况 */
const emit = defineEmits<{
  (e: 'created'): void;
  (e: 'refresh'): void;
}>();

/** 备份备注输入 */
const note = ref('');
/** 是否正在创建备份 */
const creating = ref(false);

/**
 * 创建备份并提示结果
 *
 * 成功后通知父页面刷新概况与列表；失败弹错误提示（含主进程原始错误信息）。
 *
 * @returns {Promise<void>}
 */
async function handleCreate(): Promise<void> {
  creating.value = true;
  try {
    const res = await createBackup(note.value.trim());
    if (res.ok) {
      ElMessage.success(`备份成功：${res.fileName}`);
      note.value = '';
      emit('created');
      emit('refresh');
    } else {
      ElMessage.error('备份失败：' + (res.error || '未知错误'));
    }
  } catch (err: any) {
    ElMessage.error('备份失败：' + (err?.message || String(err)));
  } finally {
    creating.value = false;
  }
}

/**
 * 在资源管理器中打开备份目录
 *
 * @returns {Promise<void>}
 */
async function openDir(): Promise<void> {
  await openBackupDir();
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

/**
 * 格式化时间展示
 *
 * @param {number} ts - 毫秒时间戳
 * @returns {string} YYYY-MM-DD HH:mm:ss 文本
 */
function formatTime(ts: number): string {
  return ts ? moment(ts).format('YYYY-MM-DD HH:mm:ss') : '-';
}
</script>

<style scoped lang="scss">
@use '../styles/backup-shared.scss';

.note-input {
  margin-top: 14px;
}
</style>
