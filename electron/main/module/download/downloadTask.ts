/**
 * 下载任务状态机（主进程）
 * ------------------------------------------------------------------
 * 一个 DownloadTask 实例对应一个下载任务，负责：
 * - 探测（probe）：GET Range 0-0 探测大小 / 是否支持断点续传 / 文件名；
 * - 启动：预分配 .jldl 分片文件 → 按并发连接数切分 Range 分段 → 并发下载；
 * - 暂停/恢复/重试：abort 全部分段 + 分段进度持久化，恢复时从断点继续；
 * - 完成：分片文件重命名为最终文件名（重名自动追加 (n)）。
 * 引擎（downloadEngine）负责任务调度、速度统计与推送，本类只管单任务生命周期。
 */
import fs from "node:fs";
import path from "node:path";
import { downloadSegment } from "./segmentDownloader.ts";
import { updateTaskFields } from "./downloadDb.ts";
import { httpErrorMessage } from "./httpErrors.ts";
import type { SpeedLimiter } from "./speedLimiter.ts";
import { sanitizeFilename, type DownloadTaskInfo, type SegmentState } from "./types.ts";

/** 引擎注入给任务的回调集合 */
interface TaskHooks {
  /** 必填，状态变化时回调（引擎负责持久化 + 推送） */
  onStateChange: (task: DownloadTask) => void;
  /** 必填，任务结束（完成/失败）时回调（引擎负责调度下一个任务） */
  onFinished: (task: DownloadTask) => void;
  /** 必填，全局限速器 */
  limiter: SpeedLimiter;
}

/**
 * 从 Content-Disposition 提取文件名
 * @param headers 必填，响应头
 * @returns 提取到的文件名，无则返回空字符串
 */
function filenameFromDisposition(headers: Headers): string {
  const cd = headers.get("content-disposition") || "";
  // 优先 RFC 5987: filename*=UTF-8''xxx
  const star = cd.match(/filename\*=(?:UTF-8|utf-8)''([^;]+)/);
  if (star) {
    try { return decodeURIComponent(star[1].replace(/"/g, "")); } catch { /* 解码失败走后续 */ }
  }
  const plain = cd.match(/filename="?([^";]+)"?/);
  return plain ? plain[1] : "";
}

/**
 * 从 URL 提取文件名（取 pathname 最后一段并解码）
 * @param url 必填，资源地址
 * @returns 文件名，无法识别时返回空字符串
 */
function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(last);
  } catch {
    return "";
  }
}

/**
 * 在目录内生成不重名的保存路径（重名追加 (n) 序号）
 * @param dir 必填，目标目录
 * @param filename 必填，期望文件名
 * @returns 不冲突的绝对路径
 */
