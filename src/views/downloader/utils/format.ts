/**
 * 下载器格式化工具（渲染端）
 */

/**
 * 字节数 → 可读大小字符串
 * @param bytes 必填，字节数
 * @returns 如 "1.5 MB"；未知（0/负数）返回 "--"
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/**
 * 速度（B/s）→ 可读速度字符串
 * @param bps 必填，每秒字节数
 * @returns 如 "2.3 MB/s"；0 返回 "--"
 */
export function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) return "--";
  return `${formatBytes(bps)}/s`;
}

/**
 * 计算剩余时间
 * @param receivedSize 必填，已接收字节
 * @param totalSize 必填，总字节（0 = 未知）
 * @param speed 必填，当前速度（B/s）
 * @returns 如 "3 分钟"；无法估算返回 "--"
 */
export function formatEta(receivedSize: number, totalSize: number, speed: number): string {
  if (!totalSize || !speed || speed <= 0 || receivedSize >= totalSize) return "--";
  const sec = Math.round((totalSize - receivedSize) / speed);
  if (sec < 60) return `${sec} 秒`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} 小时`;
  return `${(sec / 86400).toFixed(1)} 天`;
}

/** 分类展示元信息 */
export interface CategoryMeta {
  /** 分类显示名 */
  label: string;
  /** 分类图标（Lucide 名称，已验证存在） */
  icon: string;
}

/** 任务分类 → 展示元信息（图标均已在 @lucide/vue 验证存在） */
export const CATEGORY_META: Record<string, CategoryMeta> = {
  video: { label: "视频", icon: "FileVideo" },
  audio: { label: "音乐", icon: "FileAudio" },
  document: { label: "文档", icon: "FileText" },
  archive: { label: "压缩包", icon: "FileArchive" },
  software: { label: "软件", icon: "Package" },
  image: { label: "图片", icon: "Image" },
  other: { label: "其他", icon: "File" },
};

/**
 * 任务状态 → 展示元信息（文案 / Element Plus tag 类型 / 图标）
 */
export const STATUS_META: Record<string, { label: string; tag: string; icon: string }> = {
  waiting: { label: "排队中", tag: "info", icon: "Clock" },
  downloading: { label: "下载中", tag: "primary", icon: "Download" },
  paused: { label: "已暂停", tag: "warning", icon: "Pause" },
  completed: { label: "已完成", tag: "success", icon: "CheckCircle2" },
  failed: { label: "失败", tag: "danger", icon: "AlertCircle" },
};
