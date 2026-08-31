<template>
  <div
    class="qr-drop-zone"
    :class="{ 'is-dragover': dragover, 'has-result': result }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="pickFile"
  >
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="qr-file-input"
      @change="onFileChange"
    />

    <!-- 未识别 / 初始态 -->
    <div v-if="!result" class="dz-inner">
      <LucideIcon name="ScanQrCode" :size="40" class="dz-icon" />
      <p class="dz-title">拖拽图片到此处，或点击选择</p>
      <p class="dz-hint">支持 PNG / JPG；识别失败会自动放大重试</p>
    </div>

    <!-- 识别中 -->
    <div v-else-if="result.pending" class="dz-inner">
      <LucideIcon name="LoaderCircle" :size="36" class="spin" />
      <p class="dz-title">正在识别…</p>
    </div>

    <!-- 识别失败 -->
    <div v-else-if="!result.ok" class="dz-inner dz-fail">
      <LucideIcon name="CircleAlert" :size="36" />
      <p class="dz-title">{{ result.error || '未检测到二维码' }}</p>
      <p class="dz-hint">点击重新选择图片</p>
    </div>

    <!-- 识别成功：展示缩略 + 文本 + 操作 -->
    <div v-else class="dz-result" @click.stop>
      <img :src="previewUrl" class="dz-thumb" alt="已识别" />
      <div class="dz-meta">
        <div class="dz-type">
          <LucideIcon :name="typeIcon(result.type)" :size="14" />
          <span>{{ typeLabel(result.type) }}</span>
        </div>
        <pre class="dz-text" @click.stop>{{ result.data }}</pre>
        <div class="dz-actions">
          <button class="dz-btn" title="复制" @click.stop="copyText">
            <LucideIcon name="Copy" :size="14" /> 复制
          </button>
          <button v-if="isUrl(result.data)" class="dz-btn" title="打开" @click.stop="openUrl">
            <LucideIcon name="ExternalLink" :size="14" /> 打开
          </button>
          <button class="dz-btn dz-btn-ghost" title="重新选择" @click.stop="pickFile">
            <LucideIcon name="RotateCcw" :size="14" /> 重选
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 二维码识别拖拽区（L2 复用组件）
 * - 拖拽 / 点击选择图片，调用能力层 decodeQr（唯一接触 jsqr，多尺度重试）。
 * - 暴露识别结果给父组件（v-model:result），也可自身内联复制/打开。
 * - 不落库、不依赖业务，任意模块可复用。
 */
import { ref, shallowRef } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { decodeQr, type QrDecodeResult, type QrPayloadType } from '@/utils/qrcode';

interface LocalResult extends QrDecodeResult {
  pending?: boolean;
}

const props = withDefaults(
  defineProps<{
    /** 限制可识别类型标签映射（可选） */
    limitTypes?: QrPayloadType[];
  }>(),
  { limitTypes: () => [] },
);

const emit = defineEmits<{
  (e: 'update:result', value: LocalResult | null): void;
  (e: 'decoded', value: QrDecodeResult): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const dragover = ref(false);
const previewUrl = ref('');
const result = shallowRef<LocalResult | null>(null);

function typeLabel(t?: QrPayloadType): string {
  const map: Record<string, string> = {
    text: '文本',
    url: '网址',
    wifi: 'Wi-Fi',
    contact: '联系人',
    email: '邮件',
    sms: '短信',
    tel: '电话',
    geo: '地理位置',
    event: '日历事件',
  };
  return (t && map[t]) || '未知';
}

function typeIcon(t?: QrPayloadType): string {
  const map: Record<string, string> = {
    text: 'FileText',
    url: 'Link',
    wifi: 'Wifi',
    contact: 'Contact',
    email: 'Mail',
    sms: 'MessageSquarePlus',
    tel: 'Smartphone',
    geo: 'MapPin',
    event: 'Calendar',
  };
  return (t && map[t]) || 'QrCode';
}

function isUrl(s?: string): boolean {
  return !!s && /^https?:\/\//i.test(s.trim());
}

function onDragOver() {
  dragover.value = true;
}
function onDragLeave() {
  dragover.value = false;
}

function pickFile() {
  fileInput.value?.click();
}

async function handleSource(source: string | File) {
  result.value = { ok: false, pending: true };
  emit('update:result', result.value);
  const res = await decodeQr(source as any);
  const next: LocalResult = { ...res };
  result.value = next;
  previewUrl.value = typeof source === 'string' ? source : previewUrl.value;
  emit('update:result', next);
  if (res.ok) emit('decoded', res);
}

async function onDrop(e: DragEvent) {
  dragover.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  await loadAndDecode(file);
}

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  await loadAndDecode(file);
  // 允许重复选择同一文件
  (e.target as HTMLInputElement).value = '';
}

async function loadAndDecode(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    previewUrl.value = reader.result as string;
    handleSource(file);
  };
  reader.readAsDataURL(file);
}

async function copyText() {
  if (!result.value?.data) return;
  try {
    await navigator.clipboard.writeText(result.value.data);
  } catch {
    /* 忽略：剪贴板不可用时静默 */
  }
}

function openUrl() {
  if (result.value?.data && isUrl(result.value.data)) {
    window.open(result.value.data, '_blank');
  }
}
</script>

<style scoped lang="scss">
.qr-drop-zone {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 200px;
  border: 1.5px dashed var(--border-subtle);
  border-radius: var(--radius-card, 14px);
  background: var(--bg-card);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  padding: 18px;
  box-sizing: border-box;

  &:hover {
    border-color: var(--color-primary);
  }
  &.is-dragover {
    border-color: var(--color-primary);
    background: var(--color-primary-light, rgba(99, 102, 241, 0.08));
  }
}

.qr-file-input {
  display: none;
}

.dz-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  text-align: center;
  color: var(--text-muted);
}

.dz-icon {
  color: var(--color-primary);
}

.dz-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.dz-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.dz-fail {
  color: var(--color-error, #e11d48);
}

.dz-result {
  display: flex;
  gap: 14px;
  width: 100%;
  align-items: flex-start;
}

.dz-thumb {
  width: 120px;
  height: 120px;
  object-fit: contain;
  border-radius: var(--radius-btn, 8px);
  border: 1px solid var(--border-subtle);
  background: #fff;
  flex-shrink: 0;
}

.dz-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dz-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}

.dz-text {
  margin: 0;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  padding: 8px 10px;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.dz-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dz-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 12px;
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

.dz-btn-ghost {
  margin-left: auto;
}

.spin {
  animation: dz-spin 1s linear infinite;
}

@keyframes dz-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
