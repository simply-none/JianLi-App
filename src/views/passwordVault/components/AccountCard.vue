<template>
  <div class="card">
    <div class="card-head">
      <div class="card-titlewrap">
        <div class="card-title">{{ entry.title }}</div>
        <div class="card-sub">
          <span v-if="entry.username" class="card-user">{{ entry.username }}</span>
          <span v-if="entry.category" class="card-cat">{{ entry.category }}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="card-ic" title="复制账号" @click="copyField('username')"><LucideIcon name="User" :size="15" /></button>
        <button class="card-ic" title="复制密码" @click="copyField('password')"><LucideIcon name="Key" :size="15" /></button>
        <button v-if="entry.hasOtp" class="card-ic" title="复制动态码" @click="copyField('otp')"><LucideIcon name="RefreshCw" :size="15" /></button>
        <button class="card-ic" title="编辑" @click="$emit('edit', entry)"><LucideIcon name="Pencil" :size="15" /></button>
        <button class="card-ic card-ic--danger" title="删除" @click="onDelete"><LucideIcon name="Trash2" :size="15" /></button>
      </div>
    </div>

    <div v-if="entry.url" class="card-url">
      <LucideIcon name="Link" :size="13" />
      <a :href="entry.url" target="_blank" rel="noopener" class="card-link" @click.stop>{{ displayUrl }}</a>
    </div>

    <div class="card-pwd">
      <code class="card-pwdtext">{{ revealed ? (secret || '（无密码）') : '•'.repeat(12) }}</code>
      <button class="card-ic" :title="revealed ? '隐藏' : '显示密码'" @click="toggleReveal">
        <LucideIcon :name="revealed ? 'EyeOff' : 'Eye'" :size="15" />
      </button>
    </div>

    <div v-if="revealed && note" class="card-note">{{ note }}</div>
    <div v-if="entry.hasNote && !revealed" class="card-notehint">
      <LucideIcon name="StickyNotePlus" :size="13" /> 含备注（点“显示密码”查看）
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 单条密码条目卡片
 * ------------------------------------------------------------------
 * 密码明文永不长期驻留渲染端：
 * - “显示密码”时临时向主进程取回明文，隐藏时立即清空本地副本；
 * - “复制密码/账号/动态码”直接由主进程写入剪贴板并定时清空。
 */
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { passwordVaultApi } from '../api/passwordVaultApi';
import type { VaultEntryMeta } from '../types';

const props = defineProps<{ entry: VaultEntryMeta }>();
const emit = defineEmits<{ (e: 'edit', entry: VaultEntryMeta): void; (e: 'delete', entry: VaultEntryMeta): void }>();

const revealed = ref(false);
const secret = ref('');
const note = ref('');

const displayUrl = computed(() => {
  const u = props.entry.url || '';
  return u.replace(/^https?:\/\//, '');
});

async function toggleReveal() {
  if (!revealed.value) {
    const res = await passwordVaultApi.getSecret(props.entry.key);
    if (res.ok) {
      secret.value = res.password || '';
      note.value = res.note || '';
      revealed.value = true;
    } else {
      ElMessage.error(res.error || '获取失败');
    }
  } else {
    revealed.value = false;
    secret.value = '';
    note.value = '';
  }
}

async function copyField(field: 'password' | 'username' | 'otp') {
  const res = await passwordVaultApi.copy(props.entry.key, field);
  if (res.ok) {
    const label = field === 'password' ? '密码' : field === 'username' ? '账号' : '动态码';
    ElMessage.success(`${label}已复制，30 秒后自动清空剪贴板`);
  } else {
    ElMessage.error(res.error || '复制失败');
  }
}

async function onDelete() {
  try {
    await ElMessageBox.confirm(`确定删除「${props.entry.title}」吗？此操作不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
    emit('delete', props.entry);
  } catch {
    /* 用户取消 */
  }
}
</script>

<style scoped lang="scss">
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card, 12px);
  box-shadow: var(--shadow-card, none);
}
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.card-titlewrap {
  min-width: 0;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.card-user {
  font-size: 12px;
  color: var(--text-secondary);
}
.card-cat {
  font-size: 11px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  padding: 1px 8px;
  border-radius: 999px;
}
.card-actions {
  display: flex;
  gap: 2px;
  flex: none;
}
.card-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  &:hover {
    color: var(--color-primary);
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  }
  &--danger:hover {
    color: var(--color-error, #e11d48);
    background: color-mix(in srgb, var(--color-error, #e11d48) 12%, transparent);
  }
}
.card-url {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.card-link {
  color: var(--color-primary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  &:hover {
    text-decoration: underline;
  }
}
.card-pwd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
}
.card-pwdtext {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  letter-spacing: 1px;
  word-break: break-all;
}
.card-note {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  padding: 8px 10px;
  background: var(--bg-base);
  border-radius: var(--radius-btn, 8px);
}
.card-notehint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
