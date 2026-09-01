/**
 * 私密文件保险箱渲染端 IPC 封装
 * ------------------------------------------------------------------
 * 统一经 window.ipcRenderer.handlePromise 与主进程交互。
 * 所有通道名均为 'file-vault:*'，对应主进程 initFileVault() 注册的 handle。
 * 渲染端不持有明文内容与密钥；加解密、磁盘读写全部在主进程完成。
 */
import type { VaultFileMeta, VaultStatus, DecryptTempResult, ExportResult } from '../types';

/** 薄封装：渲染端统一 IPC 调用 */
function invoke<T = any>(channel: string, args?: any): Promise<T> {
  return window.ipcRenderer.handlePromise(channel, args);
}

export const fileVaultApi = {
  /** 首次设置口令，初始化保险库 */
  setPassword: (password: string) =>
    invoke<{ ok: boolean; error?: string; hasVault?: boolean }>('file-vault:set-password', { password }),
  /** 解锁：派生 KEK 解 wrap dataKey */
  unlock: (password: string) =>
    invoke<{ ok: boolean; error?: string; hasVault?: boolean; isUnlocked?: boolean }>('file-vault:unlock', {
      password,
    }),
  /** 锁定：清空主进程内存密钥 + 清理临时目录 */
  lock: () => invoke<{ ok: boolean }>('file-vault:lock'),
  /** 查询状态：是否已建库 / 是否解锁 */
  status: () => invoke<VaultStatus & { ok: boolean }>('file-vault:status'),
  /** 列出文件元数据（解锁后主进程解密文件名） */
  list: () => invoke<{ ok: boolean; error?: string; files?: VaultFileMeta[] }>('file-vault:list'),
  /** 原生对话框：选择要加密的文件（支持多选） */
  pickImport: () => invoke<string[] | null>('file-vault:pick-import'),
  /** 加密导入单个文件；deleteSource=true 时主进程安全删除原文件 */
  importFile: (sourcePath: string, name?: string, deleteSource?: boolean) =>
    invoke<{ ok: boolean; error?: string; file?: VaultFileMeta; sourceDeleted?: boolean }>('file-vault:import', {
      sourcePath,
      name,
      deleteSource,
    }),
  /** 原生对话框：选择导出目录 */
  pickExportDir: () => invoke<string | null>('file-vault:pick-export-dir'),
  /** 解密导出到目标目录 */
  exportFile: (id: string, destDir: string) =>
    invoke<ExportResult>('file-vault:export', { id, destDir }),
  /** 解密到临时目录供预览 */
  decryptTemp: (id: string) => invoke<DecryptTempResult>('file-vault:decrypt-temp', { id }),
  /** 清理预览临时目录 */
  cleanupTemp: () => invoke<{ ok: boolean; error?: string }>('file-vault:cleanup-temp'),
  /** 删除文件（元数据 + 密文） */
  deleteFile: (id: string) => invoke<{ ok: boolean; error?: string }>('file-vault:delete', { id }),
};
