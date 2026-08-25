// 文件删除：筛选状态 + 默认工厂
// 含/不含 语义与「文件转移」完全一致，保证预览 = 实际删除结果。

import type { ListFolderItem } from '../rename/engine';

export interface DeleteFilter {
  wholeFolder: boolean;       // 整体删除整个文件夹（忽略筛选）
  nameInclude: string[];      // 名称包含
  nameExclude: string[];      // 名称不包含
  suffixInclude: string[];    // 类型(后缀)包含
  suffixExclude: string[];    // 类型(后缀)不包含
  folderInclude: string[];    // 文件夹包含
  folderExclude: string[];    // 文件夹不包含
  recursive: boolean;         // 遍历子目录
  recycleBin: boolean;        // true=移入回收站(可恢复) / false=永久删除(不可恢复)
}

export function createDefaultDeleteFilter(): DeleteFilter {
  return {
    wholeFolder: false,
    nameInclude: [],
    nameExclude: [],
    suffixInclude: [],
    suffixExclude: [],
    folderInclude: [],
    folderExclude: [],
    recursive: true,
    recycleBin: true,
  };
}

// list-folder 返回结构（与后端 dialog.ts 一致）
export interface ListFolderResult {
  items: ListFolderItem[];
  total: number;
  totalSize: number;
}

// 删除计划（确认弹窗 + 实际执行用）
export interface DeletePlan {
  wholeFolder: boolean;
  folder: string;
  paths: string[];     // 显式待删文件（wholeFolder 时为空）
  count: number;       // 将删除文件数（wholeFolder 时可能为 0=未知）
  size: number;        // 将删除总字节数
  recycleBin: boolean;
}
