/**
 * 二维码下载文件命名规则。
 * ------------------------------------------------------------------
 * 命名 = 内容前六个字 + 下划线 + 日期时间(YYYYMMDD_HHmmss)，
 * 去除文件名非法字符，保证各系统下保存对话框默认名可用。
 */

/** 日期时间搓：YYYYMMDD_HHmmss */
function formatStamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/**
 * 生成二维码下载文件名（不含扩展名）。
 * @param content 二维码原始文本（取前六个字）
 */
export function buildQrFileName(content: string): string {
  const head =
    (content || '').replace(/\s+/g, '').slice(0, 6) || 'qrcode';
  const safe = head.replace(/[\\/:*?"<>|]/g, '_');
  return `${safe}_${formatStamp()}`;
}
