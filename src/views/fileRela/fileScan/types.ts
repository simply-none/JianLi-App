// 文件扫描：共享类型契约
export interface ScanResult {
  name: string;   // 文件名（含扩展名）
  path: string;   // 完整路径
  size: number;   // 字节数
}

// 扫描选项（与后端 searchAllDrives 的 ops 对齐）
export interface ScanOptionsState {
  deep: number;                 // 0 = 无限层级
  caseSensitiveMatch: boolean;  // 大小写敏感
  onlyDirectories: boolean;     // 仅目录
  onlyFiles: boolean;           // 仅文件
  includeFolder: string[];      // 文件夹包含（祖先目录名子串命中）
  ignoreFolder: string[];       // 文件夹不包含（命中则整棵跳过）
}

// 复制到文件夹计划
export interface CopyPlan {
  target: string;
  strategy: 'overwrite' | 'skip' | 'rename';
  count: number;
  size: number;
}
