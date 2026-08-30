/**
 * 剪贴板操作统一封装（走 ipcRenderer，避免浏览器 Clipboard API 的权限问题）
 */

/** 写入剪贴板 */
export async function writeClipboard(text: string): Promise<void> {
  try {
    await (window as any).ipcRenderer.handlePromise('clipboard:write', text);
  } catch {
    // fallback: 主进程 clipboard:write 可能没有，试浏览器原生
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
  }
}

/** 读取剪贴板 */
export async function readClipboard(): Promise<string> {
  try {
    return await (window as any).ipcRenderer.handlePromise('clipboard:read', null);
  } catch {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  }
}
