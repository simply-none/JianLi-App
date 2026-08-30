/**
 * 资源管理模块类型定义
 */

/** 资源类型（由扩展名推断） */
export type ResourceType =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'pdf'
  | 'font'
  | 'archive'
  | 'document'
  | 'other';

/** 资源记录（对应 SQLite resource 表一行） */
export interface ResourceItem {
  /** 主键：文件落盘绝对路径（唯一索引） */
  key: string;
  /** 原始文件名 */
  name: string;
  /** 落盘绝对路径（与 key 相同，冗余存储便于语义化使用） */
  path: string;
  /** 资源类型 */
  type: ResourceType;
  /** 文件大小（字节），未知为 0 */
  size: number;
  /** 扩展名（小写，不含点） */
  ext: string;
  /** 是否收藏：0 否 / 1 是 */
  is_starred: 0 | 1;
  /** 入库时间（YYYY-MM-DD HH:mm:ss） */
  created_at: string;
}

/** 排序字段 */
export type SortField = 'created_at' | 'name' | 'size';

/** 排序方向 */
export type SortOrder = 'asc' | 'desc';

/** 视图模式 */
export type ViewMode = 'grid' | 'list';

/** 资源统计信息 */
export interface ResourceStats {
  /** 资源总数 */
  total: number;
  /** 总大小（字节） */
  totalSize: number;
  /** 各类型数量 */
  typeCounts: Partial<Record<ResourceType, number>>;
}
