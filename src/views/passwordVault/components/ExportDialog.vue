<template>
  <AppDialog v-model="visible" title="导出 / 备份保险库" :show-fullscreen="false">
    <div class="ex">
      <button class="ex-file" @click="chooseSave">
        <LucideIcon name="Save" :size="16" />
        <span>{{ savePath || '选择导出位置…' }}</span>
      </button>

      <div class="ex-opt">
        <label class="ex-check">
          <input type="checkbox" v-model="useNewPass" />
          使用新口令加密（留空则沿用当前口令）
        </label>
      </div>

      <template v-if="useNewPass">
        <input v-model="newPass" class="ex-input" type="password" placeholder="新口令" />
        <input v-model="newPass2" class="ex-input" type="password" placeholder="再次确认新口令" />
      </template>

      <p v-if="error" class="ex-error">{{ error }}</p>

      <div class="ex-actions">
        <button class="ex-btn" @click="visible = false">取消</button>
        <button class="ex-btn ex-btn--primary" :disabled="!savePath || saving" @click="doExport">
          {{ saving ? '导出中…' : '导出' }}
        </button>
      </div>
      <div class="ex-warn">
        <LucideIcon name="ShieldAlert" :size="14" />
        <span>导出的文件同样以 AES-256-GCM 加密，请妥善保管；用新口令导出会生成独立备份，不影响当前保险库。</span>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 导出 / 备份对话框：将内存保险库加密写入新文件。
 * 可选使用新口令（生成独立备份），否则沿用当前口令。
 */
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import usePasswordVault from '../store/usePasswordVault';
import { passwordVaultApi } from '../api/passwordVaultApi';

const store = usePasswordVault();
const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ pauseLock?: () => void; resumeLock?: () => void }>();
const emit = defineEmits<{ (e: 'done'): void }>();

const savePath = ref('');
const useNewPass = ref(false);
const newPass = ref('');
const newPass2 = ref('');
const error = ref('');
const saving = ref(false);

watch(visible, (v) => {
  if (v) {
    savePath.value = '';
    useNewPass.value = false;
    newPass.value = '';
    newPass2.value = '';
    error.value = '';
  }
});

async function chooseSave() {
  props.pauseLock?.();
  const p = await passwordVaultApi.pickSave('password-vault-backup');
  props.resumeLock?.();
  if (p) savePath.value = p;
}

async function doExport() {
  error.value = '';
  if (!savePath.value) return;
  if (useNewPass.value) {
    if (!newPass.value) {
      error.value = '请输入新口令';
      return;
    }
    if (newPass.value !== newPass2.value) {
      error.value = '两次口令不一致';
      return;
    }
  }
  saving.value = true;
  const ok = await store.exportVault(savePath.value, useNewPass.value ? newPass.value : undefined);
  saving.value = false;
  if (ok) {
    ElMessage.success('已导出加密备份');
    visible.value = false;
    emit('done');
  } else {
    error.value = store.error || '导出失败';
  }
}
</script>

<style scoped lang="scss">
.ex {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px;
}
.ex-file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}
.ex-opt {
  font-size: 13px;
}
.ex-check {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  cursor: pointer;
}
.ex-input {
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
.ex-error {
  margin: 0;
  font-size: 12px;
  color: var(--color-error, #e11d48);
}
.ex-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.ex-btn {
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
.ex-warn {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-warning, #d97706);
  background: color-mix(in srgb, var(--color-warning, #d97706) 10%, transparent);
  border-radius: var(--radius-btn, 8px);
}
</style>
