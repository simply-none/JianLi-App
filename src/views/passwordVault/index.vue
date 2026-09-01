<template>
  <div class="pw">
    <!-- 未解锁：空态 / 锁定引导 -->
    <div v-if="!store.hasVault" class="pw-empty">
      <LucideIcon name="KeyRound" :size="56" class="pw-empty__icon" />
      <h2 class="pw-empty__title">账号密码管理</h2>
      <p class="pw-empty__desc">
        本地加密密码保险库，复用 2FA 的 AES-256-GCM 安全架构。密码仅存于内存与你的加密文件，绝不进入应用数据库。
      </p>
      <div class="pw-empty__actions">
        <button class="pw-btn pw-btn--primary" @click="openUnlock">
          <LucideIcon name="FolderOpen" :size="16" /> {{ store.lastPath ? '解锁保险库' : '导入保险库' }}
        </button>
        <button class="pw-btn" @click="openCreate">
          <LucideIcon name="Plus" :size="16" /> 新建保险库
        </button>
      </div>
      <button v-if="store.lastPath" class="pw-empty__quick" @click="quickUnlock">
        快速解锁上次：<code>{{ store.lastPath }}</code>
      </button>
    </div>

    <!-- 已解锁：工具栏 + 搜索 + 列表 -->
    <template v-else>
      <div class="pw-toolbar">
        <div class="pw-toolbar__title">
          <LucideIcon name="KeyRound" :size="20" />
          <span>账号密码管理</span>
          <span class="pw-count">{{ store.entries.length }} 条</span>
        </div>
        <div class="pw-toolbar__actions">
          <button class="pw-btn pw-btn--primary" @click="openAdd">
            <LucideIcon name="Plus" :size="16" /> 添加
          </button>
          <button class="pw-btn" @click="showGen = true">
            <LucideIcon name="Wand" :size="16" /> 生成密码
          </button>
          <button class="pw-btn" @click="showExport = true">
            <LucideIcon name="Download" :size="16" /> 导出备份
          </button>
          <button class="pw-btn" @click="lockNow">
            <LucideIcon name="Lock" :size="16" /> 锁定
          </button>
        </div>
      </div>

      <div class="pw-filters">
        <div class="pw-search">
          <LucideIcon name="Search" :size="15" />
          <input v-model="search" class="pw-search__input" placeholder="搜索名称 / 账号 / 网址 / 分类" />
        </div>
        <div class="pw-cats">
          <button :class="['pw-chip', { active: !category }]" @click="category = ''">全部</button>
          <button
            v-for="c in categories"
            :key="c"
            :class="['pw-chip', { active: category === c }]"
            @click="category = c"
          >{{ c }}</button>
        </div>
      </div>

      <div v-if="filtered.length" class="pw-listwrap">
        <AccountList :entries="filtered" @edit="onEdit" @delete="onDelete" />
      </div>
      <div v-else class="pw-noresult">
        <LucideIcon name="SearchX" :size="36" />
        <p>没有匹配的条目</p>
      </div>
    </template>

    <!-- 弹窗 -->
    <VaultGate
      v-model="showGate"
      :initial-tab="gateTab"
      :initial-path="gatePath"
      :hide-create="gateHideCreate"
      :pause-lock="autoLock.pause"
      :resume-lock="autoLock.resume"
      @done="onVaultDone"
    />
    <AddEditDialog v-model="showAdd" :edit-entry="editing" @done="onChanged" />
    <ExportDialog v-model="showExport" :pause-lock="autoLock.pause" :resume-lock="autoLock.resume" @done="onChanged" />
    <PasswordGenerator v-model="showGen" />
  </div>
</template>

