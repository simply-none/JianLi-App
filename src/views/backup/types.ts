/**
 * 备份与恢复 + 数据导出中心的类型定义
 */

/** 备份类型：manual 手动 / auto 自动 / safety 恢复前安全备份 */
export type BackupType = "manual" | "auto" | "safety";

/** 备份清单（.jlbak 内 manifest.json 结构） */
export interface BackupManifest {
  /** 应用版本 */
  appVersion: string;
  /** 备份时间戳（ms） */
  createdAt: number;
  /** 备份时间文本 */
  createdAtText: string;
  /** 备份类型 */
  type: BackupType;
  /** 用户备注 */
  note: string;
  /** 各库备份详情 */
  databases: DbBackupInfo[];
}

/** 单个数据库的备份详情 */
export interface DbBackupInfo {
  /** 库名 */
  name: string;
  /** 快照文件大小（字节） */
  size: number;
  /** 快照方式：vacuum 一致性快照 / copy 原始文件复制 */
  method: "vacuum" | "copy";
  /** 各表行数统计 */
  tables: { name: string; rows: number }[];
}

/** 备份列表项 */
export interface BackupListItem {
  /** 备份文件名 */
  fileName: string;
  /** 备份文件绝对路径 */
  filePath: string;
  /** 文件大小（字节） */
  size: number;
  /** 备份清单（文件损坏时为 null） */
  manifest: BackupManifest | null;
}

/** 数据库概况信息 */
export interface DbInfoItem {
  /** 库名 */
  name: string;
  /** 库文件名 */
  file: string;
  /** 库文件绝对路径 */
  path: string;
  /** 是否存在 */
  exists: boolean;
  /** 文件大小（字节） */
  size: number;
  /** 最近修改时间戳（ms） */
  mtime: number;
}

/** 自动备份配置 */
export interface AutoBackupConfig {
  /** 是否启用自动备份 */
  enabled: boolean;
  /** 备份间隔（小时） */
  intervalHours: number;
  /** 自动备份保留份数 */
  keepCount: number;
  /** 上次自动备份时间戳（ms） */
  lastBackupAt: number;
}

/** 备份概况信息（backup:get-info 返回） */
export interface BackupInfo {
  ok: boolean;
  /** 各库概况 */
  dbs: DbInfoItem[];
  /** 备份目录 */
  backupDir: string;
  /** 自动备份配置 */
  autoConfig: AutoBackupConfig;
  /** 最近一次备份（无备份时为 null） */
  lastBackup: BackupListItem | null;
  /** 备份总数 */
  backupCount: number;
  /** 错误信息 */
  error?: string;
}

/** 导出中心表信息 */
export interface ExportTableInfo {
  /** 表名 */
  name: string;
  /** 中文标签（未映射时为表名） */
  label: string;
  /** 行数 */
  rows: number;
  /** 是否存在日期列（决定日期范围过滤是否可用） */
  hasDateColumn: boolean;
}

/** 导出中心模块分组 */
export interface ExportGroup {
  /** 分组键 */
  key: string;
  /** 分组名 */
  label: string;
  /** 分组下的表 */
  tables: ExportTableInfo[];
}

/** 导出模块清单（export:get-modules 返回） */
export interface ExportModulesResult {
  ok: boolean;
  /** 按模块归组的表清单 */
  groups: ExportGroup[];
  /** 未归组的其余表 */
  otherTables: ExportTableInfo[];
  /** 错误信息 */
  error?: string;
}

/** 导出文件信息 */
export interface ExportFileItem {
  /** 表名 */
  table: string;
  /** 中文标签 */
  label: string;
  /** 导出文件绝对路径 */
  path: string;
  /** 导出行数 */
  rows: number;
}

/** 通用 IPC 结果 */
export interface CommonResult {
  ok: boolean;
  error?: string;
  [key: string]: any;
}
