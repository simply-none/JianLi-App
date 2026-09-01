<template>
  <VirtualList :items="files" item-key="id" :item-height="84" :gap="10" class="fg">
    <template #default="{ item }">
      <div class="fg-card">
        <div class="fg-icon" :style="{ color: kindColor(item.mime) }">
          <LucideIcon :name="kindIcon(item.mime)" :size="22" />
        </div>
        <div class="fg-meta" :title="item.name">
          <div class="fg-name">{{ item.name }}</div>
          <div class="fg-sub">{{ formatSize(item.size) }} · {{ formatDate(item.createdAt) }}</div>
        </div>
        <div class="fg-actions">
          <button class="fg-act" title="预览" @click="$emit('preview', item)">
            <LucideIcon name="Eye" :size="16" />
          </button>
          <button class="fg-act" title="导出解密" @click="$emit('export', item)">
            <LucideIcon name="Download" :size="16" />
          </button>
          <button class="fg-act fg-act--danger" title="删除" @click="$emit('delete', item)">
            <LucideIcon name="Trash2" :size="16" />
          </button>
        </div>
      </div>
    </template>
    <template #empty>
      <div class="fg-empty">保险箱是空的</div>
    </template>
  </VirtualList>
</template>

<script setup lang="ts">
/**
 * 文件卡片列表（虚拟化，长列表优先 VirtualList）。
 * 仅展示元数据；加解密操作上抛给父级（主进程执行）。
 */
import VirtualList from '@/components/VirtualList.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import type { VaultFileMeta } from '../types';

defineProps<{ files: VaultFileMeta[] }>();
defineEmits<{
  (e: 'preview', file: VaultFileMeta): void;
  (e: 'export', file: VaultFileMeta): void;
  (e: 'delete', file: VaultFileMeta): void;
}>();

function kindIcon(mime: string): string {
  if (mime.startsWith('image/')) return 'Image';
  if (mime === 'application/pdf') return 'FileText';
  if (mime.startsWith('audio/')) return 'Music';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('text/')) return 'FileText';
  if (['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'].includes(mime))
    return 'FileArchive';
  return 'FileBox';
}

function kindColor(mime: string): string {
  if (mime.startsWith('image/')) return '#0ea5e9';
  if (mime === 'application/pdf') return '#ef4444';
  if (mime.startsWith('audio/')) return '#8b5cf6';
  if (mime.startsWith('video/')) return '#f97316';
  if (mime.startsWith('text/')) return '#10b981';
  return 'var(--color-primary)';
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const p = (n: number) => `${n}`.padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return iso;
  }
}
</script>

<style scoped lang="scss">
.fg {
  height: 100%;
  .fg-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 13px;
  }
}
.fg-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card, 10px);
  transition: border-color 0.15s;
  &:hover {
    border-color: var(--color-primary);
  }
}
.fg-icon {
  flex: none;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  border-radius: 8px;
}
.fg-meta {
  flex: 1;
  min-width: 0;
}
.fg-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fg-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}
.fg-actions {
  flex: none;
  display: flex;
  gap: 4px;
}
.fg-act {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  &--danger:hover {
    border-color: var(--color-error, #e11d48);
    color: var(--color-error, #e11d48);
  }
}
</style>
