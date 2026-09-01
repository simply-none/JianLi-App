<template>
  <AppDialog v-model="visible" :title="title" :show-fullscreen="true">
    <div class="pv">
      <div v-if="loading" class="pv-state">解密预览中…</div>
      <div v-else-if="error" class="pv-state pv-state--err">{{ error }}</div>

      <template v-else-if="url">
        <img v-if="isImage" :src="url" class="pv-img" alt="preview" />
        <iframe v-else-if="isPdf" :src="url" class="pv-frame" />
        <audio v-else-if="isAudio" :src="url" class="pv-audio" controls />
        <video v-else-if="isVideo" :src="url" class="pv-frame" controls />
        <pre v-else-if="textContent !== null" class="pv-text">{{ textContent }}</pre>
        <div v-else class="pv-state">
          <LucideIcon name="FileBox" :size="40" />
          <p>该类型暂不支持内嵌预览，请点击「导出解密」后查看。</p>
        </div>
      </template>

      <div class="pv-footer">
        <span class="pv-name" :title="file?.name">{{ file?.name }}</span>
        <div class="pv-actions">
          <button class="pv-btn" @click="$emit('export', file)">
            <LucideIcon name="Download" :size="16" /> 导出解密
          </button>
          <button class="pv-btn pv-btn--primary" @click="visible = false">关闭</button>
        </div>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 文件预览对话框：主进程解密到临时目录 → 渲染端经 jlocal 协议展示。
 * 关闭时通知父级清理临时目录（锁定前也由主进程统一清）。
 */
import { ref, computed, watch } from 'vue';
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { fileVaultApi } from '../api/fileVaultApi';
import type { VaultFileMeta } from '../types';

const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ file: VaultFileMeta | null }>();
const emit = defineEmits<{ (e: 'closed'): void; (e: 'export', file: VaultFileMeta | null): void }>();

const url = ref('');
const loading = ref(false);
const error = ref('');
const textContent = ref<string | null>(null);

const title = computed(() => (props.file ? `预览：${props.file.name}` : '预览'));
const mime = computed(() => props.file?.mime || '');
const isImage = computed(() => mime.value.startsWith('image/'));
const isPdf = computed(() => mime.value === 'application/pdf');
const isAudio = computed(() => mime.value.startsWith('audio/'));
const isVideo = computed(() => mime.value.startsWith('video/'));
const isText = computed(() => mime.value.startsWith('text/') || mime.value === 'application/json');

watch(visible, async (v) => {
  if (v && props.file) {
    await openPreview(props.file);
  } else {
    reset();
    emit('closed');
  }
});

function reset() {
  url.value = '';
  loading.value = false;
  error.value = '';
  textContent.value = null;
}

async function openPreview(file: VaultFileMeta) {
  reset();
  loading.value = true;
  try {
    const res = await fileVaultApi.decryptTemp(file.id);
    if (!res.ok || !res.tempPath) {
      error.value = res.error || '预览失败';
      return;
    }
    const jlocal = `jlocal:///${res.tempPath.replace(/\\/g, '/')}`;
    url.value = jlocal;
    if (isText.value) {
      try {
        const resp = await fetch(jlocal);
        textContent.value = await resp.text();
      } catch {
        textContent.value = null; // 回退到「导出查看」
      }
    }
  } catch (e: any) {
    error.value = e?.message || '预览失败';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.pv {
  display: flex;
  flex-direction: column;
  min-height: 60vh;
  gap: 12px;
}
.pv-state {
  margin: auto;
  text-align: center;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  p {
    margin: 0;
    font-size: 13px;
  }
  &--err {
    color: var(--color-error, #e11d48);
  }
}
.pv-img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  margin: 0 auto;
  border-radius: 8px;
}
.pv-frame {
  width: 100%;
  height: 60vh;
  border: none;
  border-radius: 8px;
  background: #fff;
}
.pv-audio {
  width: 100%;
}
.pv-text {
  flex: 1;
  margin: 0;
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.pv-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}
.pv-name {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-actions {
  display: flex;
  gap: 8px;
  flex: none;
}
.pv-btn {
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
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  &--primary {
    color: #fff;
    background: var(--color-primary);
    border-color: var(--color-primary);
  }
}
</style>
