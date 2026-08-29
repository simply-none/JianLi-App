/**
 * 下载器共享类型与常量（主进程）
 * ------------------------------------------------------------------
 * 供 download 目录内各模块共用，保持类型单一来源。
 */

/** 任务状态：waiting=排队中 downloading=下载中 paused=已暂停 completed=已完成 failed=失败 */
export type TaskStatus = "waiting" | "downloading" | "paused" | "completed" | "failed";

/** 任务分类：按扩展名自动识别 */
export type TaskCategory = "video" | "audio" | "document" | "archive" | "software" | "image" | "other";

/** 分段下载状态：[start, end] 闭区间 + 已下载字节数（断点续传的最小单位） */
export interface SegmentState {
  /** 分段起始字节（含） */
  start: number;
  /** 分段结束字节（含），-1 表示未知大小（不支持 Range） */
  end: number;
  /** 该分段已下载字节数 */
  downloaded: number;
}

/** 任务完整信息（数据库行 + 运行态合并结构，推送给渲染端） */
export interface DownloadTaskInfo {
  /** 任务唯一 ID */
  id: string;
  /** 资源地址 */
  url: string;
  /** 保存文件名（完成后可能因重名追加 (n)） */
  filename: string;
  /** 最终保存路径（绝对） */
  savePath: string;
  /** 保存目录 */
  saveDir: string;
  /** 当前状态 */
  status: TaskStatus;
  /** 总字节数（未知为 0） */
  totalSize: number;
  /** 已接收字节数 */
  receivedSize: number;
  /** 分类 */
  category: TaskCategory;
  /** 实时速度（B/s），仅运行时有效，非持久化字段 */
  speed: number;
  /** 服务器是否支持 Range 断点续传 */
  acceptRanges: boolean;
  /** 该任务的并发连接数 */
  connections: number;
  /** 错误信息 */
  errorMsg: string;
  /** 创建时间（YYYY-MM-DD HH:mm:ss） */
  createdAt: string;
  /** 完成时间 */
  completedAt: string;
}

/** 下载器配置 */
export interface DownloaderConfig {
  /** 默认保存目录（空 = 系统「下载」文件夹） */
  saveDir: string;
  /** 同时进行的任务数上限 */
  maxConcurrent: number;
  /** 单任务并发连接数（分段数上限） */
  connectionsPerTask: number;
  /** 全局速度限制（B/s），0 = 不限速 */
  maxSpeed: number;
  /** 是否接管内置浏览器下载 */
  takeOverBrowser: boolean;
  /** 是否开启剪贴板监视 */
  clipboardMonitor: boolean;
}

/** 配置默认值 */
export const DEFAULT_DOWNLOADER_CONFIG: DownloaderConfig = {
  saveDir: "",
  maxConcurrent: 3,
  connectionsPerTask: 16,
  maxSpeed: 0,
  takeOverBrowser: true,
  clipboardMonitor: true,
};

/** 配置在 electron-store 中的键名 */
export const CONFIG_STORE_KEY = "downloader:config";

/** 分类 → 扩展名映射（小写、无点，用于自动识别分类） */
export const CATEGORY_EXT_MAP: Record<TaskCategory, string[]> = {
  // 视频：常见封装 + 摄像机/流媒体切片格式
  video: [
    "mp4", "m4v", "mkv", "webm", "avi", "mov", "wmv", "flv", "f4v", "mpg", "mpeg", "mpe",
    "m1v", "m2v", "m2ts", "mts", "ts", "vob", "ogv", "rm", "rmvb", "divx", "asf", "3gp", "3g2", "qt",
  ],
  // 音频：无损 + 有损 + 语音/乐器格式
  audio: [
    "mp3", "flac", "wav", "aac", "ogg", "oga", "m4a", "m4b", "wma", "ape", "opus", "amr",
    "aiff", "aif", "aifc", "caf", "dsf", "dff", "wv", "tta", "mka", "mid", "midi", "ra", "cda",
  ],
  // 文档：Office/WPS/电子书/文本/标记/数据交换格式
  document: [
    "pdf", "doc", "docx", "docm", "dot", "dotx", "xls", "xlsx", "xlsb", "xlsm", "xltx",
    "ppt", "pptx", "pptm", "odt", "ods", "odp", "rtf", "pages", "numbers", "key",
    "txt", "text", "epub", "mobi", "azw", "azw3", "md", "markdown", "csv", "tsv",
    "html", "htm", "mhtml", "mht", "xml", "json", "yaml", "yml", "tex", "djvu", "djv", "xps", "ps",
  ],
  // 压缩包：常见 + Linux/Unix 专用打包格式
  archive: [
    "zip", "zipx", "rar", "7z", "tar", "gz", "tgz", "bz2", "tbz", "tbz2", "xz", "txz",
    "lz", "lzma", "lzh", "lha", "zst", "zstd", "cab", "arj", "cpio", "ar", "z", "wim", "iso", "dmg", "jar",
  ],
  // 软件：Windows/macOS/Linux/移动端安装包及浏览器扩展
  software: [
    "exe", "msi", "msp", "mst", "msix", "msixbundle", "appx", "appxbundle", "com", "scr",
    "dmg", "pkg", "app", "deb", "rpm", "appimage", "snap", "flatpak", "bin",
    "apk", "xapk", "apkm", "ipa", "crx",
  ],
  // 图片：常规 + Apple/新世代 + RAW 相机原始格式
  image: [
    "jpg", "jpeg", "jfif", "jpe", "jp2", "j2k", "jpx", "jxl", "png", "apng", "gif", "webp",
    "bmp", "dib", "svg", "ico", "tif", "tiff", "heic", "heif", "avif", "tga", "dds", "xcf",
    "psd", "ai", "eps", "raw", "cr2", "crw", "cr3", "nef", "arw", "dng", "orf", "raf", "rw2", "mrw", "pef", "srw",
  ],
  other: [],
};

/**
 * 根据文件名/URL 推断任务分类
 * @param name 必填，文件名或 URL（取最后一段匹配扩展名）
 * @returns 识别到的分类，未命中扩展名时返回 other
 */
export function detectCategory(name: string): TaskCategory {
  const ext = (name.split("?")[0].match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase();
  if (!ext) return "other";
  for (const [cat, exts] of Object.entries(CATEGORY_EXT_MAP)) {
    if ((exts as string[]).includes(ext)) return cat as TaskCategory;
  }
  return "other";
}

/**
 * 清洗文件名：去除 Windows 非法字符与控制字符，防止落盘失败
 * @param name 必填，原始文件名
 * @returns 可安全使用的文件名（空值兜底为 download.bin）
 */
export function sanitizeFilename(name: string): string {
  const cleaned = String(name || "")
    .split("?")[0]
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return cleaned || "download.bin";
}
