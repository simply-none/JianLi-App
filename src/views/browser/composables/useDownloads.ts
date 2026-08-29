/**
 * 内置浏览器 - 下载状态（模块级单例 composable）
 * ------------------------------------------------------------------
 * 从主进程拉取下载列表，并监听主进程推送的 browser-download:updated
 * 事件实时刷新进度。主进程负责拦截 webview 会话的 will-download 事件。
 */
import { onMounted, onUnmounted, ref } from "vue";
import { toPlain } from "@/utils/common";

/** 下载记录（与主进程 DownloadRecord 字段一致） */
export interface DownloadRecord {
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
  /** 状态：progressing 下载中 / completed 已完成 / cancelled 已取消 / interrupted 已中断 */
  state: "progressing" | "completed" | "cancelled" | "interrupted";
  /** 开始时间戳（ms） */
  startTime: number;
  /** 结束时间戳（ms），进行中为 undefined */
  endTime?: number;
}

/** 下载列表 */
const downloads = ref<DownloadRecord[]>([]);

/** 主进程推送事件通道名 */
const UPDATED_CHANNEL = "browser-download:updated";

/**
 * 从主进程拉取下载列表
 */
export async function fetchDownloads(): Promise<void> {
  try {
    const res = await (window as any).ipcRenderer.invoke("browser-download:list");
    if (res?.success && Array.isArray(res.data)) {
      downloads.value = res.data;
    }
  } catch (e) {
    console.error("[browser] 获取下载列表失败:", e);
  }
}

/**
 * 取消指定下载
 * @param id 必填，下载 ID
 */
export async function cancelDownload(id: string): Promise<void> {
  await (window as any).ipcRenderer.invoke("browser-download:cancel", { id }).catch(() => {});
}

/**
 * 打开已下载的文件
 * @param id 必填，下载 ID
 */
export async function openDownload(id: string): Promise<void> {
  await (window as any).ipcRenderer.invoke("browser-download:open", { id }).catch(() => {});
}

/**
 * 在文件夹中显示已下载文件
 * @param id 必填，下载 ID
 */
export async function showDownloadInFolder(id: string): Promise<void> {
  await (window as any).ipcRenderer.invoke("browser-download:show-in-folder", { id }).catch(() => {});
}

/** 清除已完成/已取消/已中断的下载记录 */
export async function clearFinishedDownloads(): Promise<void> {
  await (window as any).ipcRenderer.invoke("browser-download:clear").catch(() => {});
  downloads.value = downloads.value.filter((d) => d.state === "progressing");
}

/**
 * 下载管理（组件入口；负责挂载期的推送订阅与初始拉取）
 * 返回状态与全部动作函数。
 */
export function useDownloads() {
  // 主进程推送监听器（挂载期注册，卸载期移除）
  const onUpdate = (_event: any, list: DownloadRecord[]) => {
    if (Array.isArray(list)) {
      downloads.value = toPlain(list) as DownloadRecord[];
    }
  };

  onMounted(async () => {
    (window as any).ipcRenderer.on(UPDATED_CHANNEL, onUpdate);
    await fetchDownloads();
  });

  onUnmounted(() => {
    (window as any).ipcRenderer.off(UPDATED_CHANNEL, onUpdate);
  });

  return {
    downloads,
    fetchDownloads,
    cancelDownload,
    openDownload,
    showDownloadInFolder,
    clearFinishedDownloads,
  };
}

/**
 * 字节数转可读文本
 * @param bytes 必填，字节数
 * @returns 如 "1.2 MB"
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * 下载状态转中文标签
 * @param state 必填，下载状态
 * @returns 中文描述
 */
export function downloadStateLabel(state: DownloadRecord["state"]): string {
  const map: Record<DownloadRecord["state"], string> = {
    progressing: "下载中",
    completed: "已完成",
    cancelled: "已取消",
    interrupted: "已中断",
  };
  return map[state] ?? state;
}
