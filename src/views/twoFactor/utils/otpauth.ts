/**
 * otpauth:// URI 解析（纯函数，渲染端复用）
 * ------------------------------------------------------------------
 * 仅用于把扫码/粘贴得到的 otpauth URI 还原为账户字段，便于预填表单。
 * 解析结果不写入任何存储；密钥仅在用户确认添加时才经 IPC 传给主进程加密。
 */
import type { TotpAlgorithm, TwoFactorAccountInput } from '../types';

/** 合法 base32 字符集（RFC 4648，允许尾部 '=' 填充） */
const BASE32_RE = /^[A-Z2-7]+=*$/i;

/** 校验字符串是否为合法 base32（忽略空格） */
export function isValidBase32(s: string): boolean {
  return BASE32_RE.test(s.replace(/\s/g, '').toUpperCase());
}

export interface ParsedOtpauth {
  ok: boolean;
  error?: string;
  input?: TwoFactorAccountInput;
}

/**
 * 解析 otpauth://totp/... URI。
 * label 可能是 "issuer:account" 或 "account"，且为 URL 编码；
 * issuer 查询参数优先于 label 中的 issuer。
 */
export function parseOtpauthUri(uri: string): ParsedOtpauth {
  const trimmed = (uri || '').trim();
  if (!/^otpauth:\/\/totp\//i.test(trimmed)) {
    return { ok: false, error: '不是 otpauth://totp/ 开头的二维码' };
  }
  try {
    const withoutScheme = trimmed.replace(/^otpauth:\/\/totp\//i, '');
    const qIndex = withoutScheme.indexOf('?');
    const labelRaw = qIndex >= 0 ? withoutScheme.slice(0, qIndex) : withoutScheme;
    const queryRaw = qIndex >= 0 ? withoutScheme.slice(qIndex + 1) : '';
    const params = new URLSearchParams(queryRaw);

    const label = decodeURIComponent(labelRaw);
    let issuer = '';
    let account = label;
    if (label.includes(':')) {
      const idx = label.indexOf(':');
      issuer = label.slice(0, idx);
      account = label.slice(idx + 1);
    }
    const paramIssuer = params.get('issuer');
    if (paramIssuer) issuer = paramIssuer;

    const secret = (params.get('secret') || '').replace(/\s/g, '').toUpperCase();
    if (!secret) return { ok: false, error: 'URI 缺少 secret' };
    if (!isValidBase32(secret)) return { ok: false, error: 'URI 中的 secret 不是合法 base32' };

    const algorithm = (params.get('algorithm') || 'SHA1').toUpperCase() as TotpAlgorithm;
    const digits = parseInt(params.get('digits') || '6', 10);
    const period = parseInt(params.get('period') || '30', 10);

    return {
      ok: true,
      input: {
        issuer: issuer || '',
        account: account || '',
        secret,
        algorithm: (['SHA1', 'SHA256', 'SHA512'] as TotpAlgorithm[]).includes(algorithm) ? algorithm : 'SHA1',
        digits: [6, 8].includes(digits) ? digits : 6,
        period: [30, 60].includes(period) ? period : 30,
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || '解析失败' };
  }
}
