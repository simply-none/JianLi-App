<template>
  <div class="resource-list">
    <div
      v-for="item in items"
      :key="item.key"
      class="list-row"
      :class="{ selected: selectedKeys.has(item.key) }"
      @click="batchMode ? emit('toggle-select', item.key) : emit('preview', item)"
    >
      <!-- 批量勾选 -->
      <div v-if="batchMode" class="row-checkbox" @click.stop="emit('toggle-select', item.key)">
        <div class="checkbox" :class="{ checked: selectedKeys.has(item.key) }">
          <LucideIcon v-if="selectedKeys.has(item.key)" name="Check" :size="12" />
        </div>
      </div>

      <!-- 类型图标 / 缩略图 -->
      <div class="row-icon">
        <el-image
          v-if="item.type === 'image'"
          :src="fileProtocol + item.path"
          fit="cover"
          lazy
        />
        <FileIcon v-else :type="item.type" :size="26" />
      </div>

      <!-- 文件名 -->
      <div class="row-name" :title="item.name">
        <LucideIcon v-if="item.is_starred === 1" name="Star" :size="12" class="star" />
        {{ item.name }}
      </div>

      <!-- 类型 -->
      <div class="row-col row-type">
        <span class="type-tag" :class="item.type">{{ getTypeLabel(item.type) }}</span>
      </div>

      <!-- 大小 -->
      <div class="row-col row-size">{{ formatSize(item.size) }}</div>

      <!-- 添加时间 -->
      <div class="row-col row-time">{{ item.created_at || '-' }}</div>

      <!-- 行内操作 -->
      <div class="row-actions" @click.stop>
        <el-tooltip content="打开位置" placement="top">
          <el-button size="small" text @click="emit('open-location', item)">
            <LucideIcon name="FolderOpen" :size="14" />
          </el-button>
        </el-tooltip>
        <el-tooltip content="复制路径" placement="top">
          <el-button size="small" text @click="handleCopyPath(item)">
            <LucideIcon name="Copy" :size="14" />
          </el-button>
        </el-tooltip>
        <el-tooltip content="删除" placement="top">
          <el-button size="small" text type="danger" @click="emit('delete', item)">
            <LucideIcon name="Trash2" :size="14" />
          </el-button>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 资源列表视图：紧凑单行布局（图标 + 名称 + 类型 + 大小 + 时间 + 操作）
 * 事件语义与网格视图保持一致，由父组件统一处理。
 */
import LucideIcon from '@/components/LucideIcon.vue';
import FileIcon from '@/components/FileIcon.vue';
import { fileProtocol } from '@/var';
import { getTypeLabel, formatSize } from '../utils/fileType';
import type { ResourceItem } from '../types';
import { ElMessage } from 'element-plus';

/** 组件属性定义 */
defineProps<{
  /** 资源列表（必填，已筛选排序） */
  items: ResourceItem[];
  /** 是否批量模式 */
  batchMode?: boolean;
  /** 已选中主键集合 */
  selectedKeys: Set<string>;
}>();

/** 组件事件定义 */
const emit = defineEmits<{
  (e: 'preview', item: ResourceItem): void;
  (e: 'open-location', item: ResourceItem): void;
  (e: 'delete', item: ResourceItem): void;
  (e: 'toggle-select', key: string): void;
}>();

/**
 * 复制文件绝对路径到剪贴板
 *
 * @param {ResourceItem} item - 目标资源（必填）
 * @returns {void} 无返回值
 */
function handleCopyPath(item: ResourceItem) {
  window.ipcRenderer.clipboard.writeText(item.path || '');
  ElMessage.success('路径已复制');
}
</script>

<style scoped lang="scss">
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;

  .list-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:hover {
      border-color: var(--color-primary);

      .row-actions {
        opacity: 1;
      }
    }

    &.selected {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary);
    }

    .row-checkbox {
      .checkbox {
        width: 18px;
        height: 18px;
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

    .row-icon {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-card);

      :deep(.el-image) {
        width: 100%;
        height: 100%;
      }
    }

    .row-name {
      flex: 1;
      min-width: 0;
      font-size: 0.84rem;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 6px;

      .star {
        color: #f59e0b;
        flex-shrink: 0;
      }
    }

    .row-col {
      flex-shrink: 0;
      font-size: 0.76rem;
      color: var(--text-muted);
    }

    .row-size {
      width: 80px;
      text-align: right;
    }

    .row-time {
      width: 150px;
    }

    .row-type {
      width: 70px;

      .type-tag {
        padding: 1px 8px;
        border-radius: 4px;
        font-size: 0.72rem;
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
    }

    .row-actions {
      display: flex;
      align-items: center;
      opacity: 0;
      transition: opacity 0.2s;
    }
  }
}
</style>