export function uniqueSavePath(dir: string, filename: string): string {
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

/** 下载任务 */
export class DownloadTask {
  /** 任务信息（含运行时 speed） */
  info: DownloadTaskInfo;
  /** 分段状态数组（断点续传单元） */
  segments: SegmentState[] = [];
  /** 请求头（Cookie / UA / Referer 等） */
  headers: Record<string, string> = {};
  /** 全部 AbortController（暂停/取消时统一 abort） */
  private controllers = new Set<AbortController>();
  /** 当前运行 Promise（防止重复启动） */
  private runPromise: Promise<void> | null = null;
  /** 暂停标志：runPool 结束时区分「用户暂停」与「真失败」 */
  private pausing = false;
  /** 是否已用过「416 降级单线程重下」兜底（只用一次，防止循环重下） */
  private rangeFallbackUsed = false;
  /** 引擎回调 */
  private hooks: TaskHooks;

  /** 分片文件路径（最终文件名 + .jldl 后缀） */
  get partPath(): string {
    return this.info.savePath + ".jldl";
  }

  /**
   * @param info 必填，任务初始信息
   * @param headers 可选，请求头
   * @param hooks 必填，引擎回调
   */
  constructor(info: DownloadTaskInfo, headers: Record<string, string>, hooks: TaskHooks) {
    this.info = info;
    this.headers = headers;
    this.hooks = hooks;
    // 恢复分段进度（引擎从库中带出）
    if ((info as any).segments?.length) {
      this.segments = (info as any).segments;
    }
    if ((info as any).headers && Object.keys((info as any).headers).length) {
      this.headers = { ...(info as any).headers, ...headers };
    }
  }

  /**
   * 探测资源：大小 / 是否支持 Range / 文件名（不落盘）
   * 降级链：bytes=0-0 →（416 时）bytes=0- →（仍 416 时）普通 GET。
   * 部分服务器（CDN/PHP 脚本等）对任意 Range 请求返回 416 但全量下载正常，
   * 不能直接判失败，必须逐级降级。
   * @param url 必填，资源地址
   * @param headers 可选，附加请求头
   * @returns 探测结果 { finalUrl, filename, totalSize, acceptRanges }
   * @throws Error 所有探测方式均失败时抛出
   */
  static async probe(url: string, headers: Record<string, string> = {}): Promise<{
    finalUrl: string; filename: string; totalSize: number; acceptRanges: boolean;
  }> {
    try {
      return await probeOnce(url, headers, "bytes=0-0");
    } catch (e: any) {
      // 仅在「Range 被拒绝（416）」时降级，其他错误（网络/404 等）直接抛出
      if (e?.status !== 416) throw e;
      try {
        // 第二级：开放结束范围（部分服务器只接受 bytes=0- 形式）
        return await probeOnce(url, headers, "bytes=0-");
      } catch (e2: any) {
        if (e2?.status !== 416) throw e2;
        // 第三级：完全不带 Range 的普通 GET 探测（单线程下载）
        return await probePlain(url, headers);
      }
    }
  }

  /**
   * 计算已接收总字节数（各分段 downloaded 之和）
   * @returns 已接收字节数
   */
  calcReceived(): number {
    return this.segments.reduce((s, seg) => s + seg.downloaded, 0);
  }

  /**
   * 启动（新建或恢复）。已在下载中则忽略。
   * @returns Promise，任务结束（完成）或被暂停/失败后 settle
   */
  async start(): Promise<void> {
    if (this.runPromise) return;
    this.pausing = false;
    this.info.errorMsg = "";
    this.info.status = "downloading";
    this.hooks.onStateChange(this);

    this.runPromise = this.runPool()
      .catch((err: any) => {
        // 用户暂停：走正常暂停收尾；真异常：标记失败
        if (this.pausing || err?.name === "AbortError") {
          this.info.status = "paused";
        } else {
          this.info.status = "failed";
          this.info.errorMsg = String(err?.message || err);
          // 立即终止其余分段，避免失败后仍有分段后台写盘
          this.abortAll();
        }
        this.hooks.onStateChange(this);
      })
      .finally(() => {
        this.runPromise = null;
        this.controllers.clear();
        this.hooks.onFinished(this);
      });
    await this.runPromise;
  }

  /**
   * 中断当前全部请求（分段失败降级时调用，防止其余分段继续后台写盘）
   * @returns void
   */
  private abortAll(): void {
    for (const c of this.controllers) c.abort();
  }

  /**
   * 执行下载主流程（带 416/忽略Range 降级）：
   * 探测阶段判定了支持 Range，但实际分段请求被服务器以 416 拒绝或 200 忽略时，
   * 降级为单线程全量重下一次（只降级一次，防止循环）。
   * @returns Promise，全部分段完成时 resolve
   */
  private async runPool(): Promise<void> {
    try {
      await this.runPoolOnce();
    } catch (err: any) {
      const rangeRejected =
        err?.name === "RangeNotSatisfiableError" || err?.name === "RangeUnsupportedError";
      if (rangeRejected && !this.rangeFallbackUsed && !this.pausing) {
        this.rangeFallbackUsed = true;
        this.info.acceptRanges = false;
        this.info.connections = 1;
        this.info.receivedSize = 0;
        this.segments = [{ start: 0, end: -1, downloaded: 0 }];
        // 先中断其余分段请求并稍等句柄关闭，再清理分片文件
        this.abortAll();
        await new Promise((r) => setTimeout(r, 120));
        try { fs.rmSync(this.partPath, { force: true }); } catch { /* 忽略 */ }
        // 文件被占用删不掉时直接清空内容，保证单线程追加从 0 开始
        if (fs.existsSync(this.partPath)) {
          try { fs.closeSync(fs.openSync(this.partPath, "w")); } catch { /* 忽略 */ }
        }
        this.hooks.onStateChange(this);
        await this.runPoolOnce();
        return;
      }
      throw err;
    }
  }

  /**
   * 单轮下载主流程：校验分片文件 → 切分/恢复分段 → 并发下载 → 完成收尾
   * @returns Promise，全部分段完成时 resolve
   */
  private async runPoolOnce(): Promise<void> {
    const { savePath, totalSize, acceptRanges } = this.info;
    const partPath = this.partPath;

    // 不支持 Range 或大小未知：仅能顺序追加续传（同会话内）；文件缺失则从头下
    if (!acceptRanges || !totalSize) {
      const partExists = fs.existsSync(partPath);
      if (this.segments.length === 0 || !partExists) {
        try { fs.rmSync(partPath, { force: true }); } catch { /* 忽略 */ }
        this.segments = [{ start: 0, end: -1, downloaded: 0 }];
      }
    } else {
      // 分片文件不存在 / 大小与总大小不符（被用户删除等）→ 重建并重置分段
      let partOk = fs.existsSync(partPath) && fs.statSync(partPath).size === totalSize;
      if (!partOk) {
        this.segments = [];
      }
      // 分段为空（新任务）→ 预分配 + 切分
      if (this.segments.length === 0) {
        const fd = fs.openSync(partPath, "w");
        fs.ftruncateSync(fd, totalSize);
        fs.closeSync(fd);
        this.segments = this.splitSegments(totalSize, this.info.connections);
      }
      // 兜底：分段总量与总大小不符（历史脏数据）→ 重置
      const segTotal = this.segments.reduce((s, g) => s + (g.end - g.start + 1), 0);
      if (segTotal !== totalSize) {
        this.segments = this.splitSegments(totalSize, this.info.connections);
      }
    }
    this.info.receivedSize = this.calcReceived();

    // 并发执行全部分段（每个分段一个连接）
    const tasks = this.segments.map((seg) => this.runSegment(seg));
    await Promise.all(tasks);

    // 全部成功 → 收尾：关闭残留句柄风险已无，重命名分片为最终文件
    this.finish();
  }

  /**
   * 把总大小切分为 N 个连续分段（余数摊给前几个分段）
   * @param totalSize 必填，总字节数（>0）
   * @param count 必填，期望分段数（>=1）
   * @returns 分段数组
   */
  private splitSegments(totalSize: number, count: number): SegmentState[] {
    const n = Math.max(1, Math.min(count, Math.ceil(totalSize / (512 * 1024))));
    const base = Math.floor(totalSize / n);
    const segs: SegmentState[] = [];
    let cursor = 0;
    for (let i = 0; i < n; i++) {
      // 前 remainder 个分段各多承担 1 字节，保证拼起来正好等于总大小
      const size = base + (i < totalSize % n ? 1 : 0);
      segs.push({ start: cursor, end: cursor + size - 1, downloaded: 0 });
      cursor += size;
    }
    return segs;
  }

  /**
   * 运行单个分段（含暂停时注册/注销 AbortController、进度回写）
   * @param seg 必填，分段状态
   * @returns Promise，分段完成 resolve；被 abort 或重试耗尽时 reject
   */
  private async runSegment(seg: SegmentState): Promise<void> {
    // 已完成的分段直接跳过（恢复场景）
    if (seg.end >= 0 && seg.downloaded >= seg.end - seg.start + 1) return;
    const controller = new AbortController();
    this.controllers.add(controller);
    try {
      await downloadSegment({
        url: this.info.url,
        headers: this.headers,
        start: seg.start,
        end: seg.end,
        filePath: this.partPath,
        initialOffset: seg.downloaded,
        limiter: this.hooks.limiter,
        signal: controller.signal,
        onProgress: (bytes) => {
          seg.downloaded += bytes;
          this.info.receivedSize += bytes;
        },
      });
      // 未知大小模式：结束后把 downloaded 记为全量（end=-1 时无结束判定）
      if (seg.end < 0) {
        seg.end = seg.start + seg.downloaded - 1;
        this.info.totalSize = this.info.receivedSize;
        this.info.acceptRanges = false;
      }
    } finally {
      this.controllers.delete(controller);
    }
  }

  /**
   * 完成收尾：分片重命名为最终文件（重名追加 (n)），更新状态并持久化
   * @returns void
   */
  private finish(): void {
    try {
      const finalPath = uniqueSavePath(this.info.saveDir, this.info.filename);
      fs.renameSync(this.partPath, finalPath);
      this.info.savePath = finalPath;
      this.info.filename = path.basename(finalPath);
    } catch (e) {
      // 重命名失败（文件被占用等）：仍标记完成但保留分片，提示用户手动处理
      console.error("[downloader] 重命名分片失败:", e);
    }
    this.info.status = "completed";
    this.info.completedAt = nowStr();
    this.hooks.onStateChange(this);
  }

  /**
   * 暂停：abort 全部分段请求，等待收尾后状态置为 paused
   * @returns Promise，暂停完成
   */
  async pause(): Promise<void> {
    if (this.info.status !== "downloading") {
      // 非下载中（waiting）直接置 paused
      this.info.status = "paused";
      this.hooks.onStateChange(this);
      return;
    }
    this.pausing = true;
    for (const c of this.controllers) c.abort();
    // 等 runPromise 收尾（start 内部会把状态置为 paused）
    if (this.runPromise) {
      await this.runPromise.catch(() => {});
    }
  }

  /**
   * 持久化当前进度（引擎定时调用，节流由引擎控制）
   * @returns Promise，写库完成
   */
  async persist(): Promise<void> {
    await updateTaskFields(this.info.id, {
      status: this.info.status,
      receivedSize: this.info.receivedSize,
      totalSize: this.info.totalSize,
      segments: this.segments,
      errorMsg: this.info.errorMsg,
      filename: this.info.filename,
      savePath: this.info.savePath,
      completedAt: this.info.completedAt,
    });
  }
}

/**
 * 当前时间（YYYY-MM-DD HH:mm:ss，与项目其他表时间格式一致）
 * @returns 格式化时间字符串
 */
function nowStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 探测结果结构 */
interface ProbeResult {
  /** 跟随重定向后的最终地址 */
  finalUrl: string;
  /** 解析出的文件名 */
  filename: string;
  /** 总字节数（未知为 0） */
  totalSize: number;
  /** 是否支持 Range 断点续传 */
  acceptRanges: boolean;
}

/**
 * 从响应中提取文件名与大小并构造探测结果（probeOnce / probePlain 共用）
 * @param res 必填，探测响应
 * @param url 必填，原始地址（res.url 缺失时兜底）
 * @returns 探测结果
 */
async function buildProbeResult(res: Response, url: string): Promise<ProbeResult> {
  let totalSize = 0;
  let acceptRanges = false;
  const contentRange = res.headers.get("content-range");
  if (res.status === 206 && contentRange) {
    // 206 → 支持 Range；Content-Range: bytes 0-xxx/总大小
    acceptRanges = true;
    const m = contentRange.match(/\/(\d+)$/);
    if (m) totalSize = Number(m[1]);
  } else {
    // 服务器忽略 Range 返回 200，或无 Content-Range：取 Content-Length
    const len = res.headers.get("content-length");
    if (len) totalSize = Number(len);
  }
  // 文件名优先级：Content-Disposition > URL > 时间戳兜底
  const filename =
    sanitizeFilename(filenameFromDisposition(res.headers)) ||
    sanitizeFilename(filenameFromUrl(res.url || url)) ||
    `download_${Date.now()}.bin`;
  // 释放连接（探测不消费响应体）
  try { await res.body?.cancel(); } catch { /* 忽略 */ }
  return { finalUrl: res.url || url, filename, totalSize, acceptRanges };
}

/**
 * 带 Range 头的探测（probe 降级链第一/二级）
 * @param url 必填，资源地址
 * @param headers 必填，附加请求头
 * @param rangeValue 必填，Range 头值（如 bytes=0-0 / bytes=0-）
 * @returns 探测结果
 * @throws Error 带 status 属性的 HTTP 错误（416 时由调用方决定是否降级）
 */
async function probeOnce(url: string, headers: Record<string, string>, rangeValue: string): Promise<ProbeResult> {
  const res = await fetch(url, {
    headers: { ...headers, Range: rangeValue },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = new Error(httpErrorMessage(res.status, res.statusText));
    (err as any).status = res.status;
    try { await res.body?.cancel(); } catch { /* 忽略 */ }
    throw err;
  }
  return buildProbeResult(res, url);
}

/**
 * 不带 Range 的普通 GET 探测（probe 降级链第三级，单线程下载）
 * @param url 必填，资源地址
 * @param headers 必填，附加请求头
 * @returns 探测结果（acceptRanges 恒为 false）
 * @throws Error 带 status 属性的 HTTP 错误
 */
async function probePlain(url: string, headers: Record<string, string>): Promise<ProbeResult> {
  const res = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = new Error(httpErrorMessage(res.status, res.statusText));
    (err as any).status = res.status;
    try { await res.body?.cancel(); } catch { /* 忽略 */ }
    throw err;
  }
  return buildProbeResult(res, url);
}
