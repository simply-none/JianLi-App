/**
 * 二维码能力层 —— 主进程实现
 * ------------------------------------------------------------------
 * 负责渲染端无权限做的事：原生保存对话框、写文件、写剪贴板、打包 ZIP。
 * 渲染端经 qr:save-image / qr:save-text / qr:save-zip / qr:copy-image 调用。
 *
 * 表结构：启动时用 ensureTableExists（安全建表，不走危险的 new-sql:execute）
 * 建立 qr_history / qr_template（均带 key 主键 TEXT + source 列）。
 *
 * ⚠️ 改动本文件后必须重启 Electron 才生效。
 */
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { ensureTableExists } from './newSql.ts';

interface SaveResult {
  ok: boolean;
  path?: string;
  canceled?: boolean;
  error?: string;
}

/** dataURL → Buffer（仅处理 PNG/JPEG 等 base64 图片段） */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/** 弹出保存对话框，返回选中路径或 null（用户取消） */
async function pickSavePath(defaultName: string, ext: string): Promise<string | null> {
  const win = BrowserWindow.getAllWindows()[0];
  const result = await dialog.showSaveDialog(win, {
    title: '保存二维码',
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [{ name: `${ext.toUpperCase()} 文件`, extensions: [ext] }],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

/** 保存二维码图片（PNG） */
async function handleSaveImage(
  _e: unknown,
  params: { dataUrl: string; defaultName?: string },
): Promise<SaveResult> {
  try {
    const dataUrl = String(params?.dataUrl || '');
    if (!dataUrl.startsWith('data:image')) return { ok: false, error: '无效的图片数据' };
    const defaultName = (params?.defaultName || 'qrcode').replace(/[\\/:*?"<>|]/g, '_');
    const filePath = await pickSavePath(defaultName, 'png');
    if (!filePath) return { ok: false, canceled: true };
    await fs.promises.writeFile(filePath, dataUrlToBuffer(dataUrl));
    return { ok: true, path: filePath };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** 保存二维码原始文本（TXT） */
async function handleSaveText(
  _e: unknown,
  params: { text: string; defaultName?: string },
): Promise<SaveResult> {
  try {
    const text = String(params?.text || '');
    const defaultName = (params?.defaultName || 'qrcode').replace(/[\\/:*?"<>|]/g, '_');
    const filePath = await pickSavePath(defaultName, 'txt');
    if (!filePath) return { ok: false, canceled: true };
    await fs.promises.writeFile(filePath, text, 'utf-8');
    return { ok: true, path: filePath };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** 批量打包二维码图片为 ZIP */
async function handleSaveZip(
  _e: unknown,
  params: { files: { name: string; dataUrl: string }[]; defaultName?: string },
): Promise<SaveResult> {
  try {
    const files = Array.isArray(params?.files) ? params.files : [];
    if (!files.length) return { ok: false, error: '没有可打包的文件' };
    const zip = new AdmZip();
    files.forEach((f, i) => {
      const name = (f.name || `qrcode-${i + 1}`).replace(/[\\/:*?"<>|]/g, '_');
      zip.addFile(`${name}.png`, dataUrlToBuffer(f.dataUrl));
    });
    const defaultName = (params?.defaultName || 'qrcodes').replace(/[\\/:*?"<>|]/g, '_');
    const filePath = await pickSavePath(defaultName, 'zip');
    if (!filePath) return { ok: false, canceled: true };
    zip.writeZip(filePath);
    return { ok: true, path: filePath };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** 复制二维码图片到系统剪贴板 */
async function handleCopyImage(
  _e: unknown,
  params: { dataUrl: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const dataUrl = String(params?.dataUrl || '');
    if (!dataUrl.startsWith('data:image')) return { ok: false, error: '无效的图片数据' };
    const image = nativeImage.createFromBuffer(dataUrlToBuffer(dataUrl));
    if (image.isEmpty()) return { ok: false, error: '图像解析失败' };
    clipboard.writeImage(image);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 初始化二维码模块：安全建表 + 注册 IPC。
 * 表结构用 ensureTableExists（带 key 主键 TEXT + source 列），绝不走 new-sql:execute。
 */
export async function initQrCode() {
  await ensureTableExists(
    'qr_history',
    ['source', 'type', 'content', 'style', 'note', 'created_at'],
    'key',
    { primaryKeyType: 'TEXT' },
  ).catch((e) => console.warn('ensure qr_history failed:', e));

  await ensureTableExists(
    'qr_template',
    ['name', 'source', 'type', 'content', 'style', 'created_at'],
    'key',
    { primaryKeyType: 'TEXT' },
  ).catch((e) => console.warn('ensure qr_template failed:', e));

  ipcMain.handle('qr:save-image', handleSaveImage);
  ipcMain.handle('qr:save-text', handleSaveText);
  ipcMain.handle('qr:save-zip', handleSaveZip);
  ipcMain.handle('qr:copy-image', handleCopyImage);
}
