<template>
  <div class="account-card">
    <div class="account-card__head">
      <div class="account-card__title">
        <span class="account-card__issuer">{{ account.issuer || '未命名服务' }}</span>
        <span class="account-card__account">{{ account.account }}</span>
      </div>
      <CountdownRing :remaining="code?.remainingSeconds ?? 0" :period="account.period" />
    </div>

    <div class="account-card__code" @click="copy">
      <span class="account-card__code-text">{{ maskedCode }}</span>
      <LucideIcon name="Copy" :size="16" class="account-card__copy-icon" />
    </div>

    <div class="account-card__meta">
      <span class="tag">{{ account.algorithm }}</span>
      <span class="tag">{{ account.digits }} 位</span>
      <span class="tag">{{ account.period }}s</span>
    </div>

    <div class="account-card__actions">
      <button class="ac-btn" title="复制验证码" @click="copy">
        <LucideIcon name="Copy" :size="14" /> 复制
      </button>
      <button class="ac-btn" title="生成二维码（迁移到其他验证器）" @click="onQr">
        <LucideIcon name="QrCode" :size="14" /> 二维码
      </button>
      <button class="ac-btn" title="编辑" @click="emit('edit', account)">
        <LucideIcon name="Pencil" :size="14" /> 编辑
      </button>
      <button class="ac-btn ac-btn--danger" title="删除" @click="onDelete">
        <LucideIcon name="Trash" :size="14" /> 删除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 单账户卡片：服务名/账号 + 大字验证码 + 倒计时环 + 复制/二维码/编辑/删除。
 * 验证码由父级计时器统一驱动（codes 映射按 key 取），本组件只负责展示与交互。
 */
import { computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import CountdownRing from './CountdownRing.vue';
import type { TwoFactorAccountMeta, TwoFactorCode } from '../types';
import { twoFactorApi } from '../api/twoFactorApi';
import { showQrCode } from '@/components/qrcode/service';

const props = defineProps<{ account: TwoFactorAccountMeta; code?: TwoFactorCode }>();
const emit = defineEmits<{
  (e: 'edit', a: TwoFactorAccountMeta): void;
  (e: 'deleted'): void;
}>();

/** 每 3-4 位插入空格，便于人眼核对（不改码值） */
const maskedCode = computed(() => {
  const c = props.code?.code || '';
  if (!c) return '······';
  return c.replace(/(.{3,4})(?=.)/g, '$1 ');
});

async function copy(): Promise<void> {
  if (!props.code) return;
  try {
    window.ipcRenderer.clipboard.writeText(props.code.code);
    ElMessage.success('验证码已复制');
  } catch {
    ElMessage.error('复制失败');
  }
}

async function onQr(): Promise<void> {
  const res = await twoFactorApi.exportUri(props.account.key);
  if (res?.ok) {
    const title = `${props.account.issuer || ''} ${props.account.account}`.trim() || '2FA 二维码';
    showQrCode({ content: res.uri, title, defaultName: `2fa-${props.account.key}` });
  } else {
    ElMessage.error(res?.error || '生成二维码失败');
  }
}

async function onDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${props.account.issuer || props.account.account}」的验证器？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
    const res = await twoFactorApi.deleteAccount(props.account.key);
    if (res?.ok) {
      ElMessage.success('已删除');
      emit('deleted');
    } else {
      ElMessage.error(res?.error || '删除失败');
    }
  } catch {
    /* 用户取消 */
  }
}
</script>

<style scoped lang="scss">
.account-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card, 14px);
  box-sizing: border-box;
}
.account-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.account-card__title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.account-card__issuer {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-card__account {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-card__code {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: var(--bg-base);
  border-radius: var(--radius-btn, 8px);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
  &:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  }
}
.account-card__code-text {
  font-family: var(--font-mono, monospace);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.account-card__copy-icon {
  color: var(--text-muted);
}
.account-card__meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  color: var(--text-secondary);
}
.account-card__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ac-btn {
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
  &--danger:hover {
    border-color: var(--color-error, #e11d48);
    color: var(--color-error, #e11d48);
  }
}
</style>
