<template>
  <AppDialog v-model="visible" :title="title" :show-fullscreen="false">
    <div class="uv">
      <!-- 首次设置口令 -->
      <div v-if="mode === 'create'" class="uv-body">
        <input
          v-model="pass"
          class="uv-input"
          type="password"
          placeholder="设置保险箱口令"
          @keyup.enter="doSet"
        />
        <input
          v-model="pass2"
          class="uv-input"
          type="password"
          placeholder="再次确认口令"
          @keyup.enter="doSet"
        />
        <p v-if="error" class="uv-error">{{ error }}</p>
        <button class="uv-submit" :disabled="!canSet || loading" @click="doSet">
          {{ loading ? '创建中…' : '创建保险箱' }}
        </button>
      </div>

      <!-- 解锁 -->
      <div v-else class="uv-body">
        <input
          v-model="pass"
          class="uv-input"
          type="password"
          placeholder="输入保险箱口令"
          @keyup.enter="doUnlock"
        />
        <p v-if="error" class="uv-error">{{ error }}</p>
        <button class="uv-submit" :disabled="!pass || loading" @click="doUnlock">
          {{ loading ? '解锁中…' : '解锁' }}
        </button>
      </div>

      <div class="uv-warn">
        <LucideIcon name="TriangleAlert" :size="14" />
        <span>文件以 AES-256-GCM 本地加密。请务必牢记口令，<b>遗忘将无法恢复</b>；文件名同样加密存储。</span>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * 保险箱入口：首次设置口令 / 解锁。
 * 成功后通知父级刷新状态（密钥由主进程管理，渲染端仅持有口令）。
 */
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import AppDialog from '@/components/AppDialog.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import useFileVault from '../store/useFileVault';

const store = useFileVault();
const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ mode?: 'create' | 'unlock' }>();
const emit = defineEmits<{ (e: 'done'): void }>();

const pass = ref('');
const pass2 = ref('');
const error = ref('');
const loading = ref(false);

const title = computed(() => (props.mode === 'create' ? '创建私密文件保险箱' : '解锁保险箱'));
const canSet = computed(() => !!pass.value && pass.value === pass2.value);

watch(visible, (v) => {
  if (v) {
    pass.value = '';
    pass2.value = '';
    error.value = '';
  }
});

async function doSet() {
  error.value = '';
  if (!canSet.value) {
    error.value = '两次输入的口令不一致';
    return;
  }
  loading.value = true;
  const ok = await store.setPassword(pass.value);
  loading.value = false;
  if (ok) {
    ElMessage.success('保险箱已创建');
    visible.value = false;
    emit('done');
  } else {
    error.value = store.error || '创建失败';
  }
}

async function doUnlock() {
  error.value = '';
  if (!pass.value) return;
  loading.value = true;
  const ok = await store.unlock(pass.value);
  loading.value = false;
  if (ok) {
    ElMessage.success('保险箱已解锁');
    visible.value = false;
    emit('done');
  } else {
    error.value = store.error || '解锁失败';
  }
}
</script>

<style scoped lang="scss">
.uv {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}
.uv-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.uv-input {
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
.uv-error {
  margin: 0;
  font-size: 12px;
  color: var(--color-error, #e11d48);
}
.uv-submit {
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
.uv-warn {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-warning, #d97706);
  background: color-mix(in srgb, var(--color-warning, #d97706) 10%, transparent);
  border-radius: var(--radius-btn, 8px);
  b {
    color: var(--color-error, #e11d48);
  }
}
</style>
