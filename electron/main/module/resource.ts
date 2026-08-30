/**
 * 资源管理模块（主进程）
 *
 * 为资源管理页面提供文件级 IPC 能力：
 * 1. resource:read-text-file —— 读取文本文件内容用于预览（限制大小，防大文件卡死）
 * 2. resource:delete-file    —— 删除资源物理文件（带缓存目录白名单校验，防误删系统文件）
 */
import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";

/** 文本预览最大读取字节数（2MB），超出部分截断并提示 */
const MAX_TEXT_READ_BYTES = 2 * 1024 * 1024;

/**
 * 规范化路径（转绝对路径 + 小写盘符，统一 Windows 分隔符）
 *
 * @param {string} p - 原始路径
 * @returns {string} 规范化后的绝对路径
 * @throws {Error} 路径为空或非法时抛出
 */
function normalizePath(p: string): string {
  if (!p || typeof p !== "string") {
    throw new Error("路径为空或非法");
  }
  // 兼容 file:// 前缀（渲染端历史数据可能携带）
  const raw = p.startsWith("file://") ? p.slice("file://".length) : p;
  const abs = path.resolve(decodeURIComponent(raw));
  // Windows 盘符统一小写，避免 C: / c: 比较不一致
  return abs.replace(/^[A-Z]:/, (m) => m.toLowerCase());
}

/**
 * 注册资源管理相关 IPC 通道（在主进程 ready 后调用一次）
 *
 * @returns {void} 无返回值
 */
export function initResource() {
  /**
   * 读取文本文件内容（用于资源预览）
   *
   * 入参：{ path: string }
   * 出参：{ success: boolean, content?: string, truncated?: boolean, size?: number, error?: string }
   */
  ipcMain.handle("resource:read-text-file", async (_e, args: { path: string }) => {
    try {
      const abs = normalizePath(args?.path || "");
      const stat = await fs.promises.stat(abs);
      if (!stat.isFile()) {
        return { success: false, error: "目标不是文件" };
      }
      const truncated = stat.size > MAX_TEXT_READ_BYTES;
      const handle = await fs.promises.open(abs, "r");
      try {
        const length = Math.min(stat.size, MAX_TEXT_READ_BYTES);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, 0);
        return {
          success: true,
          content: buffer.toString("utf-8"),
          truncated,
          size: stat.size,
        };
      } finally {
        await handle.close();
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 删除资源物理文件
   *
   * 入参：{ path: string, cacheDir: string }
   *   - path     待删除文件的绝对路径
   *   - cacheDir 资源缓存目录（白名单），仅允许删除该目录内的文件
   * 出参：{ success: boolean, error?: string }
   */
  ipcMain.handle("resource:delete-file", async (_e, args: { path: string; cacheDir: string }) => {
    try {
      const abs = normalizePath(args?.path || "");
      const dir = normalizePath(args?.cacheDir || "");
      // 白名单校验：目标文件必须位于缓存目录内
      if (!dir || !abs.startsWith(dir + path.sep)) {
        return { success: false, error: "文件不在资源缓存目录内，已拒绝删除" };
      }
      await fs.promises.access(abs, fs.constants.F_OK);
      await fs.promises.unlink(abs);
      return { success: true };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      // 文件本就不存在视为删除成功（幂等）
      if (e.code === "ENOENT") {
        return { success: true };
      }
      return { success: false, error: e.message };
    }
  });
}
