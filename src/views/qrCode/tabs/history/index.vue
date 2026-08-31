<template>
  <div class="qr-history">
    <div class="hist-head">
      <div class="hist-filters">
        <label class="hist-filter">
          <span>来源</span>
          <select v-model="sourceFilter" @change="load">
            <option value="qrCode">本模块</option>
            <option value="all">全部来源</option>
          </select>
        </label>
      </div>
      <button class="hist-clear" :disabled="!records.length" @click="clearMine">
        <LucideIcon name="Trash2" :size="14" /> 清空本模块
      </button>
    </div>

    <div v-if="records.length" class="hist-list">
      <div v-for="r in records" :key="r.key" class="hist-item">
        <div class="hist-item-main">
          <span class="hist-type" :title="typeLabel(r.type)">
            <LucideIcon :name="typeIcon(r.type)" :size="14" />
          </span>
          <div class="hist-text-wrap">
            <div class="hist-text" :title="r.content">{{ r.content }}</div>
            <div class="hist-meta">
              <span v-if="r.source !== 'qrCode'" class="hist-source">{{ r.source }}</span>
              <span class="hist-time">{{ formatTime(r.created_at) }}</span>
              <span v-if="r.note" class="hist-note">{{ r.note }}</span>
            </div>
          </div>
        </div>
        <div class="hist-item-actions">
          <button class="hist-btn" title="预览" @click="preview(r)">
            <LucideIcon name="Eye" :size="14" />
          </button>
          <button class="hist-btn" title="复制文本" @click="copyText(r)">
            <LucideIcon name="Copy" :size="14" />
          </button>
          <button class="hist-btn hist-btn-danger" title="删除" @click="remove(r)">
            <LucideIcon name="Trash2" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <div v-else class="hist-empty">
      <LucideIcon name="History" :size="32" />
      <p>暂无历史记录</p>
    </div>

    <!-- 预览弹窗 -->
    <QrCodeDialog
      v-model="dialogVisible"
      :content="selected?.content || ''"
      :style-options="selected?.style || null"
      :title="selected ? typeLabel(selected.type) + ' 预览' : '二维码'"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 二维码历史页（L3 Tab）
 * - 全局统一 qr_history，按 source 区分来源；本模块默认只看自身。
 * - 列表不预渲染图片（省资源），点击「预览」才用 QrCodeDialog 渲染。
 * - 写入/删除后由 store.historyRefreshToken 驱动刷新。
 */
import { ref, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import QrCodeDialog from '@/components/qrcode/QrCodeDialog.vue';
import {
  getQrHistory,
  deleteQrHistory,
  clearQrHistory,
  type QrHistoryRecord,
  type QrPayloadType,
} from '@/utils/qrcode';
import useQrCodeStore, { QR_SOURCE } from '@/store/useQrCode';

const store = useQrCodeStore();
const records = ref<QrHistoryRecord[]>([]);
const sourceFilter = ref<'qrCode' | 'all'>('qrCode');
const dialogVisible = ref(false);
const selected = ref<QrHistoryRecord | null>(null);

function typeLabel(t: QrPayloadType): string {
  const map: Record<string, string> = {
    text: '文本', url: '网址', wifi: 'Wi-Fi', contact: '联系人',
    email: '邮件', sms: '短信', tel: '电话', geo: '地理位置', event: '日历事件',
  };
  return map[t] || '未知';
}
function typeIcon(t: QrPayloadType): string {
  const map: Record<string, string> = {
    text: 'FileText', url: 'Link', wifi: 'Wifi', contact: 'Contact',
    email: 'Mail', sms: 'MessageSquarePlus', tel: 'Smartphone', geo: 'MapPin', event: 'Calendar',
  };
  return map[t] || 'QrCode';
}
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function load() {
  records.value = await getQrHistory({
    source: sourceFilter.value === 'all' ? undefined : QR_SOURCE,
  });
}

function preview(r: QrHistoryRecord) {
  selected.value = r;
  dialogVisible.value = true;
}

async function copyText(r: QrHistoryRecord) {
  try {
    await navigator.clipboard.writeText(r.content);
    ElMessage.success('已复制文本');
  } catch {
    ElMessage.error('复制失败');
  }
}

async function remove(r: QrHistoryRecord) {
  const ok = await deleteQrHistory(r.key);
  if (ok) {
    ElMessage.success('已删除');
    store.bumpHistory();
    load();
  } else {
    ElMessage.error('删除失败');
  }
}

async function clearMine() {
  const ok = await clearQrHistory(QR_SOURCE);
  if (ok) {
    ElMessage.success('已清空本模块历史');
    store.bumpHistory();
    load();
  } else {
    ElMessage.error('清空失败');
  }
}

onMounted(load);
// 写入/删除历史后刷新（其它 Tab 或弹窗触发的变更）
watch(() => store.historyRefreshToken, load);
</script>

<style scoped lang="scss">
.qr-history {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.hist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hist-filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);

  select {
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn, 8px);
    background: var(--bg-card);
    color: var(--text-primary);
    cursor: pointer;
  }
}

.hist-clear {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  &:hover:not(:disabled) {
    border-color: var(--color-error, #e11d48);
    color: var(--color-error, #e11d48);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.hist-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hist-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card, 12px);
  transition: border-color 0.15s;
  &:hover {
    border-color: var(--color-primary);
  }
}

.hist-item-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.hist-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-btn, 8px);
  background: var(--color-primary-light, rgba(99, 102, 241, 0.1));
  color: var(--color-primary);
  flex-shrink: 0;
}

.hist-text-wrap {
  min-width: 0;
  flex: 1;
}

.hist-text {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hist-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-muted);
}

.hist-source {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.hist-note {
  color: var(--color-primary);
}

.hist-item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.hist-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.hist-btn-danger:hover {
  border-color: var(--color-error, #e11d48);
  color: var(--color-error, #e11d48);
}

.hist-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card, 14px);
}
</style>
