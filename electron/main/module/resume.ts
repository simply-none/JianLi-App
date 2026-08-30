/**
 * 简历模块 - 主进程实现
 * ------------------------------------------------------------------
 * 提供 PDF 导出能力：渲染端将模板生成的完整 HTML（内联样式，A4）
 * 经 IPC 传入，主进程用隐藏 BrowserWindow 加载后调用
 * webContents.printToPDF 生成 PDF Buffer，再经保存对话框写入磁盘。
 *
 * IPC 通道：
 *   - resume:export-pdf  渲染→主  { html, fileName } → { ok, path?, canceled?, error? }
 *
 * 注意：预览与导出共用同一份 HTML，保证所见即所得。
 */
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * 导出 PDF 参数
 */
interface ExportPdfParams {
  /** 完整 HTML 文档字符串（模板渲染产物，内联样式） */
  html: string
  /** 保存文件名（如 张三-20260830-162000.pdf） */
  fileName: string
}

/**
 * 导出结果
 */
interface ExportPdfResult {
  /** 是否成功写入文件 */
  ok: boolean
  /** 保存后的绝对路径（成功时返回） */
  path?: string
  /** 用户是否取消了保存对话框 */
  canceled?: boolean
  /** 错误信息（失败时返回） */
  error?: string
}

/**
 * 用隐藏窗口将 HTML 渲染为 PDF Buffer
 * @param html 完整 HTML 文档字符串
 * @returns PDF 二进制 Buffer
 * @throws {Error} 窗口加载或打印失败时抛出
 */
async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  // 隐藏离屏窗口：禁用 node 集成，仅渲染静态 HTML
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  try {
    // data URL 加载（简历 HTML 体量通常 < 100KB，安全）
    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    await win.loadURL(dataUrl);

    // A4 纵向，背景色生效；页边距为 0（模板 CSS 内已含内边距）
    const buffer = await win.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(buffer);
  } finally {
    // 无论成败都销毁临时窗口，避免泄漏
    if (!win.isDestroyed()) win.destroy();
  }
}

/**
 * 处理 PDF 导出：生成 Buffer → 保存对话框 → 写入磁盘
 * @param _event IPC 事件（未使用）
 * @param params 导出参数（html + fileName）
 * @returns 导出结果（成功带 path / 取消带 canceled / 失败带 error）
 */
async function handleExportPdf(_event: unknown, params: ExportPdfParams): Promise<ExportPdfResult> {
  try {
    const html = String(params?.html || "");
    const fileName = String(params?.fileName || "简历.pdf").replace(/[\\/:*?"<>|]/g, "_");

    if (!html.trim()) {
      return { ok: false, error: "导出内容为空" };
    }

    // 1. 生成 PDF Buffer
    const buffer = await renderHtmlToPdfBuffer(html);

    // 2. 保存对话框（默认保存到「下载」目录）
    const win = BrowserWindow.getAllWindows()[0];
    const result = await dialog.showSaveDialog(win, {
      title: "导出简历 PDF",
      defaultPath: path.join(app.getPath("downloads"), fileName),
      filters: [{ name: "PDF 文档", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    // 3. 写入磁盘
    await fs.promises.writeFile(result.filePath, buffer);
    return { ok: true, path: result.filePath };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 初始化简历模块（注册 IPC 通道）
 * @returns {void}
 */
export function initResume() {
  ipcMain.handle("resume:export-pdf", handleExportPdf);
}
