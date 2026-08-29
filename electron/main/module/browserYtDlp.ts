/**
 * 内置浏览器 - yt-dlp 视频解析/下载引擎（方案 D）
 * ------------------------------------------------------------------
 * 职责：主进程托管 yt-dlp.exe（社区维护的站点解析器，支持数百个视频站），
 * 为资源嗅探提供「解析直链 + 直接下载」兜底能力，覆盖方案 A/B 拿不到的
 * 签名地址（B 站 DASH 合成、YouTube 分辨率选择等）。
 *
 * 工具管理：
 * - 首次使用自动从 GitHub Releases 下载 yt-dlp.exe（约 17MB）；
 * - ffmpeg 按需下载（DASH 音视频合并必需，约 80MB 压缩包），
 *   仅在触发下载任务时自动获取；
 * - 二进制存放于 userData/browser-tools/，卸载应用即清理。
 *
 * IPC 通道（渲染端经 useYtDlp 调用）：
 * - browser-ytdlp:check         → { installed, ffmpegInstalled, installing }
 * - browser-ytdlp:install       → 下载 yt-dlp（进度经 browser-ytdlp:progress 推送，支持暂停/续传）
 * - browser-ytdlp:engine-pause  → 暂停引擎下载（保留 .part 断点）
 * - browser-ytdlp:engine-resume → 恢复引擎下载（HTTP Range 断点续传）
 * - browser-ytdlp:parse         { url } → 解析页面可用的格式清单（直链/清晰度/大小）
 * - browser-ytdlp:download      { url, formatId? } → 启动下载任务（返回 jobId）
 * - browser-ytdlp:pause         { jobId } → 暂停下载任务（终止进程，保留 .part）
 * - browser-ytdlp:resume        { jobId } → 恢复下载任务（重启进程自动续传）
 * - browser-ytdlp:cancel        { jobId } → 取消下载任务
 * 进度推送：browser-ytdlp:progress { jobId?, stage, percent?, received?, total?, message? }
 */
import { app, ipcMain, net } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { win } from "./mainWindow.ts";

/** 进度推送通道 */
const PROGRESS_CHANNEL = "browser-ytdlp:progress";

/** yt-dlp.exe 下载地址（GitHub 最新 Release） */
const YT_DLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
/** ffmpeg win64 GPL 构建下载地址（含 ffmpeg.exe/ffprobe.exe 的 zip 包） */
const FFMPEG_URL = "https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip";

/** 解析超时（ms）：站点响应慢时兜底中断 */
const PARSE_TIMEOUT = 60_000;

/** yt-dlp.exe 最小合法体积（正式版约 17MB；低于此值视为下载中断产生的损坏文件） */
const MIN_YTDLP_SIZE = 10 * 1024 * 1024;
/** ffmpeg zip 最小合法体积（压缩包约 80MB） */
const MIN_FFMPEG_ZIP_SIZE = 30 * 1024 * 1024;

/** 安装状态（yt-dlp 主二进制） */
let installing = false;
/** ffmpeg 安装中标记（并发下载去重） */
let ffmpegInstalling = false;
/** ffmpeg 安装完成的 Promise 缓存（多任务共享同一次下载） */
let ffmpegPromise: Promise<void> | null = null;

/** yt-dlp 引擎下载的临时断点文件（完成后重命名为正式 exe） */
const YT_DLP_PART = ytdlpPath() + ".part";

/** 引擎下载运行状态（供暂停/恢复/进度查询） */
let engineDl: {
  /** 是否已暂停（保留断点） */
  paused: boolean;
  /** 是否已完成 */
  finished: boolean;
  /** 中断控制器（暂停时 abort 下载流） */
  aborter: AbortController | null;
} = { paused: false, finished: false, aborter: null };

/** 下载任务表：jobId -> 运行信息 */
interface DownloadJob {
  /** 子进程 */
  proc: ChildProcess;
  /** 目标页面地址（恢复下载时重建进程用） */
  url: string;
  /** 格式 ID（恢复下载时重建进程用；空串表示自动选最佳） */
  formatId: string;
  /** 是否已暂停（进程已终止，保留 .part 断点文件） */
  paused: boolean;
  /** 是否已结束（防重复推送） */
  finished: boolean;
}
const jobs = new Map<string, DownloadJob>();

// ==================== 路径 ====================

/**
 * 工具目录（userData/browser-tools）
 * @returns 绝对路径
 */
