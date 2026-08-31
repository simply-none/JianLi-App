<template>
  <el-drawer
    v-model="visible"
    title="附件"
    direction="ltr"
    size="320px"
    :append-to-body="false"
  >
    <div class="attachments-drawer">
      <div class="att-hint">
        列出 PDF 内嵌的附件文件（由「PDF 工具箱 → 嵌入附件」写入）。点击右侧按钮可另存到本地。
      </div>

      <div v-if="loading" class="att-empty">正在读取附件…</div>

      <div v-else class="att-list">
        <div
          v-for="(item, i) in items"
          :key="i"
          class="att-item"
        >
          <div class="att-icon">
            <LucideIcon name="Paperclip" :size="15" />
          </div>
          <div class="att-main">
            <div class="att-name" :title="item.name">{{ item.name }}</div>
            <div class="att-meta">{{ item.mime || '未知类型' }} · {{ formatSize(item.size) }}</div>
          </div>
          <div class="att-actions">
            <el-button size="small" text title="另存到本地" @click="onDownload(i)">
              <LucideIcon name="Download" :size="13" />
            </el-button>
          </div>
        </div>

        <div v-if="items.length === 0" class="att-empty">
          暂无嵌入附件
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import type { PdfAttachmentItem } from '@/views/pdfTools/types';

const props = defineProps<{
  /** 抽屉可见性（v-model） */
  modelValue: boolean;
  /** 嵌入附件列表（仅元信息，不含字节） */
  items: PdfAttachmentItem[];
  /** 是否正在读取附件列表 */
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  /** 下载（另存）指定下标的附件，由父组件调用主进程导出 */
  (e: 'download', index: number): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

/** 点击另存：把附件在列表中的下标回传父组件（主进程按序号定位，避免重名歧义） */
function onDownload(index: number): void {
  emit('download', index);
}

/**
 * 格式化文件体积
 * @param size - 字节数
 * @returns 人类可读的体积文本（B / KB / MB / GB）
 */
function formatSize(size: number): string {
  if (!size || size < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = size;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v >= 10 || u === 0 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}
</script>

<style scoped lang="scss">
.attachments-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;

  .att-hint {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
    padding: 0 4px 12px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 8px;
  }
}

.att-list {
  flex: 1;
  overflow: auto;
  padding: 8px 0;

  .att-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-card, 6px);

    .att-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: var(--radius-btn, 4px);
      background: var(--bg-hover, var(--bg-base));
      color: var(--color-primary);
    }

    .att-main {
      flex: 1;
      min-width: 0;
    }

    .att-name {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .att-meta {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-variant-numeric: tabular-nums;
    }

    .att-actions {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
  }

  .att-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
}
</style>
