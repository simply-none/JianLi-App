/**
 * 密码保险库渲染端 IPC 封装
 * ------------------------------------------------------------------
 * 统一经 window.ipcRenderer.handlePromise 与主进程交互。
 * 所有通道名均为 'password-vault:*'，对应主进程 initPasswordVault() 注册的 handle。
 * 渲染端不持有明文密码；取密 / 取码 / 复制均由主进程在内存中完成。
 */
import type {
  VaultEntryMeta,
  VaultEntryInput,
  VaultListResult,
  OpenCreateResult,
  TotpMeta,
} from '../types';

/** 薄封装：渲染端统一 IPC 调用 */
function invoke<T = any>(channel: string, args?: any): Promise<T> {
  return window.ipcRenderer.handlePromise(channel, args);
}

export const passwordVaultApi = {
  /** 原生对话框：选择已有保险库文件 */
  pickOpen: () => invoke<string | null>('password-vault:pick-open'),
  /** 原生对话框：选择保存路径 */
  pickSave: (defaultName?: string) => invoke<string | null>('password-vault:pick-save', defaultName),
  /** 导入并解密保险库（解锁） */
  openVault: (filePath: string, passphrase: string) =>
    invoke<OpenCreateResult>('password-vault:open-vault', { filePath, passphrase }),
  /** 新建保险库 */
  createVault: (filePath: string, passphrase: string, entries: VaultEntryInput[] = []) =>
    invoke<OpenCreateResult>('password-vault:create-vault', { filePath, passphrase, entries }),
  /** 当前状态 + 脱敏条目列表 */
  list: () => invoke<VaultListResult>('password-vault:list'),
  /** 取回明文密码与备注（仅用户主动“显示”时调用） */
  getSecret: (key: string) =>
    invoke<{ ok: boolean; error?: string; password?: string; note?: string }>('password-vault:get-secret', { key }),
  /** 取回该条目的 TOTP 码 */
  getOtp: (key: string) => invoke<{ ok: boolean; error?: string } & TotpMeta>('password-vault:get-otp', { key }),
  /** 复制字段到剪贴板（password / username / otp），主进程写后定时清空 */
  copy: (key: string, field: 'password' | 'username' | 'otp') =>
    invoke<{ ok: boolean; error?: string }>('password-vault:copy', { key, field }),
  /** 新增条目 */
  addEntry: (input: VaultEntryInput) =>
    invoke<{ ok: boolean; error?: string; entry: VaultEntryMeta }>('password-vault:add-entry', { input }),
  /** 编辑条目 */
  updateEntry: (key: string, patch: Partial<VaultEntryInput>) =>
    invoke<{ ok: boolean; error?: string; entry: VaultEntryMeta }>('password-vault:update-entry', { key, patch }),
  /** 删除条目 */
  deleteEntry: (key: string) => invoke<{ ok: boolean; error?: string }>('password-vault:delete-entry', { key }),
  /** 导出 / 另存为（passphrase 留空则用当前口令） */
  exportVault: (filePath: string, passphrase?: string) =>
    invoke<{ ok: boolean; error?: string }>('password-vault:export', { filePath, passphrase }),
  /** 锁定 / 退出：清空主进程内存中的明文与口令 */
  lockVault: () => invoke<{ ok: boolean }>('password-vault:lock'),
};
