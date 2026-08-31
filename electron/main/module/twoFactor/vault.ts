/**
 * 2FA 保险库加密兼容层
 * ------------------------------------------------------------------
 * 通用加密原语已统一抽到 ../vault/crypto.ts（AES-256-GCM + PBKDF2）。
 * 这里仅做「强类型封装」并 re-export，保证 twoFactor.ts 的既有调用
 * 签名完全不变，且 2FA 与新增的密码保险库共用同一套安全架构。
 */
import type { TwoFactorAccount } from './types';
import {
  encryptVault as _encrypt,
  decryptVault as _decrypt,
  writeVaultFile as _write,
  readVaultFile as _read,
  type VaultEnvelope,
} from '../vault/crypto';

export type { VaultEnvelope };

/** 加密 2FA 账户数组为信封对象（底层复用通用加密原语） */
export function encryptVault(accounts: TwoFactorAccount[], passphrase: string): VaultEnvelope {
  return _encrypt(accounts, passphrase);
}

/** 解密信封为 2FA 账户数组；口令错误或文件损坏会抛错（GCM 认证失败） */
export function decryptVault(env: VaultEnvelope, passphrase: string): TwoFactorAccount[] {
  return _decrypt<TwoFactorAccount>(env, passphrase);
}

/** 加密并写入保险库文件 */
export function writeVaultFile(filePath: string, accounts: TwoFactorAccount[], passphrase: string): void {
  _write(filePath, accounts, passphrase);
}

/** 读取并解密保险库文件（失败抛出，由调用方转成 ok:false） */
export function readVaultFile(filePath: string, passphrase: string): TwoFactorAccount[] {
  return _read<TwoFactorAccount>(filePath, passphrase);
}
