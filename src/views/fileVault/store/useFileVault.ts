/**
 * 私密文件保险箱 store（Pinia）
 * ------------------------------------------------------------------
 * 状态：是否已建库、是否解锁、文件元数据列表、加载/错误态。
 * 所有密钥相关操作都委托主进程（fileVaultApi），渲染端不持有明文与密钥。
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fileVaultApi } from '../api/fileVaultApi';
import type { VaultFileMeta } from '../types';

export default defineStore('file-vault', () => {
  const hasVault = ref(false);
  const isUnlocked = ref(false);
  const files = ref<VaultFileMeta[]>([]);
  const loading = ref(false);
  const error = ref('');

  /** 拉取状态（不拉列表） */
  async function refreshStatus(): Promise<void> {
    const res = await fileVaultApi.status();
    hasVault.value = !!res.hasVault;
    isUnlocked.value = !!res.isUnlocked;
  }

  /** 拉取状态 + 文件列表（解锁后才有列表） */
  async function refresh(): Promise<void> {
    await refreshStatus();
    if (isUnlocked.value) {
      const res = await fileVaultApi.list();
      files.value = res.files || [];
    } else {
      files.value = [];
    }
  }

  /** 初始化（进入页面时调用） */
  async function init(): Promise<void> {
    await refresh();
  }

  /** 首次设置口令 */
  async function setPassword(password: string): Promise<boolean> {
    loading.value = true;
    error.value = '';
    try {
      const res = await fileVaultApi.setPassword(password);
      if (!res.ok) {
        error.value = res.error || '设置失败';
        return false;
      }
      await refresh();
      return true;
    } catch (e: any) {
      error.value = e?.message || '设置失败';
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** 解锁 */
  async function unlock(password: string): Promise<boolean> {
    loading.value = true;
    error.value = '';
    try {
      const res = await fileVaultApi.unlock(password);
      if (!res.ok) {
        error.value = res.error || '解锁失败';
        return false;
      }
      await refresh();
      return true;
    } catch (e: any) {
      error.value = e?.message || '解锁失败';
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** 锁定：清空主进程内存密钥与本地状态 */
  async function lock(): Promise<void> {
    await fileVaultApi.lock();
    await refresh();
  }

  /** 批量加密导入（原生多选 → 逐文件导入） */
  async function importFiles(paths: string[]): Promise<{ ok: number; fail: number }> {
    let ok = 0;
    let fail = 0;
    for (const p of paths) {
      const res = await fileVaultApi.importFile(p);
      if (res.ok) ok++;
      else fail++;
    }
    if (ok) await refresh();
    return { ok, fail };
  }

  /** 解密导出到目标目录 */
  async function exportFile(id: string, destDir: string): Promise<boolean> {
    const res = await fileVaultApi.exportFile(id, destDir);
    if (!res.ok) {
      error.value = res.error || '导出失败';
      return false;
    }
    return true;
  }

  /** 删除文件 */
  async function deleteFile(id: string): Promise<boolean> {
    const res = await fileVaultApi.deleteFile(id);
    if (!res.ok) {
      error.value = res.error || '删除失败';
      return false;
    }
    await refresh();
    return true;
  }

  /** 解密到临时目录（预览用） */
  async function decryptTemp(id: string) {
    return await fileVaultApi.decryptTemp(id);
  }

  /** 清理预览临时目录 */
  async function cleanupTemp() {
    await fileVaultApi.cleanupTemp();
  }

  return {
    hasVault,
    isUnlocked,
    files,
    loading,
    error,
    refresh,
    refreshStatus,
    init,
    setPassword,
    unlock,
    lock,
    importFiles,
    exportFile,
    deleteFile,
    decryptTemp,
    cleanupTemp,
  };
});
