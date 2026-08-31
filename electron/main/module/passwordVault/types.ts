/**
 * 密码保险库条目模型（主进程内部使用）
 * ------------------------------------------------------------------
 * 明文（password / otpSecret / note）仅驻留主进程内存与加密文件，
 * 绝不进入应用 SQLite 数据库；渲染端只收到脱敏元数据。
 */
/** 完整条目（含明文密码，仅存于内存 / 加密文件） */
export interface VaultEntry {
  key: string;
  title: string;
  username: string;
  /** 明文密码，仅内存态，不回传渲染端 */
  password: string;
  url?: string;
  /** 备注，可能含敏感信息，仅内存态 */
  note?: string;
  category?: string;
  /** 可选 TOTP 密钥（base32），与 2FA 打通；仅内存态 */
  otpSecret?: string;
  createdAt: string;
  updatedAt: string;
}

/** 返回给渲染端的脱敏元数据（剔除 password / otpSecret / note，仅暴露安全标志位） */
export type VaultEntryMeta = Omit<VaultEntry, 'password' | 'otpSecret' | 'note'> & {
  /** 是否配置了 TOTP（不暴露密钥本身） */
  hasOtp?: boolean;
  /** 是否包含备注（不暴露内容） */
  hasNote?: boolean;
};
