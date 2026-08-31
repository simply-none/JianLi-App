<template>
  <AppDialog v-model="visible" title="导入或新建 2FA 保险库" :show-fullscreen="false">
    <div class="vault-gate">
      <div class="vg-tabs">
        <button :class="['vg-tab', { active: tab === 'open' }]" @click="tab = 'open'">导入已有</button>
        <button :class="['vg-tab', { active: tab === 'create' }]" @click="tab = 'create'">新建保险库</button>
      </div>

      <!-- 导入已有 -->
      <div v-if="tab === 'open'" class="vg-body">
        <button class="vg-file" @click="chooseOpen">
          <LucideIcon name="FolderOpen" :size="16" />
          <span>{{ openPath || '选择保险库文件…' }}</span>
        </button>
        <input v-model="openPass" class="vg-input" type="password" placeholder="保险库口令" @keyup.enter="doOpen" />
        <p v-if="error" class="vg-error">{{ error }}</p>
        <button class="vg-submit" :disabled="!openPath || !openPass || loading" @click="doOpen">
          {{ loading ? '导入中…' : '导入' }}
        </button>
      </div>

      <!-- 新建 -->
      <div v-else class="vg-body">
        <button class="vg-file" @click="chooseSave">
          <LucideIcon name="Save" :size="16" />
          <span>{{ savePath || '选择保存位置…' }}</span>
        </button>
        <input v-model="createPass" class="vg-input" type="password" placeholder="设置保险库口令" @keyup.enter="doCreate" />
        <input v-model="createPass2" class="vg-input" type="password" placeholder="再次确认口令" @keyup.enter="doCreate" />
        <p v-if="error" class="vg-error">{{ error }}</p>
        <button class="vg-submit" :disabled="!savePath || !createPass || createPass !== createPass2 || loading" @click="doCreate">
          {{ loading ? '创建中…' : '新建' }}
        </button>
      </div>

      <div class="vg-warn">
        <LucideIcon name="ShieldAlert" :size="14" />
        <span>密钥文件用 AES-256-GCM 加密（口令派生）。请务必牢记口令，遗忘将无法恢复；文件请保存到安全位置。</span>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 保险库入口弹窗：导入已有 / 新建。
 * 成功后关闭弹窗并通知父级刷新列表。密钥文件由主进程加解密，渲染端仅持有口令与路径。
 */
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import useTwoFactor from '@/store/useTwoFactor';
import { twoFactorApi } from '../api/twoFactorApi';

const store = useTwoFactor();
const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ initialTab?: 'open' | 'create'; initialPath?: string }>();
const emit = defineEmits<{ (e: 'done'): void }>();

const tab = ref<'open' | 'create'>('open');
const openPath = ref('');
const openPass = ref('');
const savePath = ref('');
const createPass = ref('');
const createPass2 = ref('');
const error = ref('');
const loading = ref(false);

watch(visible, (v) => {
  if (v) {
    tab.value = props.initialTab || 'open';
    // 有“上次路径”时预填导入框，支撑“快速导入上次”
    if (tab.value === 'open' && props.initialPath && !openPath.value) {
      openPath.value = props.initialPath;
    }
  }
});

async function chooseOpen() {
  const p = await twoFactorApi.pickOpen();
  if (p) openPath.value = p;
}
async function chooseSave() {
  const p = await twoFactorApi.pickSave('2fa-vault');
  if (p) savePath.value = p;
}

async function doOpen() {
  error.value = '';
  if (!openPath.value || !openPass.value) return;
  loading.value = true;
  const ok = await store.openVault(openPath.value, openPass.value);
  loading.value = false;
  if (ok) {
    ElMessage.success('保险库已导入');
    visible.value = false;
    emit('done');
  } else {
    error.value = store.error || '导入失败';
  }
}

async function doCreate() {
  error.value = '';
  if (!savePath.value || !createPass.value || createPass.value !== createPass2.value) return;
  loading.value = true;
  const ok = await store.createVault(savePath.value, createPass.value);
  loading.value = false;
  if (ok) {
    ElMessage.success('保险库已创建');
    visible.value = false;
    emit('done');
  } else {
    error.value = store.error || '创建失败';
  }
}
</script>

<style scoped lang="scss">
.vault-gate {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}
.vg-tabs {
  display: flex;
  gap: 8px;
}
.vg-tab {
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
.vg-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.vg-file {
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
.vg-input {
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
.vg-error {
  margin: 0;
  font-size: 12px;
  color: var(--color-error, #e11d48);
}
.vg-submit {
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
.vg-warn {
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
