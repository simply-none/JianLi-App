<template>
  <div class="section">
    <h2 class="section-title">
      <LucideIcon name="UploadCloud" />
      上传文件
    </h2>
    <div class="upload-card">
      <UploadVue
        :limit="10"
        :multiply="true"
        :legacy-store="false"
        @file-saved="handleFileSaved"
        @upload-error="handleUploadError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 资源上传区：复用全局 UploadVue 组件
 * - legacy-store=false：不再写入旧 electron-store（imageResource），改由 SQLite 统一存储
 * - file-saved：单个文件落盘成功后回调，父组件负责去重与入库
 */
import LucideIcon from '@/components/LucideIcon.vue';
import UploadVue from '@/components/upload.vue';
import { ElMessage } from 'element-plus';

/** 组件事件定义 */
const emit = defineEmits<{
  /** 单个文件落盘成功：path/name/size 由 upload.vue 透出 */
  (e: 'file-saved', payload: { path: string; name: string; size: number }): void;
}>();

/**
 * 单文件上传成功：向父组件转发（父组件做去重 + SQLite 入库）
 *
 * @param {Object} payload - 上传结果
 * @param {string} payload.path - 落盘绝对路径
 * @param {string} payload.name - 原始文件名
 * @param {number} payload.size - 文件大小（字节）
 * @returns {void} 无返回值
 */
function handleFileSaved(payload: { path: string; name: string; size: number }) {
  emit('file-saved', payload);
}

/**
 * 上传失败提示
 *
 * @param {Object} payload - 失败信息
 * @param {Object} payload.file - 失败的文件对象
 * @param {unknown} payload.error - 错误内容
 * @returns {void} 无返回值
 */
function handleUploadError(payload: { file: unknown; error: unknown }) {
  ElMessage.error(`文件上传失败：${String((payload as any)?.error || '未知错误')}`);
}
</script>

<style scoped lang="scss">
.section {
  margin-bottom: 20px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 14px;
    padding-bottom: 10px;
    background: linear-gradient(90deg, var(--color-primary), transparent) no-repeat left bottom / 100% 1px;

    .el-icon {
      color: var(--color-primary);
    }
  }
}

.upload-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 20px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
  }
}
</style>
