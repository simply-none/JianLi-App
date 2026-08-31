<template>
  <AppDialog v-model="visible" :title="isEdit ? '编辑账户' : '添加账户'" :show-fullscreen="false">
    <div class="add-account">
      <div class="aa-tabs">
        <button :class="['aa-tab', { active: tab === 'manual' }]" @click="tab = 'manual'">手动录入</button>
        <button :class="['aa-tab', { active: tab === 'scan' }]" @click="tab = 'scan'">扫码录入</button>
      </div>

      <!-- 手动录入 -->
      <div v-show="tab === 'manual'" class="aa-body">
        <label class="aa-field">
          <span class="aa-label">服务方（issuer）</span>
          <input v-model="form.issuer" class="aa-input" placeholder="例如：GitHub" />
        </label>
        <label class="aa-field">
          <span class="aa-label">账号（account）</span>
          <input v-model="form.account" class="aa-input" placeholder="例如：me@example.com" />
        </label>
        <label class="aa-field">
          <span class="aa-label">
            密钥（secret）
            <em v-if="isEdit" class="aa-hint">编辑时留空则保持不变</em>
          </span>
          <SecretInput v-model="form.secret" :show-error="!isEdit" />
        </label>
        <div class="aa-row">
          <label class="aa-field aa-field--mini">
            <span class="aa-label">算法</span>
            <select v-model="form.algorithm" class="aa-input">
              <option value="SHA1">SHA1</option>
              <option value="SHA256">SHA256</option>
              <option value="SHA512">SHA512</option>
            </select>
          </label>
          <label class="aa-field aa-field--mini">
            <span class="aa-label">位数</span>
            <select v-model.number="form.digits" class="aa-input">
              <option :value="6">6 位</option>
              <option :value="8">8 位</option>
            </select>
          </label>
          <label class="aa-field aa-field--mini">
            <span class="aa-label">周期</span>
            <select v-model.number="form.period" class="aa-input">
              <option :value="30">30 秒</option>
              <option :value="60">60 秒</option>
            </select>
          </label>
        </div>
        <p v-if="error" class="aa-error">{{ error }}</p>
        <button class="aa-submit" :disabled="!canSubmit || submitting" @click="submit">
          {{ submitting ? '保存中…' : isEdit ? '保存' : '添加' }}
        </button>
      </div>

      <!-- 扫码录入 -->
      <div v-show="tab === 'scan'" class="aa-body">
        <QrDropZone @decoded="onDecoded" />
        <div class="aa-paste">
          <input v-model="pasteUri" class="aa-input" placeholder="或粘贴 otpauth://totp/... 链接" @keyup.enter="parsePaste" />
          <button class="aa-paste-btn" @click="parsePaste">解析</button>
        </div>
        <p class="aa-tip">扫码 / 粘贴后会自动识别并预填到「手动录入」标签页，确认无误即可保存。</p>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 添加 / 编辑账户弹窗
 * - 手动录入：表单 + base32 校验；
 * - 扫码录入：复用全局 QrDropZone / decodeQr，识别 otpauth:// 后预填表单；
 * 密钥仅经 IPC 传给主进程加密，渲染端不落存。
 */
import { ref, reactive, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import SecretInput from './SecretInput.vue';
import QrDropZone from '@/components/qrcode/QrDropZone.vue';
import useTwoFactor from '@/store/useTwoFactor';
import { parseOtpauthUri } from '../utils/otpauth';
import type { TwoFactorAccountMeta, TotpAlgorithm } from '../types';
import type { QrDecodeResult } from '@/utils/qrcode';

const store = useTwoFactor();
const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ editAccount?: TwoFactorAccountMeta | null }>();
const emit = defineEmits<{ (e: 'done'): void }>();

const tab = ref<'manual' | 'scan'>('manual');
const isEdit = computed(() => !!props.editAccount);
const pasteUri = ref('');
const error = ref('');
const submitting = ref(false);