<script setup lang="ts">
/**
 * 账号密码管理主视图
 * - 未解锁：引导导入 / 解锁 / 新建；
 * - 已解锁：搜索 + 分类过滤 + 卡片列表 + 自动锁定（失焦 + 空闲）。
 * 所有密钥操作委托主进程，渲染端不持有明文。
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import usePasswordVault from './store/usePasswordVault';
import { useAutoLock } from '@/composables/useAutoLock';
import AccountList from './components/AccountList.vue';
import VaultGate from './components/VaultGate.vue';
import AddEditDialog from './components/AddEditDialog.vue';
import ExportDialog from './components/ExportDialog.vue';
import PasswordGenerator from './components/PasswordGenerator.vue';
import type { VaultEntryMeta } from './types';

const store = usePasswordVault();
const idleMinutes = ref(5);
const autoLock = useAutoLock({
  idleMinutes,
  onLock: () => onAutoLock(),
});

const showGate = ref(false);
const gateTab = ref<'open' | 'create'>('open');
const gatePath = ref('');
const gateHideCreate = ref(false);

const showAdd = ref(false);
const editing = ref<VaultEntryMeta | null>(null);
const showExport = ref(false);
const showGen = ref(false);

const search = ref('');
const category = ref('');

const categories = computed(() => {
  const set = new Set<string>();
  store.entries.forEach((e) => e.category && set.add(e.category));
  return Array.from(set);
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return store.entries.filter((e) => {
    if (category.value && e.category !== category.value) return false;
    if (!q) return true;
    return [e.title, e.username, e.url, e.category].some((f) => (f || '').toLowerCase().includes(q));
  });
});

onMounted(async () => {
  await store.init();
  if (store.hasVault) autoLock.start();
});

onUnmounted(() => autoLock.stop());

// 解锁状态变化时联动自动锁定监听
watch(
  () => store.hasVault,
  (v) => {
    if (v) autoLock.start();
    else autoLock.stop();
  },
);

function openUnlock() {
  gateTab.value = 'open';
  gateHideCreate.value = false;
  gatePath.value = store.lastPath || '';
  showGate.value = true;
}
function quickUnlock() {
  gateTab.value = 'open';
  gateHideCreate.value = true;
  gatePath.value = store.lastPath || '';
  showGate.value = true;
}
function openCreate() {
  gateTab.value = 'create';
  gateHideCreate.value = false;
  gatePath.value = '';
  showGate.value = true;
}
function onVaultDone() {
  autoLock.start();
}
function openAdd() {
  editing.value = null;
  showAdd.value = true;
}
function onEdit(e: VaultEntryMeta) {
  editing.value = e;
  showAdd.value = true;
}
async function onDelete(e: VaultEntryMeta) {
  const ok = await store.deleteEntry(e.key);
  if (ok) ElMessage.success('已删除');
  else ElMessage.error(store.error || '删除失败');
}
async function onChanged() {
  await store.refresh();
}
async function lockNow() {
  await store.lockVault();
  ElMessage.success('已锁定（内存中的密钥已清空）');
  quickUnlock();
}
function onAutoLock() {
  // 由失焦 / 空闲触发：清空内存并弹出解锁框（不打扰式提示）
  store.lockVault();
  quickUnlock();
}
</script>

<style scoped lang="scss">
.pw {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  overflow: auto;
}

/* 空态 */
.pw-empty {
  margin: auto;
  max-width: 480px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.pw-empty__icon {
  color: var(--color-primary);
}
.pw-empty__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}
.pw-empty__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-muted);
}
.pw-empty__actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.pw-empty__quick {
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  code {
    color: var(--color-primary);
  }
}

/* 工具栏 */
.pw-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.pw-toolbar__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.pw-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
  padding: 2px 8px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  border-radius: 999px;
}
.pw-toolbar__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 过滤区 */
.pw-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.pw-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 220px;
  padding: 8px 10px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  color: var(--text-muted);
  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: var(--text-primary);
  }
}
.pw-cats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pw-chip {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  &.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }
}

.pw-listwrap {
  flex: 1;
}
.pw-noresult {
  margin: auto;
  text-align: center;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  p {
    margin: 0;
    font-size: 13px;
  }
}

/* 按钮 */
.pw-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
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
