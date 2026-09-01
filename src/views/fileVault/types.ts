/**
 * 私密文件保险箱渲染端类型定义
 */

/** 文件元数据（主进程已用 dataKey 解密文件名后返回） */
export interface VaultFileMeta {
  id: string;
  name: string;
  mime: string;
  ext: string;
  size: number;
  createdAt: string;
}

/** 保险箱状态 */
export interface VaultStatus {
  hasVault: boolean;
  isUnlocked: boolean;
}

/** 导入 / 通用结果 */
export interface VaultResult {
  ok: boolean;
  error?: string;
}

/** 解密临时文件结果 */
export interface DecryptTempResult extends VaultResult {
  tempPath?: string;
  mime?: string;
}

/** 导出结果 */
export interface ExportResult extends VaultResult {
  path?: string;
}
