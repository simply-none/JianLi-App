<!--
  API Key 配置组件（可复用）
  用途：TickFlow 接口需要 API Key 才能查询股票数据。
  当未配置 Key 时，整个股票页面只展示此组件；保存后 Key 加密落库（basic_info 表）。
  也可在已配置后通过弹窗复用，用于更新 Key。
-->
<template>
  <div class="api-key-setup">
    <div class="setup-card">
      <div class="setup-icon">
        <LucideIcon name="Key" :size="40" color="var(--color-primary)" />
      </div>
      <h2 class="setup-title">配置 TickFlow API Key</h2>
      <p class="setup-desc">
        股票查询依赖 TickFlow 接口服务，请先填写 API Key。
        Key 会加密后保存到本地数据库基础表，仅本机可用。
      </p>
      <a class="setup-link" @click="openDocs">如何获取 API Key？查看 TickFlow 文档 ↗</a>

      <div class="setup-form">
        <el-input
          v-model="apiKey"
          type="password"
          show-password
          placeholder="粘贴你的 TickFlow API Key"
          :disabled="saving"
          @keyup.enter="save"
        />
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!apiKey.trim()"
          @click="save"
        >
          保存并进入
        </el-button>
      </div>

      <p v-if="error" class="setup-error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { setApiKey } from '../api'

const emit = defineEmits<{ (e: 'done'): void }>()

const apiKey = ref('')
const saving = ref(false)
const error = ref('')

/** 打开 TickFlow 文档（外部链接，走主进程 shell.openExternal） */
async function openDocs() {
  try {
    await window.ipcRenderer.handlePromise('open-external-url', {
      url: 'https://docs.tickflow.org',
    })
  } catch {
    // 打开失败静默处理
  }
}

async function save() {
  const key = apiKey.value.trim()
  if (!key) return
  saving.value = true
  error.value = ''
  try {
    await setApiKey(key)
    emit('done')
  } catch (e) {
    error.value = (e as { message?: string })?.message || '保存失败，请重试'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.api-key-setup {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-primary);

  .setup-card {
    width: 100%;
    max-width: 420px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 32px 28px;
    text-align: center;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
  }

  .setup-icon {
    margin-bottom: 12px;
  }

  .setup-title {
    margin: 0 0 8px;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .setup-desc {
    margin: 0 0 10px;
    font-size: 0.86rem;
    line-height: 1.6;
    color: var(--text-muted);
  }

  .setup-link {
    display: inline-block;
    margin-bottom: 20px;
    font-size: 0.82rem;
    color: var(--color-primary);
    cursor: pointer;
    user-select: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .setup-form {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .el-button {
      width: 100%;
    }
  }

  .setup-error {
    margin: 12px 0 0;
    font-size: 0.82rem;
    color: #e63946;
  }
}
</style>
