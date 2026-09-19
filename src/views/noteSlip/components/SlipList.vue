<!--
  小纸条 · 记录列表（纯展示原子组件）
  结构：方向徽标 + 标题/内容预览 + 对端与时间 + 操作（复制 / 打开链接 / 删除）。
-->
<template>
  <div class="slip-list">
    <div v-if="!items.length" class="slip-list__empty">
      还没有小纸条。收到或发出的文字 / 链接会显示在这里。
    </div>

    <div
      v-for="item in items"
      :key="item.key"
      class="slip-list__item"
      :class="{ 'is-unread': item.direction === 'in' && !item.read }"
      @click="onOpen(item)"
    >
      <div class="slip-list__head">
        <LucideIcon
          :name="item.direction === 'in' ? 'ArrowDownLeft' : 'ArrowUpRight'"
          :size="14"
          class="slip-list__dir"
          :class="item.direction === 'in' ? 'is-in' : 'is-out'"
        />
        <span class="slip-list__peer">
          {{ item.direction === 'in' ? `来自 ${item.peer_name}` : `发给 ${item.peer_name}` }}
        </span>
        <span class="slip-list__time">{{ formatTime(item.created_at) }}</span>
      </div>

      <div class="slip-list__content">{{ item.content }}</div>

      <div class="slip-list__actions">
        <el-button size="small" text @click.stop="copy(item)">
          <LucideIcon name="Copy" :size="13" style="margin-right: 4px" />
          复制
        </el-button>
        <el-button v-if="item.kind === 'url'" size="small" text @click.stop="openUrl(item)">
          <LucideIcon name="ExternalLink" :size="13" style="margin-right: 4px" />
          打开
        </el-button>
        <el-button size="small" text @click.stop="emit('remove', item.key)">
          <LucideIcon name="Trash2" :size="13" style="margin-right: 4px" />
          删除
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";

import type { NoteSlipItem } from "../types";

defineProps<{ items: NoteSlipItem[] }>();

const emit = defineEmits<{
  (e: "read", key: string): void;
  (e: "remove", key: string): void;
}>();

/** 点击整行 = 标记已读 */
function onOpen(item: NoteSlipItem) {
  if (item.direction === "in" && !item.read) emit("read", item.key);
}

async function copy(item: NoteSlipItem) {
  try {
    await navigator.clipboard.writeText(item.content);
    ElMessage.success("已复制");
  } catch {
    ElMessage.warning("复制失败，请手动选择文本");
  }
}

function openUrl(item: NoteSlipItem) {
  const url = item.content.trim();
  if (!/^https?:\/\//i.test(url)) return;
  window.open(url, "_blank");
}

/** 相对/绝对时间：同一天显示时分，否则显示日期 */
function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<style scoped lang="scss">
.slip-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow: auto;

  &__empty {
    font-size: 12px;
    opacity: 0.55;
    padding: 8px 0;
  }

  &__item {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    cursor: pointer;

    &.is-unread {
      border-color: color-mix(in srgb, var(--el-color-primary) 45%, transparent);
      background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
    }
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    opacity: 0.75;
  }

  &__dir {
    flex-shrink: 0;

    &.is-in {
      color: var(--el-color-success, #67c23a);
    }

    &.is-out {
      color: var(--el-color-primary);
    }
  }

  &__peer {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__time {
    flex-shrink: 0;
  }

  &__content {
    margin: 6px 0;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 120px;
    overflow: hidden;
  }

  &__actions {
    display: flex;
    gap: 4px;
  }
}
</style>
