/**
 * 密码保险库 store（Pinia）
 * ------------------------------------------------------------------
 * 状态：保险库是否已解锁、条目脱敏列表、上次路径、加载/错误态。
 * 所有密钥相关操作都委托主进程（passwordVaultApi），渲染端不持有明文。
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { passwordVaultApi } from '../api/passwordVaultApi';
import type { VaultEntryMeta, VaultEntryInput } from '../types';

export default defineStore('password-vault', () => {
  const hasVault = ref(false);
  const vaultPath = ref<string | null>(null);
  const lastPath = ref<string | null>(null);
  const entries = ref<VaultEntryMeta[]>([]);
  const loading = ref(false);
  const error = ref('');

  /** 拉取当前状态 + 条目列表（脱敏） */
  async function refresh(): Promise<void> {
    const res = await passwordVaultApi.list();
    hasVault.value = !!res.hasVault;
    vaultPath.value = res.vaultPath;
    lastPath.value = res.lastPath;
    entries.value = res.entries || [];
  }

  /** 初始化（进入页面时调用） */
  async function init(): Promise<void> {
    await refresh();
  }

  /** 导入并解密保险库（解锁） */
  async function openVault(filePath: string, passphrase: string): Promise<boolean> {
    loading.value = true;
    error.value = '';
    try {
      const res = await passwordVaultApi.openVault(filePath, passphrase);
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
      const res = await passwordVaultApi.createVault(filePath, passphrase);
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

  /** 新增条目 */
  async function addEntry(input: VaultEntryInput): Promise<boolean> {
    const res = await passwordVaultApi.addEntry(input);
    if (!res.ok) {
      error.value = res.error || '添加失败';
      return false;
    }
    await refresh();
    return true;
  }

  /** 编辑条目 */
  async function updateEntry(key: string, patch: Partial<VaultEntryInput>): Promise<boolean> {
    const res = await passwordVaultApi.updateEntry(key, patch);
    if (!res.ok) {
      error.value = res.error || '编辑失败';
      return false;
    }
    await refresh();
    return true;
  }

  /** 删除条目 */
  async function deleteEntry(key: string): Promise<boolean> {
    const res = await passwordVaultApi.deleteEntry(key);
    if (!res.ok) {
      error.value = res.error || '删除失败';
      return false;
    }
    await refresh();
    return true;
  }

  /** 导出 / 另存为 */
  async function exportVault(filePath: string, passphrase?: string): Promise<boolean> {
    const res = await passwordVaultApi.exportVault(filePath, passphrase);
    if (!res.ok) {
      error.value = res.error || '导出失败';
      return false;
    }
    return true;
  }

  /** 锁定 / 退出保险库：清空主进程内存中的明文与口令 */
  async function lockVault(): Promise<void> {
    await passwordVaultApi.lockVault();
    await refresh();
  }

  return {
    hasVault,
    vaultPath,
    lastPath,
    entries,
    loading,
    error,
    init,
    refresh,
    openVault,
    createVault,
    addEntry,
    updateEntry,
    deleteEntry,
    exportVault,
    lockVault,
  };
});
