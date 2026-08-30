/**
 * 文件类型工具：扩展名 → 类型/标签/图标 映射与大小格式化
 *
 * 从旧版 resourceManage/index.vue 中硬编码的类型判断逻辑抽离，
 * 供列表、卡片、预览等多处复用。
 */
import type { ResourceType } from '../types';

/** 各资源类型对应的扩展名表（小写） */
const EXT_MAP: Record<Exclude<ResourceType, 'other'>, string[]> = {
  image: [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tif', 'tiff',
    'psd', 'ai', 'eps', 'raw', 'svgz', 'avif', 'heic', 'heif', 'jfif',
    'jp2', 'j2k', 'jpf', 'jpx', 'jxr', 'wbmp', 'xbm',
  ],
  video: [
    'mp4', 'webm', 'mov', 'avi', 'flv', 'wmv', 'mkv', 'm4v', '3gp', '3g2',
    'mpeg', 'mpg', 'mpe', 'mpv', 'm2v', 'm2ts', 'ts', 'vob', 'ogv', 'f4v',
    'rm', 'rmvb', 'asf', 'divx', 'xvid', 'mts', 'mxf', 'gifv',
  ],
  audio: [
    'mp3', 'wav', 'ogg', 'oga', 'aac', 'flac', 'wma', 'm4a', 'aiff', 'alac',
    'opus', 'ape', 'm4b', 'mpc', 'wv', 'tak', 'tta', 'mid', 'midi', 'amr',
  ],
  text: [
    'txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'vue', 'xml', 'yaml', 'yml',
    'csv', 'tsv', 'log', 'ini', 'conf', 'cfg', 'env', 'bat', 'cmd', 'ps1',
    'sh', 'sql', 'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'go', 'rs',
    'swift', 'kt', 'rb', 'php', 'lua', 'dart', 'scala', 'svelte', 'astro',
    'mdx', 'jsx', 'tsx', 'scss', 'less', 'pug',
  ],
  pdf: ['pdf'],
  font: ['woff', 'woff2', 'ttf', 'otf', 'eot', 'sfnt'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz', 'lzma'],
  document: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'],
};

/** 各类型的中文标签 */
const TYPE_LABEL: Record<ResourceType, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  text: '文本',
  pdf: 'PDF',
  font: '字体',
  archive: '压缩包',
  document: '文档',
  other: '其他',
};

/**
 * 根据文件名（或扩展名）推断资源类型
 *
 * @param {string} filename - 文件名或含扩展名的路径（必填）
 * @returns {ResourceType} 资源类型，无法识别时返回 'other'
 */
export function getFileType(filename: string): ResourceType {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  for (const [type, exts] of Object.entries(EXT_MAP)) {
    if (exts.includes(ext)) return type as ResourceType;
  }
  return 'other';
}

/**
 * 获取资源类型的中文标签
 *
 * @param {string} filename - 文件名或含扩展名的路径（必填）
 * @returns {string} 中文类型标签
 */
export function getFileTypeLabel(filename: string): string {
  return TYPE_LABEL[getFileType(filename)];
}

/**
 * 获取资源类型标签（基于已推断的类型，避免重复计算）
 *
 * @param {ResourceType} type - 资源类型（必填）
 * @returns {string} 中文类型标签
 */
export function getTypeLabel(type: ResourceType): string {
  return TYPE_LABEL[type] || TYPE_LABEL.other;
}

/**
 * 字节数格式化为人性化显示
 *
 * @param {number} bytes - 字节数（必填）
 * @returns {string} 如 1.5 MB；0 或非法值返回 '-'
 */
export function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(val >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}
