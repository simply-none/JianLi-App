// 批量重命名：各规则的共享类型契约（主组件与规则子组件之间传递）

// 日期规则：按文件时间(修改/创建)生成片段插入文件名
export interface DateRule {
  enabled: boolean;
  mode: 'mtime' | 'ctime'; // 时间来源：修改时间 / 创建时间(文件系统 ctime)
  format: string; // 时间格式，支持 YYYY MM DD HH mm ss（如 YYYY-MM-DD、YYYYMMDD_HHmmss）
  pos: 'prefix' | 'suffix'; // 插入位置：文件名前 / 文件名后
  sep: string; // 与时间片段之间的分隔符
}

// 随机规则：用随机串替换/插入（去标识化、隐私场景）
export interface RandomRule {
  enabled: boolean;
  kind: 'uuid' | 'alnum' | 'alpha' | 'digit'; // 随机串类型
  length: number; // 长度（uuid 忽略）
  pos: 'prefix' | 'suffix';
  sep: string;
}

// 清理规则：移除/替换指定字符
export interface CleanRule {
  enabled: boolean;
  ops: string[]; // 操作集合：removeSpaces 去空格 / spaceToUnderscore 空格转下划线 /
  // removeDigits 去数字 / removeBrackets 去括号及其内容 / removeSpecified 去指定字符
  specified: string; // 配合 removeSpecified：要移除的字符集合
}

// 截取规则：按位置保留/删除字符
export interface TrimRule {
  enabled: boolean;
  mode: 'keepStart' | 'keepEnd' | 'removeStart' | 'removeEnd'; // 保留前N / 保留后N / 删前N / 删后N
  n: number; // 字符数
}

// 冲突处理策略（重名时）
export type ConflictStrategy = 'block' | 'auto' | 'skip';
