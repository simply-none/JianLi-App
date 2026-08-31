<template>
  <AppDialog v-model="visible" :title="isEdit ? '编辑条目' : '添加条目'" :show-fullscreen="false">
    <div class="ae">
      <label class="ae-field">
        <span class="ae-label">名称 <i>*</i></span>
        <input v-model="form.title" class="ae-input" placeholder="如：GitHub / 公司邮箱" />
      </label>

      <label class="ae-field">
        <span class="ae-label">用户名 / 账号</span>
        <input v-model="form.username" class="ae-input" placeholder="邮箱或用户名" />
      </label>

      <div class="ae-field">
        <span class="ae-label">密码 <i>*</i></span>
        <div class="ae-pwd">
          <input v-model="form.password" class="ae-input" :type="reveal ? 'text' : 'password'" placeholder="输入或生成密码" />
          <button class="ae-icon" :title="reveal ? '隐藏' : '显示'" @click="reveal = !reveal">
            <LucideIcon :name="reveal ? 'EyeOff' : 'Eye'" :size="16" />
          </button>
          <button class="ae-icon" title="生成强密码" @click="showGen = true">
            <LucideIcon name="Wand" :size="16" />
          </button>
        </div>
      </div>

      <label class="ae-field">
        <span class="ae-label">网址</span>
        <input v-model="form.url" class="ae-input" placeholder="https://example.com" />
      </label>

      <label class="ae-field">
        <span class="ae-label">分类</span>
        <input v-model="form.category" class="ae-input" placeholder="如：工作 / 社交 / 金融" />
      </label>

      <label class="ae-field">
        <span class="ae-label">TOTP 密钥（可选）</span>
        <input v-model="form.otpSecret" class="ae-input" placeholder="base32 密钥，与 2FA 打通" />
      </label>

      <label class="ae-field">
        <span class="ae-label">备注</span>
        <textarea v-model="form.note" class="ae-textarea" rows="3" placeholder="附加信息（仅本地加密保存）"></textarea>
      </label>

      <p v-if="error" class="ae-error">{{ error }}</p>

      <div class="ae-actions">
        <button class="ae-btn" @click="visible = false">取消</button>
        <button class="ae-btn ae-btn--primary" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </div>

    <PasswordGenerator v-model="showGen" @apply="onGenerated" />
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 新增 / 编辑密码条目对话框。
 * 密码字段仅在本地收集并经由 IPC 传给主进程加密，不写入应用数据库。
 * 通过 PasswordGenerator 组件生成强密码并回填。
 */
import { ref, watch, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import usePasswordVault from '../store/usePasswordVault';
import PasswordGenerator from './PasswordGenerator.vue';
import type { VaultEntryMeta, VaultEntryInput } from '../types';

const store = usePasswordVault();
const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ editEntry?: VaultEntryMeta | null }>();
const emit = defineEmits<{ (e: 'done'): void }>();

const isEdit = ref(false);
const reveal = ref(false);
const showGen = ref(false);
const saving = ref(false);
const error = ref('');

interface FormState {
  title: string;
  username: string;
  password: string;
  url: string;
  category: string;
  otpSecret: string;
  note: string;
}

const blank = (): FormState => ({ title: '', username: '', password: '', url: '', category: '', otpSecret: '', note: '' });
const form = reactive<FormState>(blank());

watch(visible, (v) => {
  if (v) {
    error.value = '';
    reveal.value = false;
    const e = props.editEntry;
    isEdit.value = !!e;
    Object.assign(form, blank());
    if (e) {
      form.title = e.title;
      form.username = e.username;
      form.url = e.url || '';
      form.category = e.category || '';
      form.password = '';
      form.otpSecret = '';
      form.note = '';
    }
  }
});

function onGenerated(value: string) {
  form.password = value;
  reveal.value = true;
}

async function save() {
  error.value = '';
  if (!form.title.trim()) {
    error.value = '请填写名称';
    return;
  }
  if (!form.password) {
    error.value = '请填写密码（可点击魔杖生成）';
    return;
  }
  saving.value = true;
  const payload: VaultEntryInput = {
    title: form.title.trim(),
    username: form.username.trim(),
    password: form.password,
    url: form.url.trim() || undefined,
    category: form.category.trim() || undefined,
    otpSecret: form.otpSecret.trim() || undefined,
    note: form.note || undefined,
  };
  const ok = isEdit.value && props.editEntry
    ? await store.updateEntry(props.editEntry.key, payload)
    : await store.addEntry(payload);
  saving.value = false;
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
.ae {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px;
}
.ae-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ae-label {
  font-size: 13px;
  color: var(--text-secondary);
  i {
    color: var(--color-error, #e11d48);
    font-style: normal;
  }
}
.ae-input,
.ae-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  outline: none;
  font-family: inherit;
  &:focus {
    border-color: var(--color-primary);
  }
}
.ae-textarea {
  resize: vertical;
}
.ae-pwd {
  display: flex;
  align-items: center;
  gap: 6px;
  .ae-input {
    flex: 1;
  }
}
.ae-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: var(--radius-btn, 8px);
  cursor: pointer;
  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
}
.ae-error {
  margin: 0;
  font-size: 12px;
  color: var(--color-error, #e11d48);
}
.ae-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.ae-btn {
  padding: 8px 16px;
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
    &:hover {
      color: #fff;
      filter: brightness(1.05);
    }
  }
}
</style>
