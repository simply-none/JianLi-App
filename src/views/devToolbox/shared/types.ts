/**
 * 开发工具箱 - 共享类型定义
 */

// Hash 算法枚举
export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512' | 'hmac-sha256';

// Hash 计算结果
export interface HashResult {
  algorithm: HashAlgorithm;
  value: string;
  error?: string;
}

// Regex 匹配结果
export interface RegexMatch {
  full: string;
  groups: (string | undefined)[];
  namedGroups: Record<string, string>;
  index: number;
  length: number;
}

// Diff 类型
export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

// 单位换算类别
export interface UnitCategory {
  id: string;
  label: string;
  baseUnit: string;
  coefficients: Record<string, number>; // 单位id → 相对基准单位的系数
  special?: 'temperature'; // 温度是特例
}

// 常用端口映射
export const PORT_SERVICES: Record<number, string> = {
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8080: 'HTTP-Alt',
  8443: 'HTTPS-Alt',
  27017: 'MongoDB',
};
