<template>
  <div
    class="resource-card"
    :class="{ selected, 'batch-mode': batchMode }"
    @click="handleClick"
  >
    <!-- 批量模式勾选框 -->
    <div v-if="batchMode" class="checkbox-layer" @click.stop="emit('toggle-select', item.key)">
      <div class="checkbox" :class="{ checked: selected }">
        <LucideIcon v-if="selected" name="Check" :size="12" />
      </div>
    </div>

    <!-- 预览缩略图 / 类型图标 -->
    <div class="card-preview">
      <el-image
        v-if="item.type === 'image'"
        :src="fileProtocol + item.path"
        fit="cover"
        lazy
      >
        <template #error>
          <FileIcon :type="item.type" :size="48" />
        </template>
      </el-image>
      <FileIcon v-else :type="item.type" :size="48" />
      <!-- 收藏角标 -->
      <div v-if="item.is_starred === 1" class="star-badge">
        <LucideIcon name="Star" :size="12" />
      </div>
    </div>

    <!-- 信息区 -->
    <div class="card-info">
      <div class="card-name" :title="item.name">{{ item.name }}</div>
      <div class="card-meta">
        <span class="type-tag" :class="item.type">{{ getTypeLabel(item.type) }}</span>
        <span class="file-size">{{ formatSize(item.size) }}</span>
      </div>
    </div>

    <!-- 悬停操作 -->
    <div class="card-actions" @click.stop>
      <el-tooltip content="预览" placement="top">
        <el-button size="small" text @click="emit('preview', item)">
          <LucideIcon name="Eye" :size="14" />
        </el-button>
      </el-tooltip>
      <el-tooltip content="打开位置" placement="top">
        <el-button size="small" text @click="emit('open-location', item)">
          <LucideIcon name="FolderOpen" :size="14" />
        </el-button>
      </el-tooltip>
      <el-tooltip content="复制路径" placement="top">
        <el-button size="small" text @click="handleCopyPath">
          <LucideIcon name="Copy" :size="14" />
        </el-button>
      </el-tooltip>
      <el-tooltip :content="item.is_starred === 1 ? '取消收藏' : '收藏'" placement="top">
        <el-button size="small" text @click="emit('star', item)">
          <LucideIcon name="Star" :size="14" />
        </el-button>
      </el-tooltip>
      <el-tooltip content="删除" placement="top">
        <el-button size="small" text type="danger" @click="emit('delete', item)">
          <LucideIcon name="Trash2" :size="14" />
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 资源卡片：缩略图/图标 + 文件信息 + 悬停操作（预览/打开位置/复制路径/收藏/删除）
 * 纯展示组件，所有操作通过事件上抛给父组件处理。
 */
import LucideIcon from '@/components/LucideIcon.vue';
import FileIcon from '@/components/FileIcon.vue';
import { fileProtocol } from '@/var';
import { getTypeLabel, formatSize } from '../utils/fileType';
import type { ResourceItem } from '../types';
import { ElMessage } from 'element-plus';

/** 组件属性定义 */
const props = defineProps<{
  /** 资源数据（必填） */
  item: ResourceItem;
  /** 是否批量模式（显示勾选框） */
  batchMode?: boolean;
  /** 是否已选中 */
  selected?: boolean;
}>();

/** 组件事件定义 */
const emit = defineEmits<{
  (e: 'preview', item: ResourceItem): void;
  (e: 'open-location', item: ResourceItem): void;
  (e: 'star', item: ResourceItem): void;
  (e: 'delete', item: ResourceItem): void;
  (e: 'toggle-select', key: string): void;
}>();

/**
 * 卡片点击：批量模式下切换选中，普通模式打开预览
 *
 * @returns {void} 无返回值
 */
function handleClick() {
  if (props.batchMode) {
    emit('toggle-select', props.item.key);
  } else {
    emit('preview', props.item);
  }
}

/**
 * 复制文件绝对路径到剪贴板
 *
 * @returns {void} 无返回值
 */
function handleCopyPath() {
  window.ipcRenderer.clipboard.writeText(props.item.path || '');
  ElMessage.success('路径已复制');
}
</script>

<style scoped lang="scss">
.resource-card {
  position: relative;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

    .card-actions {
      opacity: 1;
      pointer-events: auto;
    }
  }

  &.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .checkbox-layer {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 2;

    .checkbox {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1.5px solid var(--border-subtle);
      background: var(--bg-card);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;

      &.checked {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }
    }
  }

  .card-preview {
    width: 100%;
    height: 110px;
    background: var(--bg-base);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    :deep(.el-image) {
      width: 100%;
      height: 100%;
    }

    .star-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      color: #f59e0b;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }
  }

  .card-info {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .card-name {
      font-size: 0.84rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.72rem;

      .type-tag {
        padding: 1px 8px;
        border-radius: 4px;
        font-weight: 500;

        &.image { background: rgba(99, 102, 241, 0.1); color: var(--color-primary); }
        &.video { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        &.audio { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
        &.text  { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        &.pdf   { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        &.font  { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        &.archive { background: rgba(6, 182, 212, 0.1); color: #06b6d4; }
        &.document { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        &.other { background: rgba(156, 163, 175, 0.1); color: var(--text-muted); }
      }

      .file-size {
        color: var(--text-muted);
      }
    }
  }

  .card-actions {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  }
}
</style>
