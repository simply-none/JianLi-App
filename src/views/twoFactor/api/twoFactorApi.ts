/**
 * 2FA 渲染端 IPC 封装
 * ------------------------------------------------------------------
 * 统一经 window.ipcRenderer.handlePromise 与主进程交互。
 * 注意：所有通道名均为 'two-factor:*'，对应主进程 initTwoFactor() 注册的 handle。
 */
import type { TwoFactorAccountMeta, TwoFactorCode, TwoFactorAccountInput } from '../types';

/** 薄封装：渲染端统一 IPC 调用 */
function invoke<T = any>(channel: string, args?: any): Promise<T> {
  return window.ipcRenderer.handlePromise(channel, args);
}

export interface VaultListResult {
  ok: boolean;
  hasVault: boolean;
  vaultPath: string | null;
  lastPath: string | null;
  accounts: TwoFactorAccountMeta[];
}

export interface OpenCreateResult {
  ok: boolean;
  error?: string;
  accounts: TwoFactorAccountMeta[];
}

export const twoFactorApi = {
  /** 原生对话框：选择已有保险库文件 */
  pickOpen: () => invoke<string | null>('two-factor:pick-open'),
  /** 原生对话框：选择保存路径 */
  pickSave: (defaultName?: string) => invoke<string | null>('two-factor:pick-save', defaultName),
  /** 导入并解密保险库 */
  openVault: (filePath: string, passphrase: string) =>
    invoke<OpenCreateResult>('two-factor:open-vault', { filePath, passphrase }),
  /** 新建保险库 */
  createVault: (filePath: string, passphrase: string, accounts: TwoFactorAccountInput[] = []) =>
    invoke<OpenCreateResult>('two-factor:create-vault', { filePath, passphrase, accounts }),
  /** 当前状态 + 脱敏账户列表 */
  list: () => invoke<VaultListResult>('two-factor:list'),
  /** 取全部验证码（无 secret） */
  getCodes: () => invoke<{ ok: boolean; error?: string; codes: TwoFactorCode[] }>('two-factor:get-codes'),
  /** 新增账户 */
  addAccount: (input: TwoFactorAccountInput) =>
    invoke<{ ok: boolean; error?: string; account: TwoFactorAccountMeta }>('two-factor:add-account', { input }),
  /** 编辑账户 */
  updateAccount: (key: string, patch: Partial<TwoFactorAccountInput>) =>
    invoke<{ ok: boolean; error?: string; account: TwoFactorAccountMeta }>('two-factor:update-account', { key, patch }),
  /** 删除账户 */
  deleteAccount: (key: string) => invoke<{ ok: boolean; error?: string }>('two-factor:delete-account', { key }),
  /** 导出 / 另存为（passphrase 留空则用当前口令） */
  exportVault: (filePath: string, passphrase?: string) =>
    invoke<{ ok: boolean; error?: string }>('two-factor:export', { filePath, passphrase }),
  /** 生成 otpauth URI（含密钥，仅用于展示二维码，不落库） */
  exportUri: (key: string) => invoke<{ ok: boolean; error?: string; uri: string }>('two-factor:export-uri', { key }),
  /** 退出保险库：清空主进程内存中的密钥与口令 */
  closeVault: () => invoke<{ ok: boolean }>('two-factor:close'),
};
