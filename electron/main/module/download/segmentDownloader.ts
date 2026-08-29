/**
 * 单分段下载器（主进程）
 * ------------------------------------------------------------------
 * 职责：负责一个 [start, end] 闭区间分段的数据拉取与落盘。
 * - 基于 Node 22 全局 fetch + HTTP Range 请求；
 * - 支持分段内断点续传：失败重试时从「已下载偏移」继续，而不是重下整段；
 * - 落盘使用 fs.promises.open('r+') + filehandle.write(buffer, offset, len, position)，
 *   多分段各持独立句柄写同一文件的不同区域（Windows 下 Node 文件打开自带共享读写标志）；
 * - 全局令牌桶限速在数据块循环中生效。
 */
import fs from "node:fs";
import { Readable } from "node:stream";
import type { SpeedLimiter } from "./speedLimiter.ts";
import { httpErrorMessage } from "./httpErrors.ts";

/** 分段下载参数 */
export interface SegmentOptions {
  /** 必填，资源地址 */
  url: string;
  /** 必填，附加请求头（Cookie / UA / Referer 等） */
  headers: Record<string, string>;
  /** 必填，分段起始字节（含） */
  start: number;
  /** 必填，分段结束字节（含）；-1 表示未知大小（不发 Range 头、从头流式下载） */
  end: number;
  /** 必填，目标文件路径（.jldl 分片文件） */
  filePath: string;
  /** 必填，初始已下载偏移（断点续传起点，相对分段起点） */
  initialOffset: number;
  /** 必填，全局限速器 */
  limiter: SpeedLimiter;
  /** 必填，中断信号（暂停/取消时 abort） */
  signal: AbortSignal;
  /** 可选，分段内失败重试次数，默认 3 */
  maxRetries?: number;
  /** 必填，进度回调（参数为本 chunk 字节数） */
  onProgress: (bytes: number) => void;
}

/**
 * 下载一个分段到文件指定区域
 * @param opts 必填，分段下载参数（见 SegmentOptions）
 * @returns Promise，成功 resolve（无返回值）；分省内重试耗尽后 reject Error
 * @throws Error 网络错误 / HTTP 状态异常 / 用户中断（signal 已 abort 时抛 AbortError）
 */
export async function downloadSegment(opts: SegmentOptions): Promise<void> {
  const { url, headers, start, end, filePath, initialOffset, limiter, signal, onProgress } = opts;
  const maxRetries = opts.maxRetries ?? 3;
  // 分段内已下载偏移（相对分段起点），重试时从该位置续传
  let offset = initialOffset;
  const isRangeMode = end >= 0 && !(start === 0 && end < 0);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 每次 attempt 前检查是否已被要求中断
    if (signal.aborted) throw abortError();
    let fileHandle: fs.promises.FileHandle | null = null;
    try {
      // 构造请求头；已知大小时带 Range（续传偏移 = start + offset）
      const reqHeaders: Record<string, string> = { ...headers };
      if (isRangeMode) {
        reqHeaders.Range = `bytes=${start + offset}-${end}`;
      }
      const res = await fetch(url, { headers: reqHeaders, signal, redirect: "follow" });
      if (!res.ok || !res.body) {
        // 状态码翻译为用户可读描述（416/200 忽略 Range 等专属分支保留专用错误名）
        const httpErr = new Error(httpErrorMessage(res.status, res.statusText));
        // 416：服务器拒绝 Range（探测阶段可能误判支持）→ 标记专用错误名，引擎据此降级单线程重下
        if (res.status === 416) {
          httpErr.name = "RangeNotSatisfiableError";
          (httpErr as any).noRetry = true;
          throw httpErr;
        }
        // Range 模式下服务器返回 200（完全忽略 Range 头）→ 继续写会数据错乱，标记降级错误
        if (isRangeMode && res.status === 200) {
          httpErr.name = "RangeUnsupportedError";
          (httpErr as any).noRetry = true;
          throw httpErr;
        }
        // 其他 4xx（除 408 请求超时 / 429 过载）重试无意义，快速失败
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          (httpErr as any).noRetry = true;
          throw httpErr;
        }
        // 5xx / 网络错误：走外层重试
        throw httpErr;
      }
      // 打开/创建目标文件；'a' 追加模式对未知大小流式写，'r+' 定位写用于 Range 模式
      fileHandle = await fs.promises.open(
        filePath,
        isRangeMode ? "r+" : "a"
      );
      // Web ReadableStream → Node 可读流，逐块写盘
      const nodeStream = Readable.fromWeb(res.body as any);
      for await (const chunk of nodeStream) {
        if (signal.aborted) throw abortError();
        const buf = chunk as Buffer;
        // 全局限速：申请令牌后再落盘
        await limiter.take(buf.length);
        if (isRangeMode) {
          // 定位写：文件内绝对位置 = 分段起点 + 当前偏移
          await fileHandle.write(buf, 0, buf.length, start + offset);
        } else {
          // 追加写：无 Range 时响应体从 0 开始，顺序追加即可
          await fileHandle.write(buf);
        }
        offset += buf.length;
        onProgress(buf.length);
      }
      // 正常读完，返回
      await fileHandle.close();
      fileHandle = null;
      return;
    } catch (err: any) {
      if (fileHandle) {
        try { await fileHandle.close(); } catch { /* 忽略关闭错误 */ }
        fileHandle = null;
      }
      // 用户主动中断：直接上抛，不重试
      if (signal.aborted || err?.name === "AbortError") throw abortError();
      // 不可重试错误（416 / 4xx / 服务器忽略 Range）：原样上抛，保留错误名供引擎降级判断
      if (err?.noRetry) throw err;
      // 最后一次重试仍失败：抛出真实错误
      if (attempt >= maxRetries) {
        throw new Error(`分段下载失败(start=${start}, offset=${offset}): ${err?.message || err}`);
      }
      // 指数退避后重试（200ms / 400ms / 800ms）
      await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
    }
  }
  throw new Error("分段下载失败：重试耗尽");
}

/**
 * 构造标准 AbortError
 * @returns Error（name = 'AbortError'）
 */
function abortError(): Error {
  const e = new Error("下载已中断");
  e.name = "AbortError";
  return e;
}
