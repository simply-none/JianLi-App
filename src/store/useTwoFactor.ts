/**
 * 2FA 验证器 store（Pinia）
 * ------------------------------------------------------------------
 * 状态：保险库是否已加载、账户脱敏列表、上次路径、加载/错误态。
 * 所有密钥相关操作都委托主进程（twoFactorApi），渲染端不持有 secret。
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { twoFactorApi } from '../views/twoFactor/api/twoFactorApi';
import type { TwoFactorAccountMeta, TwoFactorCode, TwoFactorAccountInput } from '../views/twoFactor/types';

export default defineStore('two-factor', () => {
  const hasVault = ref(false);
  const vaultPath = ref<string | null>(null);
  const lastPath = ref<string | null>(null);
  const accounts = ref<TwoFactorAccountMeta[]>([]);
  const loading = ref(false);
  const error = ref('');
  /** 本应用 2FA（测试小窗）是否已注册 */
  const appEnrolled = ref(false);

  /** 拉取当前状态 + 账户列表（脱敏） */
  async function refresh(): Promise<void> {
    const res = await twoFactorApi.list();
    hasVault.value = !!res.hasVault;
    vaultPath.value = res.vaultPath;
    lastPath.value = res.lastPath;
    accounts.value = res.accounts || [];
  }

  /** 初始化（进入页面时调用） */
  async function init(): Promise<void> {
    await refresh();
  }

  /** 导入并解密保险库 */
  async function openVault(filePath: string, passphrase: string): Promise<boolean> {
    loading.value = true;
    error.value = '';
    try {
      const res = await twoFactorApi.openVault(filePath, passphrase);
      if (!res.ok) {
        error.value = res.error || '导入失败';
        return false;
      }
      await refresh();
      return true;
    } catch (e: any) {
      error.value = e?.message || '导入失败';
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** 新建保险库 */
  async function createVault(filePath: string, passphrase: string): Promise<boolean> {
    loading.value = true;
    error.value = '';
    try {
      const res = await twoFactorApi.createVault(filePath, passphrase);
      if (!res.ok) {
        error.value = res.error || '新建失败';
        return false;
      }
      await refresh();
      return true;
    } catch (e: any) {
      error.value = e?.message || '新建失败';
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** 新增账户 */
  async function addAccount(input: TwoFactorAccountInput): Promise<boolean> {
    const res = await twoFactorApi.addAccount(input);
    if (!res.ok) {
      error.value = res.error || '添加失败';
      return false;
    }
    await refresh();
    return true;
  }

  /** 编辑账户 */
  async function updateAccount(key: string, patch: Partial<TwoFactorAccountInput>): Promise<boolean> {
    const res = await twoFactorApi.updateAccount(key, patch);
    if (!res.ok) {
      error.value = res.error || '编辑失败';
      return false;
    }
    await refresh();
    return true;
  }

  /** 删除账户 */
  async function deleteAccount(key: string): Promise<boolean> {
    const res = await twoFactorApi.deleteAccount(key);
    if (!res.ok) {
      error.value = res.error || '删除失败';
      return false;
    }
    await refresh();
    return true;
  }

  /** 导出 / 另存为 */
  async function exportVault(filePath: string, passphrase?: string): Promise<boolean> {
    const res = await twoFactorApi.exportVault(filePath, passphrase);
    if (!res.ok) {
      error.value = res.error || '导出失败';
      return false;
    }
    return true;
  }

  /** 取全部验证码（供计时器调用） */
  async function getCodes(): Promise<{ ok: boolean; codes: TwoFactorCode[] }> {
    const res = await twoFactorApi.getCodes();
    return { ok: !!res?.ok, codes: res?.codes || [] };
  }

  /** 退出保险库：清空内存中的密钥与口令 */
  async function closeVault(): Promise<void> {
    await twoFactorApi.closeVault();
    await refresh();
  }

  // —— 本应用 2FA（测试小窗验证用）——
  /** 注册本应用 2FA，返回 otpauth URI；失败返回 null */
  async function enrollApp(): Promise<string | null> {
    error.value = '';
    const res = await twoFactorApi.enrollApp();
    if (!res.ok || !res.uri) {
      error.value = res.error || '注册失败';
      return null;
    }
    appEnrolled.value = true;
    return res.uri;
  }

  /** 校验动态码，成功返回 true */
  async function verifyApp(code: string): Promise<boolean> {
    error.value = '';
    const res = await twoFactorApi.verifyApp(code);
    if (!res.ok) {
      error.value = res.error || '验证失败';
      return false;
    }
    return true;
  }

  /** 拉取本应用 2FA 注册状态 */
  async function refreshAppStatus(): Promise<void> {
    const res = await twoFactorApi.appStatus();
    appEnrolled.value = !!res?.enrolled;
  }

  return {
    hasVault,
    vaultPath,
    lastPath,
    accounts,
    loading,
    error,
    appEnrolled,
    init,
    refresh,
    openVault,
    createVault,
    addAccount,
    updateAccount,
    deleteAccount,
    exportVault,
    getCodes,
    closeVault,
    enrollApp,
    verifyApp,
    refreshAppStatus,
  };
});
