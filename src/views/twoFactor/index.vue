<template>
  <div class="two-factor">
    <!-- 未加载保险库：空态引导 -->
    <div v-if="!store.hasVault" class="tf-empty">
      <LucideIcon name="KeyRound" :size="56" class="tf-empty__icon" />
      <h2 class="tf-empty__title">2FA 动态验证码</h2>
      <p class="tf-empty__desc">
        本地 TOTP 验证器。密钥以加密文件形式由你保管，应用数据库不存储任何密钥。
      </p>
      <div class="tf-empty__actions">
        <button class="tf-btn tf-btn--primary" @click="showGate = true">
          <LucideIcon name="FolderOpen" :size="16" /> 导入保险库
        </button>
        <button class="tf-btn" @click="openCreate">
          <LucideIcon name="Plus" :size="16" /> 新建保险库
        </button>
      </div>
      <button v-if="store.lastPath" class="tf-empty__quick" @click="quickImport">
        快速导入上次：<code>{{ store.lastPath }}</code>
      </button>
    </div>

    <!-- 已加载：列表 + 操作栏 -->
    <template v-else>
      <div class="tf-toolbar">
        <div class="tf-toolbar__title">
          <LucideIcon name="KeyRound" :size="20" />
          <span>2FA 验证器</span>
          <span class="tf-count">{{ store.accounts.length }} 个账户</span>
        </div>
        <div class="tf-toolbar__actions">
          <button class="tf-btn tf-btn--primary" @click="openAdd">
            <LucideIcon name="Plus" :size="16" /> 添加账户
          </button>
          <button class="tf-btn" @click="showExport = true">
            <LucideIcon name="Download" :size="16" /> 导出备份
          </button>
          <button class="tf-btn" @click="winMode.openAppTwoFactorMiniWindow()">
            <LucideIcon name="QrCode" :size="16" /> 2FA 测试小窗
          </button>
          <button class="tf-btn" @click="exitVault">
            <LucideIcon name="LogOut" :size="16" /> 退出保险库
          </button>
        </div>
      </div>

      <AccountList :accounts="store.accounts" :codes="codeMap" @edit="onEdit" @changed="onChanged" />
    </template>

    <!-- 弹窗 -->
    <VaultGate v-model="showGate" :initial-tab="gateTab" :initial-path="store.lastPath || ''" @done="onVaultDone" />
    <AddAccountDialog v-model="showAdd" :edit-account="editing" @done="onAddDone" />
    <ExportVaultDialog v-model="showExport" />
  </div>
</template>

<script setup lang="ts">
/**
 * 2FA 验证器主视图
 * - 未加载保险库：引导导入 / 新建；
 * - 已加载：账户卡片网格 + 倒计时（由 useTwoFactorCodes 统一驱动）。
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import useTwoFactor from '@/store/useTwoFactor';
import useWindowMode from '@/store/useWindowMode';
import { useTwoFactorCodes } from './composables/useTwoFactorCodes';
import AccountList from './components/AccountList.vue';
import VaultGate from './components/VaultGate.vue';
import AddAccountDialog from './components/AddAccountDialog.vue';
import ExportVaultDialog from './components/ExportVaultDialog.vue';
import type { TwoFactorAccountMeta } from './types';

const store = useTwoFactor();
const winMode = useWindowMode();
const { codes: codeMap, start, stop, refresh } = useTwoFactorCodes();

const showGate = ref(false);
const showAdd = ref(false);
const showExport = ref(false);
const gateTab = ref<'open' | 'create'>('open');
const editing = ref<TwoFactorAccountMeta | null>(null);

onMounted(async () => {
  await store.init();
  if (store.hasVault) start();
});

onUnmounted(() => stop());

function openCreate() {
  // 直接打开“新建”标签页：用 VaultGate 的新建模式
  gateTab.value = 'create';
  showGate.value = true;
}

async function quickImport() {
  // 预填上次路径并切到“导入已有”标签页，仍需用户输入口令
  gateTab.value = 'open';
  showGate.value = true;
}

function openAdd() {
  editing.value = null;
  showAdd.value = true;
}

function onEdit(a: TwoFactorAccountMeta) {
  editing.value = a;
  showAdd.value = true;
}

async function onVaultDone() {
  start();
}

async function onAddDone() {
  await refresh();
}

async function onChanged() {
  await refresh();
}

async function exitVault() {
  await store.closeVault();
  stop();
  ElMessage.success('已退出保险库（内存密钥已清空）');
}
</script>

<style scoped lang="scss">
.two-factor {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  overflow: auto;
}

/* 空态 */
.tf-empty {
  margin: auto;
  max-width: 460px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.tf-empty__icon {
  color: var(--color-primary);
}
.tf-empty__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}
.tf-empty__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-muted);
}
.tf-empty__actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.tf-empty__quick {
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

/* 工具条 */
.tf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.tf-toolbar__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.tf-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
  padding: 2px 8px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  border-radius: 999px;
}
.tf-toolbar__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 按钮 */
.tf-btn {
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
