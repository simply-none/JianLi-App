<template>
  <div class="qr-scan">
    <div class="scan-head">
      <LucideIcon name="ScanQrCode" :size="20" class="scan-head-icon" />
      <div>
        <div class="scan-title">识别二维码</div>
        <div class="scan-sub">拖拽 / 点击选择二维码图片，自动多尺度重试识别</div>
      </div>
    </div>

    <QrDropZone class="scan-zone" @decoded="onDecoded" />

    <div v-if="lastResult" class="scan-last">
      <div class="scan-last-label">最近一次识别</div>
      <pre class="scan-last-text">{{ lastResult.data }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 二维码识别页（L3 Tab）
 * 复用 QrDropZone：拖拽/选择图片 → 解码 → 复制/打开。
 */
import { ref } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import QrDropZone from '@/components/qrcode/QrDropZone.vue';
import type { QrDecodeResult } from '@/utils/qrcode';

const lastResult = ref<QrDecodeResult | null>(null);

function onDecoded(res: QrDecodeResult) {
  lastResult.value = res;
}
</script>

<style scoped lang="scss">
.qr-scan {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.scan-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.scan-head-icon {
  color: var(--color-primary);
}
.scan-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.scan-sub {
  font-size: 13px;
  color: var(--text-muted);
}

.scan-zone {
  flex: 1;
}

.scan-last {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.scan-last-label {
  font-size: 12px;
  color: var(--text-muted);
}
.scan-last-text {
  margin: 0;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  padding: 10px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 140px;
  overflow: auto;
}
</style>
