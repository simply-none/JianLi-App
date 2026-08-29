/**
 * 下载引擎（主进程，任务调度中枢）
 * ------------------------------------------------------------------
 * 职责：
 * - 任务表管理：create（探测→入库→排队）、pause/resume/retry/remove；
 * - 队列调度：maxConcurrent 并发上限，任务结束自动补位；
 * - 速度统计：定时（800ms）计算每个任务实时速度并推送给渲染端（download:updated）；
 * - 进度持久化：每 3s 落库一次，重启后任务可从断点恢复；
 * - 启动恢复：把「下载中」的任务重置为「已暂停」，等待用户手动继续。
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { win } from "../mainWindow.ts";
import { store } from "../store.ts";
import { SpeedLimiter } from "./speedLimiter.ts";
import { DownloadTask, uniqueSavePath } from "./downloadTask.ts";
import { saveTask, updateTaskFields, deleteTask, listTasks } from "./downloadDb.ts";
import {
  DEFAULT_DOWNLOADER_CONFIG,
  CONFIG_STORE_KEY,
  detectCategory,
  sanitizeFilename,
  type DownloaderConfig,
  type DownloadTaskInfo,
} from "./types.ts";

/** 下载引擎单例 */
class DownloadEngine {
  /** 全部任务（内存态，含 waiting/downloading 运行对象） */
  private tasks = new Map<string, DownloadTask>();
  /** 运行配置 */
  config: DownloaderConfig = { ...DEFAULT_DOWNLOADER_CONFIG };
  /** 全局限速器（getter 动态读取 maxSpeed，改配置即时生效） */
  private limiter = new SpeedLimiter(() => this.config.maxSpeed);
  /** 推送节流定时器 */
  private pushTimer: NodeJS.Timeout | null = null;
  /** 持久化节流定时器 */
  private persistTimer: NodeJS.Timeout | null = null;
  /** 脏标记：有进度变化时置 true，推送周期内只推一次 */
  private dirty = true;
  /** 每个任务上次推送时的已接收字节（速度计算基准） */
  private lastReceived = new Map<string, number>();

  /**
   * 初始化：加载配置与任务表，恢复中断任务，启动推送/持久化循环
   * @returns Promise，初始化完成
   */
  async init(): Promise<void> {
    // 读取配置（合并默认值，防新增字段缺失）
    const saved = store.get(CONFIG_STORE_KEY) as Partial<DownloaderConfig> | undefined;
    this.config = { ...DEFAULT_DOWNLOADER_CONFIG, ...(saved || {}) };
    if (!this.config.saveDir) this.config.saveDir = app.getPath("downloads");

    // 恢复任务表：上次「下载中/排队中」的任务统一置为 paused（进程重启即中断）
    const rows = await listTasks();
    for (const row of rows) {
      const status = row.status === "downloading" || row.status === "waiting" ? "paused" : row.status;
      if (status !== row.status) {
        await updateTaskFields(row.id, { status });
        row.status = status;
      }
      const task = new DownloadTask({ ...row, speed: 0 } as DownloadTaskInfo, row.headers || {}, {
        onStateChange: (t) => this.onTaskStateChange(t),
        onFinished: (t) => this.onTaskFinished(t),
        limiter: this.limiter,
      });
      this.tasks.set(task.info.id, task);
    }

    // 推送循环（800ms 节流：算速度 + 推列表）
    this.pushTimer = setInterval(() => this.tickPush(), 800);
    // 持久化循环（3s 节流：下载中的任务写库）
    this.persistTimer = setInterval(() => this.tickPersist(), 3000);
  }

  /**
   * 读取当前配置（含 saveDir 兜底）
   * @returns 配置副本
   */
  getConfig(): DownloaderConfig {
    return { ...this.config };
  }