function toolsDir(): string {
  return path.join(app.getPath("userData"), "browser-tools");
}

/**
 * yt-dlp.exe 绝对路径
 * @returns 绝对路径
 */
function ytdlpPath(): string {
  return path.join(toolsDir(), "yt-dlp.exe");
}

/**
 * ffmpeg 解压根目录
 * @returns 绝对路径
 */
function ffmpegDir(): string {
  return path.join(toolsDir(), "ffmpeg");
}

/**
 * ffmpeg.exe 绝对路径（按官方 zip 内部目录结构）
 * @returns 绝对路径
 */
function ffmpegPath(): string {
  return path.join(ffmpegDir(), "ffmpeg-master-latest-win64-gpl", "bin", "ffmpeg.exe");
}

/**
 * yt-dlp 是否已安装（含体积校验：低于最小合法体积的文件视为未安装，
 * 避免历史下载中断留下的损坏 exe 被 PyInstaller 加载报错）
 * @returns true 表示存在且体积合法
 */
function isInstalled(): boolean {
  try {
    const st = fs.statSync(ytdlpPath());
    return st.isFile() && st.size >= MIN_YTDLP_SIZE;
  } catch {
    return false;
  }
}

/**
 * ffmpeg 是否已安装
 * @returns true 表示存在
 */
function isFfmpegInstalled(): boolean {
  return fs.existsSync(ffmpegPath());
}

// ==================== 进度推送 ====================

/**
 * 推送进度/状态到渲染端
 * @param payload 必填，进度负载
 */
function sendProgress(payload: Record<string, any>): void {
  try {
    win?.webContents.send(PROGRESS_CHANNEL, payload);
  } catch {
    // 窗口销毁时忽略
  }
}

// ==================== 文件下载 ====================

/**
 * 流式下载远程文件到本地（net.fetch，支持大文件/进度回调/断点续传/中止）
 * 完整性保障：下载结束后校验「已接收字节数 == content-length」，
 * 不一致（连接中断导致的截断）时抛错并删除残缺文件。
 * @param url 必填，远程地址
 * @param dest 必填，本地目标路径
 * @param onProgress 可选，进度回调 (received, total)，received 含断点基量
 * @param opts 可选，下载选项
 * @param opts.appendFrom 可选，断点续传基量（字节）：>0 时以追加模式写入并发送 Range 头
 * @param opts.signal 可选，中止信号：触发后正常返回已接收字节数（保留断点，不抛错）
 * @returns 已接收总字节数（含断点基量）；被中止时返回中断时的字节数
 * @throws 网络失败/HTTP 非 200/下载不完整时抛错
 */
async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (received: number, total: number) => void,
  opts?: { appendFrom?: number; signal?: AbortSignal }
): Promise<number> {
  const appendFrom = opts?.appendFrom || 0;
  const signal = opts?.signal;
  // 断点续传：携带 Range 头请求剩余部分
  const headers: Record<string, string> = {};
  if (appendFrom > 0) headers["Range"] = `bytes=${appendFrom}-`;
  const res = await net.fetch(url, { redirect: "follow", headers, signal });
  if (!res.ok || !res.body) {
    throw new Error(`下载失败：HTTP ${res.status}`);
  }
  // 服务端不支持 Range（返回 200 而非 206）或断点越界（416）：删除断点从头下载
  if (appendFrom > 0 && res.status !== 206) {
    await fs.promises.rm(dest, { force: true });
    return downloadFile(url, dest, onProgress, { signal });
  }
  const remaining = Number(res.headers.get("content-length")) || 0;
  const total = appendFrom + remaining;
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(dest, { flags: appendFrom > 0 ? "a" : "w" });
  const reader = res.body.getReader();
  let newly = 0;
  const closeOut = () => new Promise<void>((resolve) => out.close(() => resolve()));
  try {
    for (;;) {
      // 暂停请求：退出循环并保留断点（不抛错、不删文件）
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      newly += value.byteLength;
      out.write(Buffer.from(value));
      onProgress?.(appendFrom + newly, total);
    }
    const received = appendFrom + newly;
    await closeOut();
    if (signal?.aborted) {
      return received; // 暂停：返回断点位置
    }
    // 完整性校验：流提前结束（连接中断）会 received < total，此时文件为损坏残件
    if (total > 0 && received < total) {
      throw new Error(`下载不完整：已接收 ${received}/${total} 字节（连接中断）`);
    }
    return received;
  } catch (e) {
    await closeOut();
    // 暂停中断（read() 因 abort 拒绝）：保留断点文件，正常返回
    if (signal?.aborted) {
      return appendFrom + newly;
    }
    // 真实异常：残缺文件不保留，避免被误判为已安装
    await fs.promises.rm(dest, { force: true });
    throw e;
  }
}

