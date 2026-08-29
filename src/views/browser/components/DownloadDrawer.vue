<template>
  <!-- 下载内容抽屉：进度条 + 打开/所在文件夹/取消/清除记录 -->
  <el-drawer
    v-model="visible"
    title="下载内容"
    direction="rtl"
    size="420px"
    :append-to-body="true"
  >
    <div class="download-panel">
      <div class="download-list">
        <template v-if="downloads.length > 0">
          <div v-for="item in downloads" :key="item.id" class="download-item">
            <span class="item-icon">
              <LucideIcon :name="item.state === 'completed' ? 'CircleCheck' : item.state === 'interrupted' ? 'CircleX' : 'Download'" :size="16" />
            </span>
            <span class="item-body">
              <span class="item-filename" :title="item.path">{{ item.filename }}</span>
              <el-progress
                v-if="item.state === 'progressing'"
                :percentage="percentOf(item)"
                :stroke-width="5"
                :show-text="false"
                class="item-progress"
              />
              <span class="item-meta">
                {{ downloadStateLabel(item.state) }} · {{ formatBytes(item.receivedBytes) }}
                <template v-if="item.totalBytes > 0"> / {{ formatBytes(item.totalBytes) }}</template>
              </span>
            </span>
            <span class="item-actions">
              <!-- 进行中：取消；已完成：打开 + 所在文件夹 -->
              <span v-if="item.state === 'progressing'" class="action-btn" title="取消下载" @click="cancelDownload(item.id)">
                <LucideIcon name="X" :size="14" />
              </span>
              <template v-else-if="item.state === 'completed'">
                <span class="action-btn" title="打开文件" @click="openDownload(item.id)">
                  <LucideIcon name="SquareArrowOutUpRight" :size="14" />
                </span>
                <span class="action-btn" title="打开所在文件夹" @click="showDownloadInFolder(item.id)">
                  <LucideIcon name="FolderOpen" :size="14" />
                </span>
              </template>
            </span>
          </div>
        </template>
        <div v-else class="download-empty">
          <LucideIcon name="Download" :size="36" color="var(--text-muted)" />
          <p>暂无下载记录</p>
          <p class="empty-sub">在网页中触发的文件下载会保存到系统「下载」文件夹</p>
        </div>
      </div>

      <div v-if="downloads.some((d) => d.state !== 'progressing')" class="download-footer">
        <el-button size="small" plain @click="clearFinishedDownloads">清除已完成记录</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 下载内容抽屉
 * 数据由 useDownloads 单例提供（订阅主进程 browser-download:updated 推送实时刷新）。
 * 文件统一保存到系统「下载」文件夹，重名自动加 (n) 序号。
 */
import LucideIcon from "@/components/LucideIcon.vue";
import {
  useDownloads,
  cancelDownload,
  openDownload,
  showDownloadInFolder,
  clearFinishedDownloads,
  formatBytes,
  downloadStateLabel,
  type DownloadRecord,
} from "../composables/useDownloads";

/** 抽屉显隐（v-model:visible） */
const visible = defineModel<boolean>("visible", { default: false });

const { downloads } = useDownloads();

/**
 * 计算下载进度百分比
 * @param item 必填，下载记录
 * @returns 0-100；总大小未知时返回 0
 */
function percentOf(item: DownloadRecord): number {
  if (!item.totalBytes) return 0;
  return Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100));
}
</script>

<style scoped lang="scss">
.download-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.download-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.download-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 8px;
  transition: background 0.15s;

  &:hover {
    background: var(--bg-hover);

    .item-actions {
      opacity: 1;
    }
  }

  .item-icon {
    display: flex;
    align-items: center;
    margin-top: 3px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .item-filename {
      font-size: 13px;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-progress {
      width: 100%;
    }

    .item-meta {
      font-size: 12px;
      color: var(--text-muted);
    }
  }

  .item-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;

    .action-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-muted);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }
  }
}

.download-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 60px 20px;
  color: var(--text-muted);
  text-align: center;

  p {
    font-size: 13px;
    margin: 0;
  }

  .empty-sub {
    font-size: 12px;
  }
}

.download-footer {
  border-top: 1px solid var(--border-subtle);
  padding-top: 10px;
  display: flex;
  justify-content: center;
}
</style>
