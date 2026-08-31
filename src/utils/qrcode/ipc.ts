/**
 * 二维码能力层 → 主进程 IPC 封装（保存 / 复制 / 打包）。
 * ------------------------------------------------------------------
 * 主进程负责：原生保存对话框 + 写文件 + 写剪贴板 + 打包 ZIP（渲染端禁止触碰磁盘）。
 * 通道清单见 electron/main/module/qrcode.ts。
 */
import { toPlain } from '@/utils/common';

function ipc(channel: string, payload: any): Promise<any> {
  return window.ipcRenderer.handlePromise(channel, toPlain(payload));
}

export interface SaveImageParams {
  /** PNG dataURL */
  dataUrl: string;
  /** 建议文件名（不含扩展名） */
  defaultName?: string;
}

export interface SaveResult {
  ok: boolean;
  path?: string;
  canceled?: boolean;
  error?: string;
}

/** 保存二维码图片（PNG） */
export async function saveQrImage(params: SaveImageParams): Promise<SaveResult> {
  return ipc('qr:save-image', params);
}

/** 保存二维码原始文本 */
export async function saveQrText(params: {
  text: string;
  defaultName?: string;
}): Promise<SaveResult> {
  return ipc('qr:save-text', params);
}

/** 批量打包二维码图片为 ZIP */
export async function saveQrZip(params: {
  files: { name: string; dataUrl: string }[];
  defaultName?: string;
}): Promise<SaveResult> {
  return ipc('qr:save-zip', params);
}

/** 复制二维码图片到系统剪贴板 */
export async function copyQrImage(params: {
  dataUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  return ipc('qr:copy-image', params);
}
