/**
 * 内置浏览器 - 下载管理（主进程）
 * ------------------------------------------------------------------
 * 职责：拦截 webview 会话的 will-download 事件，跟踪下载进度并推送到渲染端。
 * 设计要点：
 * - 通过 app.on('web-contents-created') 捕获所有 webview 挂载（did-attach-webview），
 *   对其 session 做一次性挂钩（session.__browserDownloadHooked 防重复），无需关心
 *   webview 是何时何地创建的；
 * - 文件统一保存到系统「下载」文件夹，重名自动追加 (n) 序号（对齐主流浏览器，免弹保存框）；
 * - 进度变化通过 browser-download:updated 通道把全量列表推给主窗口渲染端（列表很小）。
 *
 * IPC 通道：
 * - browser-download:list          查询下载列表
 * - browser-download:cancel        取消进行中的下载
 * - browser-download:open          打开已下载文件
 * - browser-download:show-in-folder 在文件夹中显示文件
 * - browser-download:clear         清除已完成/已取消/已中断的记录
 */
import { app, DownloadItem, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { win } from "./mainWindow.ts";
import { shouldTakeOverDownload, takeOverBrowserDownload } from "./download/downloadInterceptor.ts";

/** 下载状态 */
type DownloadState = "progressing" | "completed" | "cancelled" | "interrupted";

/** 下载记录（推送给渲染端的数据结构） */
interface DownloadRecord {
  /** 下载 ID */
  id: string;
  /** 资源地址 */
  url: string;
  /** 文件名 */
  filename: string;
  /** 保存路径（绝对） */
  path: string;
  /** 总字节数（未知为 0） */
  totalBytes: number;
  /** 已接收字节数 */
  receivedBytes: number;
  /** 状态 */
  state: DownloadState;
  /** 开始时间戳（ms） */
  startTime: number;
  /** 结束时间戳（ms），进行中为 undefined */
  endTime?: number;
}

/** 下载记录表 */
const records = new Map<string, DownloadRecord>();
/** 进行中的 DownloadItem 引用（用于取消） */
const items = new Map<string, DownloadItem>();

/** 渲染端推送通道名 */
const UPDATED_CHANNEL = "browser-download:updated";

/**
 * 生成下载列表（按开始时间倒序）
 * @returns 记录数组
 */
function toList(): DownloadRecord[] {
  return [...records.values()].sort((a, b) => b.startTime - a.startTime);
}

/** 把当前列表推送给主窗口渲染端 */
function pushUpdate() {
  try {
    win?.webContents.send(UPDATED_CHANNEL, toList());
  } catch (e) {
    // 窗口销毁等场景忽略
    console.error("[browser-download] 推送更新失败:", e);
  }
}

/**
 * 在指定目录内生成不重名的保存路径（重名追加 (n) 序号）
 * @param dir 必填，目标目录
 * @param filename 必填，原始文件名
 * @returns 不冲突的绝对路径
 */
function uniqueSavePath(dir: string, filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  let n = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

/**
 * 生成下载 ID
 * @returns 形如 dl-{时间戳}-{随机串}
 */
function makeId(): string {
  return `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// 捕获所有 webview 的会话并挂钩下载事件（模块加载时即注册）
app.on("web-contents-created", (_event, contents) => {
  contents.on("did-attach-webview", (_e, webContents) => {
    const session = webContents.session as any;
    // 同一会话只挂一次
    if (session.__browserDownloadHooked) return;
    session.__browserDownloadHooked = true;

    session.on("will-download", (_e2: any, item: DownloadItem) => {
      // 下载引擎接管开关开启：转交给系统级下载器（多线程分段），本管线不处理
      if (shouldTakeOverDownload()) {
        _e2.preventDefault();
        item.cancel();
        takeOverBrowserDownload(item);
        return;
      }
      const id = makeId();
      const savePath = uniqueSavePath(app.getPath("downloads"), item.getFilename());
      // 免弹保存框，直接落到「下载」文件夹
      item.setSavePath(savePath);

      const rec: DownloadRecord = {
        id,
        url: item.getURL(),
        filename: path.basename(savePath),
        path: savePath,
        totalBytes: item.getTotalBytes(),
        receivedBytes: 0,
        state: "progressing",
        startTime: Date.now(),
      };
      records.set(id, rec);
      items.set(id, item);

      // 进度更新
      item.on("updated", (_e3, state) => {
        rec.receivedBytes = item.getReceivedBytes();
        rec.totalBytes = item.getTotalBytes();
        rec.state = state === "interrupted" ? "interrupted" : "progressing";
        pushUpdate();
      });

      // 结束（completed / cancelled / interrupted）
      item.once("done", (_e4, state) => {
        rec.state = state as DownloadState;
        rec.receivedBytes = item.getReceivedBytes();
        rec.endTime = Date.now();
        items.delete(id);
        pushUpdate();
      });

      pushUpdate();
    });
  });
});

/**
 * 初始化下载管理 IPC 通道（在 createWindow 中调用一次）
 */
export function initBrowserDownload() {
  // 查询列表
  ipcMain.handle("browser-download:list", () => {
    return { success: true, data: toList() };
  });

  // 取消下载
  ipcMain.handle("browser-download:cancel", (_e, args: { id?: string }) => {
    const id = args?.id || "";
    const item = items.get(id);
    const rec = records.get(id);
    if (item) {
      if (item.canCancel()) {
        item.cancel();
        if (rec) rec.state = "cancelled";
      }
      return { success: true };
    }
    return { success: false, error: "下载不存在或已结束" };
  });

  // 打开文件
  ipcMain.handle("browser-download:open", async (_e, args: { id?: string }) => {
    const rec = records.get(args?.id || "");
    if (!rec) return { success: false, error: "记录不存在" };
    const errMsg = await shell.openPath(rec.path);
    return errMsg ? { success: false, error: errMsg } : { success: true };
  });

  // 在文件夹中显示
  ipcMain.handle("browser-download:show-in-folder", (_e, args: { id?: string }) => {
    const rec = records.get(args?.id || "");
    if (!rec) return { success: false, error: "记录不存在" };
    shell.showItemInFolder(rec.path);
    return { success: true };
  });

  // 清除非进行中的记录
  ipcMain.handle("browser-download:clear", () => {
    for (const [id, rec] of records) {
      if (rec.state !== "progressing") {
        records.delete(id);
      }
    }
    pushUpdate();
    return { success: true };
  });
}
