/**
 * TOTP 算法实现（主进程，零依赖，基于 node:crypto）
 * ------------------------------------------------------------------
 * 仅用于本地生成动态验证码：
 * - 密钥明文只在本文件计算时短暂存在，不落盘、不回传渲染端；
 * - 计算发生在主进程，渲染端永远拿不到 secret。
 */
import crypto from 'node:crypto';

/** base32 字母表（RFC 4648，无填充） */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface TotpOptions {
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  /** 毫秒时间戳，便于测试注入固定时刻 */
  atTime?: number;
}

/**
 * 解码 base32 字符串为字节。
 * 容错：自动转大写、去除空格、忽略 '=' 填充与非字母表字符。
 */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/**
 * 生成指定时刻的 TOTP 码（动态截断算法，RFC 6238）。
 */
export function generateTotp(secretBase32: string, opts: TotpOptions = {}): string {
  const algorithm = (opts.algorithm || 'SHA1').toLowerCase();
  const digits = opts.digits || 6;
  const period = opts.period || 30;
  const atTime = opts.atTime ?? Date.now();
  const counter = Math.floor(atTime / 1000 / period);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const secret = base32Decode(secretBase32);
  const hmac = crypto.createHmac(algorithm, secret).update(counterBuf).digest();
  // 动态截断：取末尾字节低 4 位作偏移
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

export interface TotpWithMeta {
  code: string;
  nextCode: string;
  remainingSeconds: number;
  period: number;
}

/**
 * 生成当前码 + 下一周期码 + 剩余秒数（供倒计时展示）。
 */
export function generateTotpWithMeta(secretBase32: string, opts: TotpOptions = {}): TotpWithMeta {
  const period = opts.period || 30;
  const atTime = opts.atTime ?? Date.now();
  const code = generateTotp(secretBase32, { ...opts, atTime });
  const nextCode = generateTotp(secretBase32, { ...opts, atTime: atTime + period * 1000 });
  const remainingSeconds = period - Math.floor((atTime / 1000) % period);
  return { code, nextCode, remainingSeconds, period };
}

/**
 * 把账户拼成 otpauth:// URI（用于导出二维码，供其他验证器扫码）。
 * 注意：URI 内含密钥明文，仅在用户主动“生成二维码”时构造，绝不落库。
 */
export function buildOtpauthUri(account: {
  issuer: string;
  account: string;
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
}): string {
  const issuer = account.issuer || '';
  const label = issuer
    ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account.account)}`
    : encodeURIComponent(account.account);
  const params = new URLSearchParams();
  params.set('secret', account.secret);
  if (issuer) params.set('issuer', issuer);
  if (account.algorithm && account.algorithm !== 'SHA1') params.set('algorithm', account.algorithm);
  if (account.digits && account.digits !== 6) params.set('digits', String(account.digits));
  if (account.period && account.period !== 30) params.set('period', String(account.period));
  return `otpauth://totp/${label}?${params.toString()}`;
}