/** 下载最大尝试次数（GitHub 直连在国内不稳定，自动重试） */
const MAX_DOWNLOAD_ATTEMPTS = 3;

/**
 * 执行引擎下载（含自动重试与断点续传；调用方负责 installing/paused 状态管理）
 * 断点文件为 yt-dlp.exe.part，下载完成且校验通过后重命名为正式 exe。
 * @throws 重试耗尽后仍失败抛错（暂停退出不抛错）
 */
async function installWithRetry(): Promise<void> {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      // 断点续传基量：断点文件现有体积
      let resumeFrom = 0;
      try {
        resumeFrom = (await fs.promises.stat(YT_DLP_PART)).size;
      } catch {
        resumeFrom = 0;
      }
      sendProgress({
        stage: "install",
        message: resumeFrom > 0 ? `正在续传 yt-dlp 引擎…（第 ${attempt}/${MAX_DOWNLOAD_ATTEMPTS} 轮）` : `正在下载 yt-dlp 引擎…（第 ${attempt}/${MAX_DOWNLOAD_ATTEMPTS} 轮）`,
      });
      const received = await downloadFile(
        YT_DLP_URL,
        YT_DLP_PART,
        (rec, total) => {
          sendProgress({
            stage: "install",
            percent: total ? Math.round((rec / total) * 100) : 0,
            received: rec,
            total,
            message: "正在下载 yt-dlp 引擎…",
          });
        },
        { appendFrom: resumeFrom, signal: engineDl.aborter?.signal }
      );
      // 下载后体积校验（downloadFile 已做长度比对，此处兜底防异常响应）
      if (received < MIN_YTDLP_SIZE) {
        throw new Error(`文件异常（${received} 字节，应为约 17MB）`);
      }
      // 校验通过：断点文件转正
      await fs.promises.rename(YT_DLP_PART, ytdlpPath());
      sendProgress({ stage: "install-done", message: "yt-dlp 引擎就绪" });
      return;
    } catch (e: any) {
      if (engineDl.aborter?.signal.aborted) {
        return; // 暂停退出：保留断点，不视为失败
      }
      lastErr = e;
      // 残缺文件不保留，重试（断点文件在 downloadFile 内部已清理）
      if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
        sendProgress({ stage: "install", message: "下载异常，正在重试…" });
      }
    }
  }
  throw lastErr ?? new Error("下载失败");
}

/**
 * 确保 yt-dlp.exe 就绪（缺失或损坏则自动下载，支持暂停/续传）
 * @throws 重试耗尽后仍失败抛错
 */
async function ensureYtDlp(): Promise<void> {
  if (isInstalled()) return;
  if (installing) throw new Error("yt-dlp 正在安装中，请稍候");
  installing = true;
  engineDl = { paused: false, finished: false, aborter: new AbortController() };
  try {
    await installWithRetry();
    engineDl.finished = true;
  } finally {
    installing = false;
    engineDl.paused = false;
  }
}

/**
 * 暂停引擎下载（中止网络流，保留 .part 断点文件，可续传）
 * @returns true 表示已触发暂停
 */
function pauseEngineDownload(): boolean {
  if (!installing || engineDl.finished || engineDl.paused) return false;
  engineDl.paused = true;
  engineDl.aborter?.abort();
  sendProgress({ stage: "install-paused", message: "引擎下载已暂停，可点击「继续」完成剩余部分" });
  return true;
}

/**
 * 恢复引擎下载（从 .part 断点续传剩余字节）
 * @returns true 表示已触发恢复
 */
function resumeEngineDownload(): boolean {
  if (!engineDl.paused || engineDl.finished || installing) return false;
  engineDl.paused = false;
  installing = true;
  engineDl.aborter = new AbortController();
  // 异步恢复（不阻塞 IPC 返回），进度/结果经推送告知渲染端
  (async () => {
    try {
      await installWithRetry();
      engineDl.finished = true;
    } catch (e: any) {
      sendProgress({ stage: "error", message: `引擎下载失败：${e?.message || e}` });
    } finally {
      installing = false;
      engineDl.paused = false;
    }
  })();
  return true;
}

