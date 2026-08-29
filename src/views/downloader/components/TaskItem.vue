<template>
  <div class="task-item" :class="`status-${task.status}`">
    <!-- 分类图标 -->
    <div class="task-icon">
      <LucideIcon :name="categoryMeta.icon" :size="22" />
    </div>

    <!-- 中部：文件名 / 进度 / 元信息 -->
    <div class="task-main">
      <div class="task-title-row">
        <span class="task-filename" :title="task.filename">{{ task.filename }}</span>
        <el-tag :type="statusMeta.tag as any" size="small" effect="light">{{ statusMeta.label }}</el-tag>
      </div>

      <!-- 进度条仅在任务进行中/等待/暂停时展示；完成与失败只保留状态标签 -->
      <el-progress
        v-if="task.status === 'downloading' || task.status === 'waiting' || task.status === 'paused'"
        :percentage="progressPercent"
        :stroke-width="6"
        :show-text="false"
        :status="progressStatus"
        class="task-progress"
      />

      <div class="task-meta-row">
        <span v-if="task.status === 'downloading'" class="meta-speed">
          {{ formatSpeed(task.speed) }}
        </span>
        <span class="meta-size">
          {{ task.totalSize ? `${formatBytes(task.receivedSize)} / ${formatBytes(task.totalSize)}` : formatBytes(task.receivedSize) }}
        </span>
        <span v-if="task.status === 'downloading' && task.totalSize" class="meta-eta">
          剩余 {{ formatEta(task.receivedSize, task.totalSize, task.speed) }}
        </span>
        <span class="meta-conn" title="并发连接数 / 是否断点续传">
          {{ task.connections }} 线程{{ task.acceptRanges ? ' · 可续传' : '' }}
        </span>
        <span v-if="task.status === 'failed' && task.errorMsg" class="meta-error" :title="task.errorMsg">
          {{ task.errorMsg }}
        </span>
      </div>
    </div>

    <!-- 右侧操作按钮 -->
    <div class="task-actions">
      <template v-if="task.status === 'downloading' || task.status === 'waiting'">
        <button class="act-btn" title="暂停" @click="pause(task.id)">
          <LucideIcon name="Pause" :size="16" />
        </button>
      </template>
      <template v-else-if="task.status === 'paused' || task.status === 'failed'">
        <button class="act-btn is-primary" :title="task.status === 'failed' ? '重试' : '继续'" @click="resume(task.id)">
          <LucideIcon :name="task.status === 'failed' ? 'RotateCcw' : 'Play'" :size="16" />
        </button>
      </template>
      <template v-if="task.status === 'completed'">
        <button class="act-btn" title="打开文件" @click="openOrShow(task.id, 'open')">
          <LucideIcon name="ExternalLink" :size="16" />
        </button>
        <button class="act-btn" title="打开所在文件夹" @click="openOrShow(task.id, 'folder')">
          <LucideIcon name="FolderOpen" :size="16" />
        </button>
      </template>
      <button class="act-btn is-danger" title="删除任务" @click="confirmRemove">
        <LucideIcon name="Trash2" :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 单条下载任务卡片
 * 展示：分类图标、文件名、状态标签、进度条、速度/大小/剩余时间、操作按钮。
 * 操作通过 useDownloader 的动作直接下发，无需父组件中转。
 */
import { computed } from "vue";
import { ElMessageBox } from "element-plus";
import LucideIcon from "@/components/LucideIcon.vue";
import { useDownloader } from "../composables/useDownloader";
import { formatBytes, formatSpeed, formatEta, CATEGORY_META, STATUS_META } from "../utils/format";
import type { DownloadTaskItem } from "../api/downloaderApi";

/** 组件 props */
const props = defineProps<{
  /** 必填，任务数据 */
  task: DownloadTaskItem;
}>();

const { pause, resume, remove, openOrShow } = useDownloader();

/** 分类展示元信息 */
const categoryMeta = computed(() => CATEGORY_META[props.task.category] || CATEGORY_META.other);
/** 状态展示元信息 */
const statusMeta = computed(() => STATUS_META[props.task.status] || STATUS_META.other);

/** 进度百分比（总大小未知时给 0） */
const progressPercent = computed(() => {
  const { totalSize, receivedSize } = props.task;
  if (!totalSize) return 0;
  return Math.min(100, Math.round((receivedSize / totalSize) * 100));
});

/** 进度条状态（下载中/等待/暂停均为默认样式；完成与失败不展示进度条） */
const progressStatus = computed(() => undefined);

/**
 * 删除确认：未完成任务会连带删除分片；已完成任务询问是否连文件一起删
 * @returns Promise，确认后执行删除
 */
async function confirmRemove(): Promise<void> {
  const { status } = props.task;
  const tip =
    status === "completed"
      ? `是否删除任务「${props.task.filename}」？（可选择同时删除文件）`
      : `是否删除任务「${props.task.filename}」？未完成的下载分片将被清理`;
  try {
    if (status === "completed") {
      const { value } = await ElMessageBox.confirm(tip, "删除任务", {
        distinguishCancelAndClose: true,
        confirmButtonText: "删除任务和文件",
        cancelButtonText: "仅删除记录",
        type: "warning",
      }).then(() => ({ value: "withFile" as const }))
        .catch((action: string) => (action === "cancel" ? { value: "record" as const } : Promise.reject()));
      // withFile：连文件一起删；record：仅删记录
      await remove(props.task.id, value === "withFile");
    } else {
      await ElMessageBox.confirm(tip, "删除任务", {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      });
      await remove(props.task.id, false);
    }
  } catch {
    // 用户关闭弹窗，忽略
  }
}
</script>

<style scoped lang="scss">
.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);

    .task-actions { opacity: 1; }
  }
}

.task-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-btn);
  background: var(--color-primary-light);
  color: var(--color-primary-solid);
}

.task-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .task-filename {
    flex: 1;
    min-width: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.task-progress {
  margin: 0;
}

.task-meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.74rem;
  color: var(--text-muted);

  .meta-speed { color: var(--color-primary-solid); font-weight: 600; }
  .meta-error {
    color: var(--el-color-danger, #f56c6c);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.task-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.55;
  transition: opacity 0.2s;

  .act-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--color-primary);
    }

    &.is-primary:hover { color: var(--color-primary-solid); }
    &.is-danger:hover {
      color: var(--el-color-danger, #f56c6c);
      border-color: var(--el-color-danger, #f56c6c);
    }
  }
}
</style>
