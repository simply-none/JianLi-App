/**
 * 2FA 渲染端类型定义
 */
export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

/** 渲染端看到的账户（脱敏，无 secret） */
export interface TwoFactorAccountMeta {
  key: string;
  issuer: string;
  account: string;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  group?: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

/** 实时验证码（由主进程计算后回传，无 secret） */
export interface TwoFactorCode {
  key: string;
  code: string;
  nextCode: string;
  remainingSeconds: number;
  period: number;
}

/** 新建 / 编辑账户时的输入（secret 由渲染端收集后仅经 IPC 传给主进程加密，不落渲染端存储） */
export interface TwoFactorAccountInput {
  issuer: string;
  account: string;
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  group?: string;
}
