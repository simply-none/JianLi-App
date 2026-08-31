<template>
  <div class="qr-batch">
    <div class="batch-left">
      <div class="batch-head">
        <div class="batch-title">批量内容</div>
        <div class="batch-sub">每行一条，支持文本 / 网址（自动补 https）</div>
      </div>
      <textarea
        v-model="raw"
        class="batch-input"
        placeholder="https://example.com/a&#10;https://example.com/b&#10;欢迎使用渐离App"
        @input="dirty = true"
      />
      <StylePicker
        :model-value="style"
        :preset-id="presetId"
        @update:model-value="(s: any) => store.setStyle(s)"
        @update:preset-id="(id: string) => (presetId = id)"
      />
      <div class="batch-actions">
        <button class="batch-act batch-act-primary" :disabled="!items.length || generating" @click="generateAll">
          <LucideIcon :name="generating ? 'LoaderCircle' : 'QrCode'" :size="15" :class="{ spin: generating }" />
          {{ generating ? '生成中…' : '生成全部' }}
        </button>
        <button class="batch-act" :disabled="!results.length" @click="downloadZip">
          <LucideIcon name="Download" :size="15" /> 打包 ZIP
        </button>
        <button class="batch-act" :disabled="!results.length" @click="saveAllHistory">
          <LucideIcon name="History" :size="15" /> 全部存历史
        </button>
      </div>
    </div>

    <div class="batch-right">
      <div class="batch-count">共 {{ items.length }} 条 · 已生成 {{ results.length }} 张</div>
      <div v-if="results.length" class="batch-grid">
        <div v-for="(r, i) in results" :key="i" class="batch-item">
          <img :src="r.dataUrl" class="batch-thumb" alt="二维码" />
          <div class="batch-item-text" :title="r.text">{{ r.text }}</div>
        </div>
      </div>
      <div v-else class="batch-empty">
        <LucideIcon name="Grid2x2" :size="32" />
        <p>填写内容后点击「生成全部」</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 二维码批量生成页（L3 Tab）
 * 多行文本 → 批量生成 → 打包 ZIP / 全部存历史。
 */
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import StylePicker from '../../components/StylePicker.vue';
import { renderQr, saveQrZip, addQrHistory, buildQrFileName } from '@/utils/qrcode';
import { fileNotify } from '@/utils/fileNotify';
import useQrCodeStore, { QR_SOURCE } from '@/store/useQrCode';

const store = useQrCodeStore();
const raw = ref('');
const dirty = ref(false);
const generating = ref(false);
const results = ref<{ text: string; dataUrl: string }[]>([]);

const style = computed(() => store.currentStyle);
const presetId = computed({
  get: () => store.stylePresetId,
  set: (v) => (store.stylePresetId = v),
});

const items = computed(() =>
  raw.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
);

async function generateAll() {
  const list = items.value;
  if (!list.length) return;
  generating.value = true;
  results.value = [];
  try {
    const out = await Promise.all(
      list.map(async (text) => {
        const res = await renderQr({ data: text, size: 320, ...store.currentStyle });
        return { text, dataUrl: res.dataUrl };
      }),
    );
    results.value = out;
    dirty.value = false;
    ElMessage.success(`已生成 ${out.length} 张`);
  } catch (e: any) {
    ElMessage.error('批量生成失败：' + (e?.message || ''));
  } finally {
    generating.value = false;
  }
}

async function downloadZip() {
  if (!results.value.length) return;
  const res = await saveQrZip({
    files: results.value.map((r) => ({
      name: buildQrFileName(r.text),
      dataUrl: r.dataUrl,
    })),
    defaultName: 'qrcodes',
  });
  if (res?.canceled) return;
  if (res?.ok) fileNotify({ title: '已打包 ZIP', filePath: res.path });
  else ElMessage.error('打包失败：' + (res?.error || ''));
}

async function saveAllHistory() {
  if (!results.value.length) return;
  let ok = 0;
  for (const r of results.value) {
    const rec = await addQrHistory({
      source: QR_SOURCE,
      type: 'text',
      content: r.text,
      style: store.currentStyle,
      note: '批量',
    });
    if (rec) ok++;
  }
  if (ok) {
    store.bumpHistory();
    ElMessage.success(`已存 ${ok} 条历史`);
  } else {
    ElMessage.error('写入历史失败');
  }
}
</script>

<style scoped lang="scss">
.qr-batch {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.batch-left {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
}

.batch-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.batch-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.batch-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.batch-sub {
  font-size: 12px;
  color: var(--text-muted);
}

.batch-input {
  height: 160px;
  padding: 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-mono, monospace);
  resize: vertical;
  outline: none;
  &:focus {
    border-color: var(--color-primary);
  }
}

.batch-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.batch-act {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
.batch-act-primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  &:hover:not(:disabled) {
    color: #fff;
    background: var(--color-primary-hover, #5457e0);
  }
}

.batch-count {
  font-size: 13px;
  color: var(--text-muted);
}

.batch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
}

.batch-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px;
  background: #fff;
  border-radius: var(--radius-card, 12px);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
}

.batch-thumb {
  width: 110px;
  height: 110px;
  object-fit: contain;
}

.batch-item-text {
  width: 100%;
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.batch-empty {
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

.spin {
  animation: batch-spin 1s linear infinite;
}
@keyframes batch-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
