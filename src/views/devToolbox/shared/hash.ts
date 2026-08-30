/**
 * Hash 计算封装
 * - SHA-1/256/384/512/HMAC-SHA256: 纯前端 crypto.subtle
 * - MD5: 走主进程 IPC sys:hash（浏览器 SubtleCrypto 无 MD5）
 */

import type { HashAlgorithm } from './types';

// 算法名到 SubtleCrypto 标准名的映射
const SUBTLE_MAP: Record<string, string> = {
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
};

/** 主进程 MD5 计算 */
async function md5ViaMain(text: string): Promise<string> {
  // 主进程通过通用 handlePromise → invoke('sys:hash', text, 'md5')
  // 注意 handlePromise 的签名是 handlePromise(name, args)，args 会被展开还是整体传？
  // 查看 preload: handlePromise(onName, args) { return ipcRenderer.invoke(onName, args) }
  // 所以我们要自己拼参数，或者直接用 ipcRenderer.invoke
  const result = await (window as any).ipcRenderer.invoke('sys:hash', text, 'md5');
  if (typeof result === 'object' && result && result.error) {
    throw new Error(result.error);
  }
  return result as string;
}

/** SubtleCrypto 纯前端 SHA 系列 */
async function subtleHash(text: string, algo: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(SUBTLE_MAP[algo], enc.encode(text));
  return bufferToHex(buf);
}

/** HMAC-SHA256 纯前端 */
async function hmacSha256(text: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const buf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(text));
  return bufferToHex(buf);
}

/** ArrayBuffer → 十六进制小写字符串 */
function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * 计算指定算法的哈希
 * @param text 待计算文本
 * @param algorithm 算法
 * @param key HMAC 密钥（仅 hmac-sha256 需要）
 */
export async function computeHash(text: string, algorithm: HashAlgorithm, key?: string): Promise<string> {
  if (!text && algorithm !== 'hmac-sha256') {
    text = '';
  }
  if (algorithm === 'md5') return md5ViaMain(text);
  if (algorithm === 'hmac-sha256') return hmacSha256(text, key || '');
  return subtleHash(text, algorithm);
}

/** 文件 ArrayBuffer 哈希（仅 SHA 系列，MD5 暂不支持文件） */
export async function computeFileHash(buffer: ArrayBuffer, algorithm: HashAlgorithm): Promise<string> {
  if (algorithm === 'md5') {
    // 大文件 MD5 先降级：让用户知道不可用
    throw new Error('文件 MD5 暂不支持，仅支持文本 MD5');
  }
  const buf = await crypto.subtle.digest(SUBTLE_MAP[algorithm], buffer);
  return bufferToHex(buf);
}