const form = reactive({
  issuer: '',
  account: '',
  secret: '',
  algorithm: 'SHA1' as TotpAlgorithm,
  digits: 6,
  period: 30,
});

const canSubmit = computed(() => {
  if (!form.account.trim()) return false;
  // 编辑时 secret 可留空（保持不变）；新增必须填
  if (!isEdit.value && !form.secret.trim()) return false;
  return true;
});

// 打开弹窗时根据编辑/新增重置表单
watch(
  visible,
  (v) => {
    if (v) {
      error.value = '';
      pasteUri.value = '';
      if (props.editAccount) {
        form.issuer = props.editAccount.issuer;
        form.account = props.editAccount.account;
        form.secret = '';
        form.algorithm = props.editAccount.algorithm;
        form.digits = props.editAccount.digits;
        form.period = props.editAccount.period;
        tab.value = 'manual';
      } else {
        form.issuer = '';
        form.account = '';
        form.secret = '';
        form.algorithm = 'SHA1';
        form.digits = 6;
        form.period = 30;
        tab.value = 'manual';
      }
    }
  },
  { immediate: true },
);

function applyParsed(uri: string) {
  const res = parseOtpauthUri(uri);
  if (!res.ok || !res.input) {
    ElMessage.error(res.error || '无法识别该二维码');
    return;
  }
  form.issuer = res.input.issuer;
  form.account = res.input.account;
  form.secret = res.input.secret;
  form.algorithm = res.input.algorithm || 'SHA1';
  form.digits = res.input.digits || 6;
  form.period = res.input.period || 30;
  tab.value = 'manual';
  ElMessage.success('已识别，请确认后保存');
}

function onDecoded(res: QrDecodeResult) {
  if (res?.ok && res.data) applyParsed(res.data);
  else if (res && !res.ok) ElMessage.error(res.error || '未识别到二维码');
}

function parsePaste() {
  if (!pasteUri.value.trim()) return;
  applyParsed(pasteUri.value.trim());
}

async function submit() {
  error.value = '';
  if (!canSubmit.value) return;
  submitting.value = true;
  const payload = {
    issuer: form.issuer.trim(),
    account: form.account.trim(),
    secret: form.secret.trim().toUpperCase(),
    algorithm: form.algorithm,
    digits: form.digits,
    period: form.period,
  };
  let ok = false;
  if (isEdit.value && props.editAccount) {
    // 编辑：secret 留空则不更新密钥
    const patch: Record<string, any> = {
      issuer: payload.issuer,
      account: payload.account,
      algorithm: payload.algorithm,
      digits: payload.digits,
      period: payload.period,
    };
    if (payload.secret) patch.secret = payload.secret;
    ok = await store.updateAccount(props.editAccount.key, patch);
  } else {
    ok = await store.addAccount(payload);
  }
  submitting.value = false;
  if (ok) {
    ElMessage.success(isEdit.value ? '已保存' : '已添加');
    visible.value = false;
    emit('done');
  } else {
    error.value = store.error || '保存失败';
  }
}
</script>

<style scoped lang="scss">
.add-account {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.aa-tabs {
  display: flex;
  gap: 8px;
}
.aa-tab {
  flex: 1;
  padding: 8px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  &.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }
}
.aa-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.aa-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.aa-label {
  font-size: 12px;
  color: var(--text-secondary);
}
.aa-hint {
  font-style: normal;
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 6px;
}
.aa-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  outline: none;
  &:focus {
    border-color: var(--color-primary);
  }
}
.aa-row {
  display: flex;
  gap: 10px;
}
.aa-field--mini {
  flex: 1;
}
.aa-error {
  margin: 0;
  font-size: 12px;
  color: var(--color-error, #e11d48);
}
.aa-submit {
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-btn, 8px);
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
.aa-paste {
  display: flex;
  gap: 8px;
}
.aa-paste-btn {
  padding: 0 14px;
  font-size: 13px;
  color: #fff;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-btn, 8px);
  cursor: pointer;
  white-space: nowrap;
}
.aa-tip {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