/**
 * 确保 ffmpeg 就绪（缺失则自动下载 zip 并解压；并发调用共享同一 Promise）
 * @throws 下载/解压失败抛错
 */
function ensureFfmpeg(): Promise<void> {
  if (isFfmpegInstalled()) return Promise.resolve();
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegInstalling = true;
  ffmpegPromise = (async () => {
    try {
      const zipPath = path.join(toolsDir(), "ffmpeg.zip");
      sendProgress({ stage: "install", message: "正在下载 ffmpeg（DASH 合并需要，首次约 80MB）…" });
      await downloadFile(FFMPEG_URL, zipPath, (received, total) => {
        sendProgress({
          stage: "install",
          percent: total ? Math.round((received / total) * 100) : 0,
          received,
          total,
          message: "正在下载 ffmpeg…",
        });
      });
      // zip 体积校验（downloadFile 已做长度比对，此处兜底防异常响应）
      const zipStat = await fs.promises.stat(zipPath);
      if (zipStat.size < MIN_FFMPEG_ZIP_SIZE) {
        throw new Error(`ffmpeg 压缩包异常（${zipStat.size} 字节，应为约 80MB）`);
      }
      // PowerShell 解压（Windows 内置，无需额外依赖）
      sendProgress({ stage: "install", message: "正在解压 ffmpeg…" });
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(
          "powershell",
          ["-NoProfile", "-Command", `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${ffmpegDir()}" -Force`],
          { windowsHide: true }
        );
        proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`解压失败（exit ${code}）`))));
        proc.on("error", reject);
      });
      await fs.promises.rm(zipPath, { force: true });
      sendProgress({ stage: "install-done", message: "ffmpeg 就绪" });
    } finally {
      ffmpegInstalling = false;
      ffmpegPromise = null;
    }
  })();
  return ffmpegPromise;
}

// ==================== yt-dlp 进程封装 ====================

/**
 * 运行 yt-dlp 并收集 stdout（用于 -J 解析等一次性命令）
 * @param args 必填，命令行参数
 * @param timeoutMs 可选，超时（默认 PARSE_TIMEOUT）
 * @returns stdout 全文
 * @throws 进程失败/超时抛错（含 stderr 摘要）
 */
function runYtDlp(args: string[], timeoutMs: number = PARSE_TIMEOUT): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlpPath(), args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("解析超时"));
    }, timeoutMs);
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.split("\n").filter(Boolean).slice(-3).join(" ") || `yt-dlp 退出码 ${code}`));
      }
    });
  });
}

// ==================== 解析 ====================

/**
 * 解析结果格式条目（渲染端展示用）
 */
export interface YtDlpFormat {
  /** 格式 ID（传给 download 的 -f 参数） */
  formatId: string;
  /** 容器扩展名 */
  ext: string;
  /** 分辨率高度（纯音频为 null） */
  height: number | null;
  /** 帧率（可空） */
  fps: number | null;
  /** 文件大小（字节，未知 0） */
  size: number;
  /** 视频编码（none 表示纯音频） */
  vcodec: string;
  /** 音频编码（none 表示纯视频） */
  acodec: string;
  /** 格式说明（如 DASH 音频） */
  note: string;
  /** 直链（可空：某些格式需下载时二次解析） */
  url: string;
}

/**
 * 解析页面视频信息（标题 + 可用格式清单）
 * @param url 必填，页面地址（视频站页面或直链）
 * @returns { title, duration, webpageUrl, formats }
 * @throws 未安装/解析失败抛错
 */
async function parsePage(url: string): Promise<{ title: string; duration: number; webpageUrl: string; formats: YtDlpFormat[] }> {
  const stdout = await runYtDlp(["-J", "--no-warnings", "--no-playlist", url]);
  const info = JSON.parse(stdout);
  const formats: YtDlpFormat[] = (info.formats || [])
    .filter((f: any) => f.format_id && (f.url || f.protocol === "m3u8_native"))
    .map((f: any) => ({
      formatId: String(f.format_id),
      ext: String(f.ext || ""),
      height: typeof f.height === "number" ? f.height : null,
      fps: typeof f.fps === "number" ? f.fps : null,
      size: Number(f.filesize || f.filesize_approx || 0),
      vcodec: String(f.vcodec || "none"),
      acodec: String(f.acodec || "none"),
      note: String(f.format_note || ""),
      url: String(f.url || ""),
    }))
    // 去掉 storyboard（进度条预览图）等无效格式
    .filter((f: YtDlpFormat) => f.ext !== "mhtml");
  return {
    title: String(info.title || ""),
    duration: Number(info.duration || 0),
    webpageUrl: String(info.webpage_url || url),
    formats,
  };
}

