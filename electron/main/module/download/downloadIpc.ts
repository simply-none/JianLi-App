/**
 * 下载器 IPC 通道注册（主进程）
 * ------------------------------------------------------------------
 * 通道契约：
 * - download:create          新建任务 {url, filename?, saveDir?, headers?} → 任务信息
 * - download:list            查询任务列表 → 任务信息数组
 * - download:pause           暂停 {id}
 * - download:resume          继续 {id}
 * - download:remove          删除 {id, deleteFile?}
 * - download:open            打开文件 {id}
 * - download:show-in-folder  在文件夹中显示 {id}
 * - download:get-config      读取配置 → DownloaderConfig
 * - download:set-config      保存配置 {partial} → DownloaderConfig
 * 推送通道：
 * - download:updated         任务列表全量推送（引擎 800ms 节流）
 * - download:clipboard-detected  剪贴板发现下载链接（拦截器发出）
 */
import { ipcMain, shell } from "electron";
import { downloadEngine } from "./downloadEngine.ts";

/**
 * 注册全部下载器 IPC 通道（进程内只调用一次）
 * @returns void
 */
export function registerDownloadIpc(): void {
  // 新建任务：探测失败等异常以 {success:false,error} 返回
  ipcMain.handle("download:create", async (_e, args: { url?: string; filename?: string; saveDir?: string; headers?: Record<string, string>; connections?: number }) => {
    try {
      const info = await downloadEngine.createTask(args?.url || "", {
        filename: args?.filename,
        saveDir: args?.saveDir,
        headers: args?.headers,
        connections: args?.connections,
      });
      return { success: true, data: info };
    } catch (err: any) {
      return { success: false, error: String(err?.message || err) };
    }
  });

  // 查询任务列表
  ipcMain.handle("download:list", () => {
    return { success: true, data: downloadEngine.getTaskList() };
  });

  // 暂停任务
  ipcMain.handle("download:pause", async (_e, args: { id?: string }) => {
    const ok = await downloadEngine.pauseTask(args?.id || "");
    return ok ? { success: true } : { success: false, error: "任务不存在或状态不允许暂停" };
  });

  // 恢复任务
  ipcMain.handle("download:resume", (_e, args: { id?: string }) => {
    const ok = downloadEngine.resumeTask(args?.id || "");
    return ok ? { success: true } : { success: false, error: "任务不存在或状态不允许继续" };
  });

  // 删除任务（可选同时删除已完成的文件）
  ipcMain.handle("download:remove", async (_e, args: { id?: string; deleteFile?: boolean }) => {
    const ok = await downloadEngine.removeTask(args?.id || "", !!args?.deleteFile);
    return ok ? { success: true } : { success: false, error: "删除失败" };
  });

  // 打开已完成的文件
  ipcMain.handle("download:open", async (_e, args: { id?: string }) => {
    const task = downloadEngine.getTaskList().find((t) => t.id === args?.id);
    if (!task) return { success: false, error: "记录不存在" };
    const errMsg = await shell.openPath(task.savePath);
    return errMsg ? { success: false, error: errMsg } : { success: true };
  });

  // 在文件夹中显示
  ipcMain.handle("download:show-in-folder", (_e, args: { id?: string }) => {
    const task = downloadEngine.getTaskList().find((t) => t.id === args?.id);
    if (!task) return { success: false, error: "记录不存在" };
    shell.showItemInFolder(task.savePath);
    return { success: true };
  });

  // 读取配置
  ipcMain.handle("download:get-config", () => {
    return { success: true, data: downloadEngine.getConfig() };
  });

  // 保存配置
  ipcMain.handle("download:set-config", (_e, args: { partial?: Record<string, any> }) => {
    return { success: true, data: downloadEngine.setConfig(args?.partial || {}) };
  });
}
