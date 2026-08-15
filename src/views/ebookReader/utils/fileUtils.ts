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
 * @returns 格式字符串：'txt'、'epub'；不支持时返回空字符串
 */
export function getFormat(fileName: string): 'txt' | 'epub' | 'pdf' | '' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'txt') return 'txt';
  if (ext === 'epub') return 'epub';
  if (ext === 'pdf') return 'pdf';
  return '';
}

/**
 * 通过 jlocal 协议 HEAD 请求检查文件是否存在
 * 利用项目已注册的 jlocal:// 协议；文件不存在时主进程返回 404
 *
 * @param filePath - 文件绝对路径
 * @returns 文件存在返回 true；不存在或请求异常返回 false
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const res = await fetch('jlocal:///' + filePath, { method: 'HEAD' });
    return res.ok;
  } catch (err) {
    // 网络或协议异常时按不存在处理
    console.error('检查文件存在性失败', err);
    return false;
  }
}
