/**
 * 【数据获取】IPC 通道注册
 * ------------------------------------------------------------------
 * 通道清单：
 * - scraper:run-task      渲染→主 启动采集任务（run/test 模式），返回 taskId
 * - scraper:stop-task     渲染→主 请求取消任务
 * - scraper:login-start   渲染→主 打开有头登录窗口
 * - scraper:login-finish  渲染→主 完成登录并保存 Cookie 档案
 * - scraper:login-cancel  渲染→主 取消登录会话
 * - scraper:login-list    渲染→主 列出登录档案
 * - scraper:login-delete  渲染→主 删除登录档案
 * - scraper:get-settings  渲染→主 读取全局设置
 * - scraper:set-settings  渲染→主 保存全局设置（无头/代理变化自动重建浏览器）
 * - scraper:reveal-file   渲染→主 在系统文件管理器中定位文件（导出结果跳转用）
 * - scraper:task-progress 主→渲染 实时进度推送
 * - scraper:task-result   主→渲染 任务结果推送
 */
import { ipcMain, app, shell } from "electron";
import fs from "node:fs";
import { runScraperTask, stopScraperTask } from "./engine.ts";
import {
  openLoginSession,
  finishLoginSession,
  closeLoginSession,
  listLoginProfiles,
  deleteLoginProfile,
  getSettings,
  saveSettings,
  cleanupOnQuit,
} from "./browser.ts";
import type { ScrapeConfig, ScraperSettings } from "./types.ts";

/** 已初始化标记（防重复注册） */
let initialized = false;

/**
 * 注册数据获取模块的全部 IPC 通道，并挂载应用退出清理
 */
export function initDataAcquisition(): void {
  if (initialized) return;
  initialized = true;

  // 启动采集任务：渲染端生成 taskId，主进程异步执行并实时推送进度/结果
  ipcMain.handle(
    "scraper:run-task",
    async (event, params: { taskId: string; config: ScrapeConfig; mode: "run" | "test" }) => {
      const { taskId, config, mode } = params || ({} as any);
      if (!taskId || !config || !config.url) {
        return { success: false, error: "缺少 taskId 或 URL" };
      }
      // 异步执行，不阻塞 invoke 返回（结果经 scraper:task-result 推送）
      runScraperTask({
        taskId,
        config,
        mode: mode === "test" ? "test" : "run",
        sender: event.sender,
      }).catch((err) => {
        console.error("[数据获取] 任务执行异常:", err);
      });
      return { success: true };
    }
  );

  // 请求取消任务
  ipcMain.handle("scraper:stop-task", (_event, taskId: string) => {
    return { success: stopScraperTask(taskId) };
  });

  // 在系统文件管理器中定位文件（导出结果提示的跳转入口）
  ipcMain.handle("scraper:reveal-file", (_event, filePath: string) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    }
    return { success: false, error: "文件不存在或已被移动" };
  });

  // 打开有头登录窗口
  ipcMain.handle("scraper:login-start", async (_event, params: { profile: string; url: string }) => {
    try {
      if (!params?.profile || !params?.url) {
        return { success: false, error: "缺少档案名或登录 URL" };
      }
      await openLoginSession(params.profile, params.url);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 完成登录：保存 Cookie 并关闭有头窗口
  ipcMain.handle("scraper:login-finish", async (_event, params: { profile: string }) => {
    try {
      const cookieCount = await finishLoginSession(params?.profile || "");
      return { success: true, cookieCount };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 取消登录会话
  ipcMain.handle("scraper:login-cancel", async () => {
    await closeLoginSession();
    return { success: true };
  });

  // 列出登录档案
  ipcMain.handle("scraper:login-list", () => {
    return { success: true, data: listLoginProfiles() };
  });

  // 删除登录档案
  ipcMain.handle("scraper:login-delete", (_event, params: { profile: string }) => {
    deleteLoginProfile(params?.profile || "");
    return { success: true };
  });

  // 全局设置读写
  ipcMain.handle("scraper:get-settings", () => {
    return getSettings();
  });
  ipcMain.handle("scraper:set-settings", (_event, patch: Partial<ScraperSettings>) => {
    return saveSettings(patch || {});
  });

  // 应用退出清理：关闭共享浏览器与登录会话，避免残留 Chrome 进程
  app.on("before-quit", () => {
    cleanupOnQuit();
  });
}
