/**
 * 内置浏览器 - yt-dlp 解析/下载（渲染端 composable）
 * ------------------------------------------------------------------
 * 职责：封装主进程 browser-ytdlp:* IPC 通道，提供：
 * - checkYtDlp：查询安装状态（yt-dlp / ffmpeg）；
 * - installYtDlp：触发安装（进度经 onYtDlpProgress 订阅）；
 * - parseVideo：解析页面格式清单；
 * - downloadVideo：启动下载任务；
 * - cancelDownload：取消任务；
 * - onYtDlpProgress：订阅主进程进度推送（安装/下载/合并/完成/失败）。
 */
import { onMounted, onUnmounted } from "vue";

/** 进度推送通道 */
const PROGRESS_CHANNEL = "browser-ytdlp:progress";

/** 进度推送负载 */
export interface YtDlpProgress {
  /** 任务 ID（安装阶段为空） */
  jobId?: string;
  /** 阶段：install/install-paused/install-done/download/merge/paused/done/error/log */
  stage: string;
  /** 百分比（0-100，可空） */
  percent?: number;
  /** 已接收字节（安装时可空） */
  received?: number;
  /** 总字节（安装时可空） */
  total?: number;
  /** 说明文本 */
  message?: string;
}

/** 解析结果 */
export interface YtDlpInfo {
  /** 页面标题 */
  title: string;
  /** 时长（秒，未知 0） */
  duration: number;
  /** 页面地址 */
  webpageUrl: string;
  /** 格式清单 */
  formats: YtDlpFormatItem[];
}

/** 格式条目 */
export interface YtDlpFormatItem {
  /** 格式 ID（下载用） */
  formatId: string;
  /** 扩展名 */
  ext: string;
  /** 分辨率高度（纯音频 null） */
  height: number | null;
  /** 帧率 */
  fps: number | null;
  /** 文件大小（字节，未知 0） */
  size: number;
  /** 视频编码 */
  vcodec: string;
  /** 音频编码 */
  acodec: string;
  /** 格式说明 */
  note: string;
  /** 直链 */
  url: string;
}

/**
 * 统一 IPC 调用
 */
function invoke<T = any>(channel: string, args?: any): Promise<T> {
  return (window as any).ipcRenderer.invoke(channel, args) as Promise<T>;
}

/**
 * 查询安装状态
 * @returns { installed, ffmpegInstalled, installing, ffmpegInstalling }
 */
export async function checkYtDlp(): Promise<{ installed: boolean; ffmpegInstalled: boolean; installing: boolean; ffmpegInstalling: boolean }> {
  try {
    const res = await invoke("browser-ytdlp:check");
    return res || { installed: false, ffmpegInstalled: false, installing: false, ffmpegInstalling: false };
  } catch {
    // 主进程通道未注册（未重启应用）
    return { installed: false, ffmpegInstalled: false, installing: false, ffmpegInstalling: false };
  }
}

/**
 * 安装 yt-dlp（自动从 GitHub 下载）
 * @returns 是否成功
 */
export async function installYtDlp(): Promise<boolean> {
  try {
    const res = await invoke<{ success: boolean; error?: string }>("browser-ytdlp:install");
    return !!res?.success;
  } catch (e) {
    console.error("[browser-ytdlp] 安装失败（主进程通道未注册？需重启应用）:", e);
    return false;
  }
}

/**
 * 解析页面视频格式清单
 * @param url 必填，页面地址
 * @returns 解析结果；失败返回 null
 */
export async function parseVideo(url: string): Promise<YtDlpInfo | null> {
  try {
    const res = await invoke<{ success: boolean; data?: YtDlpInfo; error?: string }>("browser-ytdlp:parse", { url });
    return res?.success && res.data ? res.data : null;
  } catch (e) {
    console.error("[browser-ytdlp] 解析失败:", e);
    return null;
  }
}

/**
 * 启动下载任务
 * @param url 必填，页面地址
 * @param formatId 可选，格式 ID；缺省自动选最佳
 * @returns jobId；失败返回 null
 */
export async function downloadVideo(url: string, formatId?: string): Promise<string | null> {
  try {
    const res = await invoke<{ success: boolean; data?: string; error?: string }>("browser-ytdlp:download", { url, formatId });
    return res?.success && res.data ? res.data : null;
  } catch (e) {
    console.error("[browser-ytdlp] 下载失败:", e);
    return null;
  }
}

/**
 * 取消下载任务
 * @param jobId 必填，任务 ID
 */
export async function cancelDownload(jobId: string): Promise<void> {
  await invoke("browser-ytdlp:cancel", { jobId }).catch(() => {});
}

/**
 * 暂停引擎下载（保留 .part 断点，可续传）
 * @returns 是否已触发暂停
 */
export async function pauseEngineDownload(): Promise<boolean> {
  try {
    const res = await invoke<{ success: boolean }>("browser-ytdlp:engine-pause");
    return !!res?.success;
  } catch {
    return false;
  }
}

/**
 * 恢复引擎下载（HTTP Range 断点续传）
 * @returns 是否已触发恢复
 */
export async function resumeEngineDownload(): Promise<boolean> {
  try {
    const res = await invoke<{ success: boolean }>("browser-ytdlp:engine-resume");
    return !!res?.success;
  } catch {
    return false;
  }
}

/**
 * 暂停视频下载任务（终止 yt-dlp 进程，保留 .part 断点文件）
 * @param jobId 必填，任务 ID
 */
export async function pauseDownload(jobId: string): Promise<void> {
  await invoke("browser-ytdlp:pause", { jobId }).catch(() => {});
}

/**
 * 恢复视频下载任务（重启 yt-dlp 进程，自动从断点续传）
 * @param jobId 必填，任务 ID
 */
export async function resumeDownload(jobId: string): Promise<void> {
  await invoke("browser-ytdlp:resume", { jobId }).catch(() => {});
}

/**
 * 订阅 yt-dlp 进度推送（组件挂载期生效，卸载自动解除）
 * @param handler 必填，进度回调
 */
export function useYtDlpProgress(handler: (p: YtDlpProgress) => void): void {
  const onUpdate = (_event: any, payload: YtDlpProgress) => handler(payload);
  onMounted(() => {
    (window as any).ipcRenderer.on(PROGRESS_CHANNEL, onUpdate);
  });
  onUnmounted(() => {
    (window as any).ipcRenderer.off(PROGRESS_CHANNEL, onUpdate);
  });
}
