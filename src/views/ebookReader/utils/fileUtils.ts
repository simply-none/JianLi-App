/**
 * 电子书文件路径相关纯函数工具
 * 被 index.vue（打开文件）与 useBookshelf（加入书架）共用，避免重复定义
 */

/**
 * 从文件路径中提取文件名（兼容 Windows 反斜杠与 Unix 正斜杠）
 *
 * @param filePath - 文件绝对路径
 * @returns 文件名（含扩展名）；无法提取时返回原路径
 */
export function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * 根据文件名扩展名判断电子书格式
 *
 * @param fileName - 文件名（含扩展名）
 * @returns 格式字符串：'txt'、'epub'、'pdf'、'cbz'；不支持时返回空字符串
 */
export function getFormat(fileName: string): 'txt' | 'epub' | 'pdf' | 'cbz' | '' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'txt') return 'txt';
  if (ext === 'epub') return 'epub';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'cbz') return 'cbz';
  return '';
}

/**
 * 把阅读秒数格式化为友好时长文案
 *
 * @param seconds - 累计秒数
 * @returns '<1 分钟' / 'X 分钟' / 'X.X 小时'
 */
export function formatReadingDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s <= 0) return '0 分钟';
  if (s < 60) return '1 分钟内';
  if (s < 3600) return `${Math.round(s / 60)} 分钟`;
  return `${(s / 3600).toFixed(1)} 小时`;
}

/**
 * 检查文件是否存在（主进程 fs.stat）
 * 替代旧的 `fetch HEAD jlocal://` 协议往返：少一次协议层请求，
 * 且不受 jlocal 协议 CORS 配置问题影响
 *
 * @param filePath - 文件绝对路径
 * @returns 文件存在返回 true；不存在或 IPC 异常返回 false
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const res = await window.ipcRenderer.ebook.checkFileExists(filePath);
    return !!(res && res.success && res.exists);
  } catch (err) {
    console.error('检查文件存在性失败', err);
    return false;
  }
}
