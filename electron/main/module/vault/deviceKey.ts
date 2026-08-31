/**
 * 设备绑定主密钥（Device-bound Master Key）
 * ------------------------------------------------------------------
 * 统一的「数据型密钥」来源：部分密钥（密保、股票 API Key）属于「应用透明使用的
 * 业务密钥」，不像 2FA/应用锁那样由用户手动输入口令解锁，因此不适合用用户口令
 * 作为保险库密钥。此处生成一个随机主密钥，存于 electron-store（**不进 SQLite
 * basic_info、不参与备份**），与 vault/crypto.ts 的 AES-256-GCM + PBKDF2 原语
 * 配合，实现「明文仅驻留主进程内存」的等价安全级别。
 *
 * 与 2FA / 应用锁的差异仅在于「密钥来源」：2FA/应用锁用用户口令派生密钥；
 * 此处用设备绑定随机密钥派生密钥。加密原语、信封格式、内存策略完全一致。
 *
 * 安全说明：该密钥位于本机 electron-store，重装应用或删除用户数据后会失效，
 * 对应保险库需重新录入（本项目采用「强制重新录入」迁移策略）。
 */
import crypto from "node:crypto";
import { store } from "../store.ts";

/** electron-store 中设备主密钥的存储键（刻意区别于业务键，避免被调试视图误显） */
const DEVICE_KEY_NAME = "_device_master_key";

/**
 * 读取（或首次生成并持久化）设备绑定主密钥
 *
 * 该密钥为 32 字节随机十六进制串，作为 vault/crypto.ts 的 passphrase 输入，
 * 由 PBKDF2 派生出实际加密密钥。明文仅驻留主进程内存。
 *
 * @returns {string} 32 字节随机密钥的十六进制字符串
 */
export function getDeviceMasterKey(): string {
  const existing = store.get(DEVICE_KEY_NAME) as string | undefined;
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) {
    return existing;
  }
  const key = crypto.randomBytes(32).toString("hex");
  store.set(DEVICE_KEY_NAME, key);
  return key;
}

/**
 * 清除设备绑定主密钥（仅用于「重置/注销」场景；常规迁移不应调用，
 * 否则已加密保险库将永久无法解密）
 *
 * @returns {void}
 */
export function clearDeviceMasterKey(): void {
  store.delete(DEVICE_KEY_NAME);
}
