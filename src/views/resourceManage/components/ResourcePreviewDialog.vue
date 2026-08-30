<template>
  <app-dialog
    :model-value="visible"
    :title="currentItem?.name || '文件预览'"
    width="80%"
    top="5vh"
    @update:model-value="emit('close')"
  >
    <div class="preview-body">
      <!-- 图片：支持缩放旋转 -->
      <div v-if="previewType === 'image'" class="image-stage">
        <div class="image-tools">
          <el-button size="small" @click="emit('zoom-out')">
            <LucideIcon name="ZoomOut" :size="14" />
          </el-button>
          <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
          <el-button size="small" @click="emit('zoom-in')">
            <LucideIcon name="ZoomIn" :size="14" />
          </el-button>
          <el-button size="small" @click="emit('rotate')">
            <LucideIcon name="RotateCw" :size="14" />
          </el-button>
        </div>
        <div class="image-container">
          <img
            v-if="currentItem"
            :src="fileProtocol + currentItem.path"
            :style="{
              transform: `scale(${zoom}) rotate(${rotate}deg)`,
            }"
            alt="预览图片"
          />
        </div>
      </div>

      <!-- 视频 -->
      <video
        v-else-if="currentItem && previewType === 'video'"
        :key="currentItem.key"
        :src="fileProtocol + currentItem.path"
        controls
        style="max-width: 100%; max-height: 66vh"
      />

      <!-- 音频 -->
      <audio
        v-else-if="currentItem && previewType === 'audio'"
        :key="currentItem.key"
        :src="fileProtocol + currentItem.path"
        controls
        style="width: 100%"
      />

      <!-- 文本 -->
      <div v-else-if="previewType === 'text'" class="text-stage">
        <div v-if="textLoading" class="text-loading" v-loading="true" element-loading-text="加载中..." />
        <pre v-else class="text-preview">{{ textContent || '（空文件）' }}</pre>
        <div v-if="textTruncated" class="text-truncated-tip">文件过大，仅显示前 2MB 内容</div>
      </div>

      <!-- PDF -->
      <iframe
        v-else-if="currentItem && previewType === 'pdf'"
        :key="currentItem.key"
        :src="fileProtocol + currentItem.path"
        style="width: 100%; height: 66vh"
        frameborder="0"
      />

      <!-- 不支持的类型 -->
      <div v-else class="other-preview">
        <FileIcon :type="previewType" :size="64" />
        <div>该文件类型不支持预览</div>
        <div v-if="currentItem" class="file-name-tip">文件名：{{ currentItem.name }}</div>
        <el-button type="primary" class="mt-4" @click="currentItem && emit('open-location', currentItem)">
          打开文件位置
        </el-button>
      </div>
    </div>

    <!-- 底部信息栏 + 上一个/下一个导航 -->
    <template #footer>
      <div class="preview-footer">
        <div class="nav-group">
          <el-button size="small" :disabled="navIndex <= 0" @click="emit('prev')">
            <LucideIcon name="ArrowLeft" :size="14" />
          </el-button>
          <span class="nav-count">{{ navIndex + 1 }} / {{ navTotal }}</span>
          <el-button size="small" :disabled="navIndex < 0 || navIndex >= navTotal - 1" @click="emit('next')">
            <LucideIcon name="ArrowRight" :size="14" />
          </el-button>
        </div>
        <div v-if="currentItem" class="meta-group">
          <span>{{ formatSize(currentItem.size) }}</span>
          <span class="divider">|</span>
          <span>{{ currentItem.created_at || '-' }}</span>
        </div>
        <el-button size="small" @click="currentItem && emit('open-location', currentItem)">
          <LucideIcon name="FolderOpen" :size="14" />
          打开位置
        </el-button>
      </div>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
/**
 * 资源预览弹窗：图片（缩放/旋转）/ 视频 / 音频 / 文本 / PDF / 兜底提示
 * + 底部信息栏与上一个/下一个快速导航。
 * 全部状态来自 useResourcePreview，由父组件透传。
 */
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import FileIcon from '@/components/FileIcon.vue';
import { fileProtocol } from '@/var';
import { formatSize } from '../utils/fileType';
import type { ResourceItem, ResourceType } from '../types';

/** 组件属性定义 */
defineProps<{
  /** 弹窗可见性 */
  visible: boolean;
  /** 当前预览资源 */
  currentItem: ResourceItem | null;
  /** 预览类型 */
  previewType: ResourceType | 'other';
  /** 文本内容 */
  textContent: string;
  /** 文本是否被截断 */
  textTruncated: boolean;
  /** 文本加载中 */
  textLoading: boolean;
  /** 图片缩放比例 */
  zoom: number;
  /** 图片旋转角度 */
  rotate: number;
  /** 当前项在导航列表中的索引 */
  navIndex: number;
  /** 导航列表总长 */
  navTotal: number;
}>();

/** 组件事件定义 */
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'rotate'): void;
  (e: 'open-location', item: ResourceItem): void;
}>();
</script>

<style scoped lang="scss">
.preview-body {
  min-height: 200px;
  display: flex;
  flex-direction: column;

  .image-stage {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .image-tools {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

      .zoom-value {
        font-size: 0.78rem;
        color: var(--text-secondary);
        min-width: 44px;
        text-align: center;
      }
    }

    .image-container {
      display: flex;
      align-items: center;
      justify-content: center;
      max-height: 62vh;
      overflow: auto;

      img {
        max-width: 100%;
        max-height: 62vh;
        transition: transform 0.15s ease;
      }
    }
  }

  .text-stage {
    .text-loading {
      min-height: 200px;
    }

    .text-preview {
      margin: 0;
      background: var(--bg-base);
      padding: 16px;
      border-radius: var(--radius-card);
      font-size: 0.82rem;
      line-height: 1.6;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 62vh;
      overflow: auto;
    }

    .text-truncated-tip {
      margin-top: 8px;
      font-size: 0.75rem;
      color: #f59e0b;
    }
  }

  .other-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px 0;
    color: var(--text-secondary);

    .file-name-tip {
      font-size: 0.78rem;
      color: var(--text-muted);
    }
  }
}

.preview-footer {
  display: flex;
  align-items: center;
  gap: 16px;

  .nav-group {
    display: flex;
    align-items: center;
    gap: 8px;

    .nav-count {
      font-size: 0.78rem;
      color: var(--text-secondary);
      min-width: 48px;
      text-align: center;
    }
  }

  .meta-group {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.76rem;
    color: var(--text-muted);

    .divider {
      color: var(--border-subtle);
    }
  }
}
</style>
