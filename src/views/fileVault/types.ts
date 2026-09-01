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

/** 导入解密（拖拽/选择 .jlv → 解密到临时目录）结果 */
export interface ImportDecryptResult extends VaultResult {
  tempPath?: string;
  /** 推断出的扩展名（.jlv 不含类型信息，按文件头魔数猜测），用于默认文件名 */
  ext?: string;
  /** 原始文件名去掉 .jlv 后的基础名（字节通道会从拖入文件名还原；路径通道为空） */
  name?: string;
}

/** 另存明文结果 */
export interface SavePlainResult extends VaultResult {
  path?: string;
}
