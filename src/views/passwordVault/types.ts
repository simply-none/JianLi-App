/**
 * 密码保险库渲染端类型定义
 */
/** 渲染端看到的条目（脱敏，无 password / otpSecret / note） */
export interface VaultEntryMeta {
  key: string;
  title: string;
  username: string;
  url?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  /** 是否配置了 TOTP（不暴露密钥本身） */
  hasOtp?: boolean;
  /** 是否包含备注（不暴露内容） */
  hasNote?: boolean;
}

/** 新建 / 编辑条目时的输入 */
export interface VaultEntryInput {
  title: string;
  username: string;
  password: string;
  url?: string;
  note?: string;
  category?: string;
  otpSecret?: string;
}

/** TOTP 实时码（由主进程计算后回传） */
export interface TotpMeta {
  code: string;
  nextCode: string;
  remainingSeconds: number;
  period: number;
}

export interface VaultListResult {
  ok: boolean;
  hasVault: boolean;
  vaultPath: string | null;
  lastPath: string | null;
  entries: VaultEntryMeta[];
}

export interface OpenCreateResult {
  ok: boolean;
  error?: string;
  entries: VaultEntryMeta[];
}