// ==================== 下载 ====================

/**
 * 启动下载任务（后台运行，进度经 browser-ytdlp:progress 推送）
 * 暂停机制：终止 yt-dlp 进程但保留下载目录中的 .part 断点文件；
 * 恢复机制：以相同参数重启进程，yt-dlp 自动从断点续传。
 * @param url 必填，页面地址
 * @param formatId 可选，格式 ID；缺省 bestvideo*+bestaudio/best（需 ffmpeg 合并）
 * @returns jobId
 * @throws 未安装/ffmpeg 缺失抛错
 */
async function startDownload(url: string, formatId?: string): Promise<string> {
  if (!isInstalled()) throw new Error("yt-dlp 未安装");
  // DASH 合并需要 ffmpeg：后台自动获取（不阻塞任务启动，yt-dlp 会在合并前等待）
  if (!isFfmpegInstalled()) {
    ensureFfmpeg().catch((e) => sendProgress({ stage: "error", message: `ffmpeg 获取失败：${e.message}（分离格式可能无法合并）` }));
  }
  const jobId = `job_${Date.now()}`;
  const job: DownloadJob = { proc: null as any, url, formatId: formatId || "", paused: false, finished: false };
  jobs.set(jobId, job);
  spawnJobProcess(jobId, job);
  return jobId;
}

/**
 * 启动（或恢复）任务的 yt-dlp 子进程并挂载输出监听
 * @param jobId 必填，任务 ID
 * @param job 必填，任务信息
 */
function spawnJobProcess(jobId: string, job: DownloadJob): void {
  const outTemplate = path.join(app.getPath("downloads"), "%(title)s.%(ext)s");
  const args = ["--newline", "--no-playlist", "-o", outTemplate];
  if (isFfmpegInstalled()) {
    args.push("--ffmpeg-location", ffmpegDir());
  }
  args.push("-f", job.formatId ? `${job.formatId}/bestvideo*+bestaudio/best` : "bestvideo*+bestaudio/best");
  args.push(job.url);
  const proc = spawn(ytdlpPath(), args, { windowsHide: true });
  job.proc = proc;

  // 逐行解析进度：[download]  12.3% of 10.00MiB at 2.00MiB/s ETA 00:05
  let lineBuf = "";
  proc.stdout.on("data", (d) => {
    lineBuf += d.toString();
    const lines = lineBuf.split(/\r?\n/);
    lineBuf = lines.pop() || "";
    for (const line of lines) {
      const m = line.match(/\[download\]\s+([\d.]+)%/);
      if (m) {
        sendProgress({ jobId, stage: "download", percent: Math.round(Number(m[1])) });
      } else if (line.includes("[Merger]") || line.includes("[ExtractAudio]")) {
        sendProgress({ jobId, stage: "merge", message: "正在合并音视频…" });
      }
    }
  });
  proc.stderr.on("data", (d) => {
    const text = d.toString().trim();
    if (text) sendProgress({ jobId, stage: "log", message: text.slice(0, 200) });
  });
  proc.on("close", (code) => {
    // 暂停触发的进程退出：保留任务（.part 断点文件在下载目录），等待恢复
    if (job.paused) {
      sendProgress({ jobId, stage: "paused", message: "下载已暂停，可点击「继续」从断点恢复" });
      return;
    }
    job.finished = true;
    jobs.delete(jobId);
    sendProgress({
      jobId,
      stage: code === 0 ? "done" : "error",
      percent: code === 0 ? 100 : undefined,
      message: code === 0 ? "下载完成，文件已保存到系统「下载」文件夹" : `下载失败（exit ${code}）`,
    });
  });
  proc.on("error", (e) => {
    if (job.paused) return;
    job.finished = true;
    jobs.delete(jobId);
    sendProgress({ jobId, stage: "error", message: `下载失败：${e.message}` });
  });
}

/**
 * 暂停下载任务：终止 yt-dlp 进程，保留 .part 断点文件（任务留在任务表等待恢复）
 * @param jobId 必填，任务 ID
 */
function pauseDownload(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job || job.finished || job.paused) return;
  job.paused = true;
  try {
    job.proc.kill();
  } catch {
    // 进程已退出时忽略
  }
}

