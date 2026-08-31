<template>
  <div class="qr-code-view" :class="{ 'is-loading': loading }">
    <!-- 二维码图片（dataURL 渲染，PNG，便于保存/复制） -->
    <img
      v-if="dataUrl && !error"
      :src="dataUrl"
      :width="size"
      :height="size"
      class="qr-img"
      alt="二维码"
      draggable="false"
    />

    <!-- 加载态 -->
    <div v-else-if="loading" class="qr-state qr-loading">
      <LucideIcon name="LoaderCircle" :size="28" class="spin" />
      <span>生成中…</span>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="qr-state qr-error">
      <LucideIcon name="CircleAlert" :size="28" />
      <span>{{ error }}</span>
    </div>

    <!-- 空态 -->
    <div v-else class="qr-state qr-empty">
      <LucideIcon name="QrCode" :size="28" />
      <span>暂无内容</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 二维码渲染视图（L2 复用组件）
 * 唯一职责：把「原始文本 + 样式」渲染成二维码 PNG。
 * - 不依赖任何业务，任意模块可 <QrCodeView :content="..." /> 复用。
 * - 内部调用能力层 engine.renderQr（唯一接触 qr-code-styling）。
 * - 通过 expose 暴露 getDataUrl()，供对话框/页面做保存、复制、打包。
 */
import { ref, watch, onBeforeUnmount } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { renderQr } from '@/utils/qrcode';
import type { QrStyleOptions } from '@/utils/qrcode';
import { debounce } from '@/utils';

const props = withDefaults(
  defineProps<{
    /** 二维码原始文本（未编码，UTF-8 修正由 engine 内部完成） */
    content: string;
    /** 视觉样式（可选，缺省用引擎默认） */
    styleOptions?: QrStyleOptions | null;
    /** 像素尺寸，默认 320 */
    size?: number;
    /** 内容/样式变化后是否自动重渲，默认 true */
    autoRender?: boolean;
    /** 重渲防抖间隔（ms），默认 250 */
    debounceMs?: number;
  }>(),
  {
    styleOptions: null,
    size: 320,
    autoRender: true,
    debounceMs: 250,
  },
);

const emit = defineEmits<{
  (e: 'rendered', dataUrl: string): void;
  (e: 'error', message: string): void;
}>();

const dataUrl = ref<string>('');
const loading = ref(false);
const error = ref<string>('');

let canceled = false;

async function doRender() {
  if (canceled) return;
  if (!props.content || !props.content.trim()) {
    dataUrl.value = '';
    error.value = '';
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const res = await renderQr({
      data: props.content,
      size: props.size,
      ...(props.styleOptions || {}),
    });
    if (canceled) return;
    dataUrl.value = res.dataUrl;
    emit('rendered', res.dataUrl);
  } catch (err: any) {
    if (canceled) return;
    error.value = err?.message || '生成失败';
    emit('error', error.value);
  } finally {
    if (!canceled) loading.value = false;
  }
}

// 防抖重渲（输入态避免每次按键都重新生成）
const debouncedRender = debounce(doRender, props.debounceMs);

watch(
  () => [props.content, props.styleOptions, props.size],
  () => {
    if (props.autoRender) debouncedRender();
  },
  { deep: true },
);

// 初始渲染（内容可能由 prop 直接传入）
if (props.autoRender && props.content) {
  doRender();
}

onBeforeUnmount(() => {
  canceled = true;
});

/** 手动触发重渲（如样式在外部变更后） */
async function render() {
  await doRender();
}

/** 获取当前 PNG dataURL（供保存/复制/打包），未生成返回空串 */
function getDataUrl(): string {
  return dataUrl.value;
}

defineExpose({ render, getDataUrl, dataUrl });
</script>

<style scoped lang="scss">
.qr-code-view {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.qr-img {
  display: block;
  border-radius: var(--radius-btn, 8px);
  background: #fff;
  user-select: none;
}

.qr-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-width: 160px;
  min-height: 160px;
  color: var(--text-muted);
  font-size: 13px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-base);
}

.qr-error {
  color: var(--color-error, #e11d48);
  border-color: var(--color-error, #e11d48);
}

.spin {
  animation: qr-spin 1s linear infinite;
}

@keyframes qr-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