  /**
   * 更新配置（立即生效并持久化到 electron-store）
   * @param partial 必填，要更新的配置项
   * @returns 更新后的配置
   */
  setConfig(partial: Partial<DownloaderConfig>): DownloaderConfig {
    this.config = { ...this.config, ...partial };
    if (!this.config.saveDir) this.config.saveDir = app.getPath("downloads");
    // 连接数/并发数合法性钳制
    this.config.maxConcurrent = Math.max(1, Math.min(10, Math.floor(this.config.maxConcurrent) || 3));
    this.config.connectionsPerTask = Math.max(1, Math.min(64, Math.floor(this.config.connectionsPerTask) || 16));
    this.config.maxSpeed = Math.max(0, Math.floor(this.config.maxSpeed) || 0);
    store.set(CONFIG_STORE_KEY, this.config);
    // 并发上限缩小后触发一次调度
    this.pump();
    return this.getConfig();
  }

  /**
   * 新建任务：探测资源 → 确定文件名/路径/分类 → 入库 → 排队
   * @param url 必填，资源地址（http/https）
   * @param opts 可选，{ filename?, saveDir?, headers?, connections? }
   * @returns 创建好的任务信息；失败抛 Error（探测失败等）
   */
  async createTask(url: string, opts: { filename?: string; saveDir?: string; headers?: Record<string, string>; connections?: number } = {}): Promise<DownloadTaskInfo> {
    if (!/^https?:\/\//i.test(url)) throw new Error("仅支持 http/https 链接");
    // 探测：大小 / Range 支持 / 默认文件名
    const probe = await DownloadTask.probe(url, opts.headers || {});
    const saveDir = opts.saveDir || this.config.saveDir;
    // 文件名优先级：外部指定（浏览器接管传入 DownloadItem 的正确文件名）> 探测结果
    const finalFilename = sanitizeFilename(opts.filename || probe.filename);
    const savePath = uniqueSavePath(saveDir, finalFilename);
    const id = `jdl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // 连接数优先级：用户指定 > 服务器支持且文件较大时按配置 > 其他情况单线程
    const autoConnections =
      probe.acceptRanges && probe.totalSize > 1024 * 1024 ? this.config.connectionsPerTask : 1;
    const connections = Math.max(1, Math.min(64, Math.floor(opts.connections || 0) || autoConnections));
    const info: DownloadTaskInfo = {
      id,
      url: probe.finalUrl,
      filename: path.basename(savePath),
      savePath,
      saveDir,
      status: "waiting",
      totalSize: probe.totalSize,
      receivedSize: 0,
      category: detectCategory(finalFilename),
      speed: 0,
      acceptRanges: probe.acceptRanges,
      connections,
      errorMsg: "",
      createdAt: nowStr(),
      completedAt: "",
    };
    const task = new DownloadTask(info, opts.headers || {}, {
      onStateChange: (t) => this.onTaskStateChange(t),
      onFinished: (t) => this.onTaskFinished(t),
      limiter: this.limiter,
    });
    await saveTask({ ...info, segments: [], headers: opts.headers || {} });
    this.tasks.set(id, task);
    this.dirty = true;
    // 立即调度（有空闲槽位就直接开跑）
    this.pump();
    return { ...task.info };
  }

  /**
   * 队列调度：把 waiting 任务填入空闲并发槽位
   * @returns void
   */
  private pump(): void {
    const running = [...this.tasks.values()].filter((t) => t.info.status === "downloading").length;
    let slots = this.config.maxConcurrent - running;
    if (slots <= 0) return;
    for (const task of this.tasks.values()) {
      if (slots <= 0) break;
      if (task.info.status === "waiting") {
        slots--;
        // 启动异步执行，不阻塞调度循环
        task.start().catch(() => {});
      }
    }
  }

  /**
   * 任务状态变化回调（DownloadTask → 引擎）：标脏推送
   * @param _task 必填，状态变化的任务
   * @returns void
   */
  private onTaskStateChange(_task: DownloadTask): void {
    this.dirty = true;
  }

  /**
   * 任务结束回调（完成/暂停/失败）：持久化终态 + 触发调度补位
   * @param task 必填，结束的任务
   * @returns void
   */
  private onTaskFinished(task: DownloadTask): void {
    this.dirty = true;
    task.persist().catch(() => {});
    this.pump();
  }

  /**
   * 暂停任务（下载中 abort 分段；排队中移出队列）
   * @param id 必填，任务 ID
   * @returns 是否成功
   */
  async pauseTask(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task) return false;
    if (task.info.status === "waiting") {
      task.info.status = "paused";
      this.dirty = true;
      return true;
    }
    if (task.info.status === "downloading") {
      await task.pause();
      return true;
    }
    return false;
  }

  /**
   * 恢复任务：置为 waiting 交由调度器启动（有空闲槽位立即开跑）
   * @param id 必填，任务 ID
   * @returns 是否成功
   */
  resumeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    if (task.info.status !== "paused" && task.info.status !== "failed") return false;
    task.info.status = "waiting";
    this.dirty = true;
    this.pump();
    return true;
  }

  /**
   * 删除任务：终止进行中的下载并删除分片文件，再删库中记录
   * @param id 必填，任务 ID
   * @param deleteFile 可选，是否同时删除已完成的目标文件，默认 false
   * @returns 是否成功
   */
  async removeTask(id: string, deleteFile = false): Promise<boolean> {
    const task = this.tasks.get(id);
    if (task) {
      // 进行中先暂停（abort 全部分段）
      if (task.info.status === "downloading" || task.info.status === "waiting") {
        await task.pause().catch(() => {});
      }
      if (task.info.status !== "completed") {
        // 未完成任务：删除分片文件
        try { fs.rmSync(task.partPath, { force: true }); } catch { /* 忽略 */ }
      } else if (deleteFile) {
        // 已完成任务且要求删除：删除成品文件
        try { fs.rmSync(task.info.savePath, { force: true }); } catch { /* 忽略 */ }
      }
      this.tasks.delete(id);
    }
    this.dirty = true;
    return deleteTask(id);
  }

  /**
   * 查询全部任务列表（推送给渲染端的结构）
   * @returns 任务信息数组（按创建时间倒序）
   */
  getTaskList(): DownloadTaskInfo[] {
    return [...this.tasks.values()]
      .map((t) => ({ ...t.info }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  /**
   * 推送节拍：计算速度 → 节流推送到主窗口渲染端
   * @returns void
   */
  private tickPush(): void {
    for (const task of this.tasks.values()) {
      const last = this.lastReceived.get(task.info.id) ?? task.info.receivedSize;
      const delta = task.info.receivedSize - last;
      this.lastReceived.set(task.info.id, task.info.receivedSize);
      if (task.info.status === "downloading") {
        // 指数移动平均平滑速度（B/s）；有新字节就标脏，保证进度持续推送
        const instant = (delta / 0.8);
        task.info.speed = task.info.speed ? task.info.speed * 0.6 + instant * 0.4 : instant;
        if (delta > 0) this.dirty = true;
      } else {
        task.info.speed = 0;
      }
    }
    // 状态或进度有变化才推送，降低 IPC 噪音
    if (!this.dirty) return;
    this.dirty = false;
    try {
      win?.webContents.send("download:updated", this.getTaskList());
    } catch (e) {
      console.error("[downloader] 推送任务列表失败:", e);
    }
  }

  /**
   * 持久化节拍：下载中的任务每 3s 落库一次进度（断电/崩溃可恢复）
   * @returns void
   */
  private tickPersist(): void {
    for (const task of this.tasks.values()) {
      if (task.info.status === "downloading") {
        task.persist().catch(() => {});
      }
    }
  }
}

/**
 * 当前时间（YYYY-MM-DD HH:mm:ss）
 * @returns 格式化时间字符串
 */
function nowStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 引擎单例导出（downloadIpc / downloadInterceptor 共用） */
export const downloadEngine = new DownloadEngine();
