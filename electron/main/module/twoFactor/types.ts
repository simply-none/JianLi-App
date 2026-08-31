/**
 * 2FA 账户模型（主进程内部使用）
 */
import type { TotpAlgorithm } from './otp';

/** 完整账户（含 secret 明文，仅存于内存 / 加密文件，绝不进应用数据库） */
export interface TwoFactorAccount {
  key: string;
  issuer: string;
  account: string;
  /** base32 明文密钥，仅内存态，不回传渲染端 */
  secret: string;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  group?: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

/** 返回给渲染端的脱敏元数据（剔除 secret） */
export type TwoFactorAccountMeta = Omit<TwoFactorAccount, 'secret'>;