/**
 * 恢复下载任务：以原参数重启 yt-dlp 进程，自动从 .part 断点续传
 * @param jobId 必填，任务 ID
 */
function resumeDownload(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job || job.finished || !job.paused) return;
  job.paused = false;
  spawnJobProcess(jobId, job);
  sendProgress({ jobId, stage: "download", percent: 0, message: "正在从断点恢复下载…" });
}

/**
 * 取消下载任务（终止进程并移除任务；.part 断点文件留给 yt-dlp 下次复用）
 * @param jobId 必填，任务 ID
 */
function cancelDownload(jobId: string): void {
  const job = jobs.get(jobId);
  if (job && !job.finished) {
    job.finished = true;
    jobs.delete(jobId);
    try {
      job.proc.kill();
    } catch {
      // 进程已退出时忽略
    }
    sendProgress({ jobId, stage: "error", message: "已取消下载" });
  }
}

// ==================== 初始化 ====================

/**
 * 初始化 yt-dlp 模块（在 createWindow 中调用一次，注册 IPC）
 */
export function initBrowserYtDlp(): void {
  // 查询安装状态
  ipcMain.handle("browser-ytdlp:check", () => ({
    installed: isInstalled(),
    ffmpegInstalled: isFfmpegInstalled(),
    installing,
    ffmpegInstalling,
  }));

  // 安装 yt-dlp（渲染端按钮触发）
  ipcMain.handle("browser-ytdlp:install", async () => {
    try {
      await ensureYtDlp();
      return { success: true };
    } catch (e: any) {
      console.error("[browser-ytdlp] 安装失败:", e);
      sendProgress({ stage: "error", message: `yt-dlp 安装失败：${e?.message || e}` });
      return { success: false, error: String(e?.message || e) };
    }
  });

  // 解析页面格式清单（未安装引擎时不自动下载，返回 NOT_INSTALLED 由前端弹窗确认）
  ipcMain.handle("browser-ytdlp:parse", async (_e, args: { url?: string }) => {
    const url = args?.url || "";
    if (!url) return { success: false, error: "参数缺失" };
    if (!isInstalled()) return { success: false, code: "NOT_INSTALLED", error: "yt-dlp 引擎未安装" };
    try {
      const data = await parsePage(url);
      return { success: true, data };
    } catch (e: any) {
      console.error("[browser-ytdlp] 解析失败:", e);
      return { success: false, error: String(e?.message || e) };
    }
  });

  // 启动下载任务（未安装引擎时不自动下载，返回 NOT_INSTALLED 由前端弹窗确认）
  ipcMain.handle("browser-ytdlp:download", async (_e, args: { url?: string; formatId?: string }) => {
    const url = args?.url || "";
    if (!url) return { success: false, error: "参数缺失" };
    if (!isInstalled()) return { success: false, code: "NOT_INSTALLED", error: "yt-dlp 引擎未安装" };
    try {
      const jobId = await startDownload(url, args?.formatId);
      return { success: true, data: jobId };
    } catch (e: any) {
      console.error("[browser-ytdlp] 下载启动失败:", e);
      return { success: false, error: String(e?.message || e) };
    }
  });

  // 取消下载任务
  ipcMain.handle("browser-ytdlp:cancel", (_e, args: { jobId?: string }) => {
    if (args?.jobId) cancelDownload(args.jobId);
    return { success: true };
  });

  // 暂停引擎下载（保留 .part 断点）
  ipcMain.handle("browser-ytdlp:engine-pause", () => {
    return { success: pauseEngineDownload() };
  });

  // 恢复引擎下载（断点续传）
  ipcMain.handle("browser-ytdlp:engine-resume", () => {
    return { success: resumeEngineDownload() };
  });

  // 暂停视频下载任务（终止进程，保留 .part 断点文件）
  ipcMain.handle("browser-ytdlp:pause", (_e, args: { jobId?: string }) => {
    if (args?.jobId) pauseDownload(args.jobId);
    return { success: true };
  });

  // 恢复视频下载任务（重启进程，yt-dlp 自动断点续传）
  ipcMain.handle("browser-ytdlp:resume", (_e, args: { jobId?: string }) => {
    if (args?.jobId) resumeDownload(args.jobId);
    return { success: true };
  });
}

// 应用退出前清理子进程
app.on("will-quit", () => {
  for (const [, job] of jobs) {
    try {
      job.proc.kill();
    } catch {
      // 忽略
    }
  }
  jobs.clear();
});
