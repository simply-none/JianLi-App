/**
 * 通用保险库加密原语（AES-256-GCM + PBKDF2 口令派生）
 * ------------------------------------------------------------------
 * 与 2FA 验证器共用同一套密钥安全架构：
 * - 密文只存在于「加密文件」与「运行期主进程内存」；
 * - 绝不进入应用 SQLite 数据库（newSql / basic_info）。
 *
 * 文件结构（JSON 信封）：
 * {
 *   v: 1, kdf: 'pbkdf2-sha256', iter, salt(base64), iv(base64), ct(base64)
 * }
 * ct = AES-256-GCM 密文 + 16 字节 GCM 认证标签（防篡改，口令错即失败）。
 *
 * 该模块为泛型实现，twoFactor 与 passwordVault 均复用它，
 * 保证两者的安全底座完全一致、互不重复。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

export const PBKDF2_ITERATIONS = 200_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const KEY_BYTES = 32;
export const GCM_TAG_BYTES = 16;

export interface VaultEnvelope {
  v: 1;
  kdf: 'pbkdf2-sha256';
  iter: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64（密文 + GCM tag）
}

/** 加密任意 JSON 可序列化数组为信封对象 */
export function encryptVault<T>(items: T[], passphrase: string): VaultEnvelope {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_BYTES, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(items), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iter: PBKDF2_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ct: Buffer.concat([encrypted, tag]).toString('base64'),
  };
}

/** 解密信封为数组；口令错误或文件损坏会抛错（GCM 认证失败） */
export function decryptVault<T>(env: VaultEnvelope, passphrase: string): T[] {
  const salt = Buffer.from(env.salt, 'base64');
  const iv = Buffer.from(env.iv, 'base64');
  const ct = Buffer.from(env.ct, 'base64');
  const tag = ct.subarray(ct.length - GCM_TAG_BYTES);
  const data = ct.subarray(0, ct.length - GCM_TAG_BYTES);
  const key = crypto.pbkdf2Sync(passphrase, salt, env.iter || PBKDF2_ITERATIONS, KEY_BYTES, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T[];
}

/** 加密并写入保险库文件 */
export function writeVaultFile<T>(filePath: string, items: T[], passphrase: string): void {
  const env = encryptVault(items, passphrase);
  fs.writeFileSync(filePath, JSON.stringify(env, null, 2), 'utf8');
}

/** 读取并解密保险库文件（失败抛出，由调用方转成 ok:false） */
export function readVaultFile<T>(filePath: string, passphrase: string): T[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = JSON.parse(raw) as VaultEnvelope;
  return decryptVault<T>(env, passphrase);
}
