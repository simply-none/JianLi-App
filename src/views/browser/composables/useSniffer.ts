/**
 * 内置浏览器 - 资源嗅探状态（模块级单例 composable）
 * ------------------------------------------------------------------
 * 职责：管理「按标签」的嗅探开关与结果缓存，订阅主进程
 * browser-sniffer:updated 推送实时刷新列表。
 * 生命周期：资源抽屉打开时 startSniffing（携带 webview 的 webContentsId），
 * 关闭/切换标签时 stopSniffing，避免常驻开销。
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { getWebview } from "./useWebviewBridge";

/** 嗅探资源条目（与主进程 SniffItem 字段一致） */
export interface SniffItem {
  /** 资源地址 */
  url: string;
  /** 资源类型：video / audio / image */
  type: "video" | "audio" | "image";
  /** MIME 类型（无法识别为空串） */
  mime: string;
  /** 内容长度（字节，未知为 0） */
  size: number;
  /** 是否流媒体（m3u8/mpd，仅可复制链接） */
  stream: boolean;
  /** 首次发现时间戳（ms） */
  foundAt: number;
}

/** 主进程推送通道 */
const UPDATED_CHANNEL = "browser-sniffer:updated";

/** 当前正在嗅探的标签 ID（空串表示未嗅探） */
const sniffingTabId = ref("");

/** 当前嗅探结果列表 */
const items = ref<SniffItem[]>([]);

/** 是否嗅探中 */
const isSniffing = computed(() => !!sniffingTabId.value);

/**
 * 统一 IPC 调用
 */
function invoke<T = any>(channel: string, args?: any): Promise<T> {
  return (window as any).ipcRenderer.invoke(channel, args) as Promise<T>;
}

/**
 * 开始嗅探指定标签（登记 webContentsId 映射，带回已录制缓冲实现回填）
 * @param tabId 必填，标签 ID
 * @returns 是否成功启动（false：webview 未就绪或主进程服务未注册，如未重启应用）
 */
export async function startSniffing(tabId: string): Promise<boolean> {
  if (!tabId) return false;
  // 若已在嗅探其他标签，先停掉
  if (sniffingTabId.value && sniffingTabId.value !== tabId) {
    await stopSniffing();
  }
  const wv = getWebview(tabId);
  let webContentsId: number | undefined;
  try {
    webContentsId = wv?.getWebContentsId?.();
  } catch {
    webContentsId = undefined;
  }
  if (!webContentsId) return false;
  try {
    const res = await invoke<{ success: boolean; data?: SniffItem[] }>("browser-sniffer:start", { tabId, webContentsId });
    if (res?.success) {
      sniffingTabId.value = tabId;
      items.value = Array.isArray(res.data) ? res.data : [];
      return true;
    }
    return false;
  } catch (e) {
    // IPC 通道不存在：主进程未注册（通常是改了主进程代码后未重启应用）
    console.error("[browser-sniffer] 启动失败（主进程通道未注册？需重启应用）:", e);
    return false;
  }
}

/**
 * 停止嗅探（解除登记，保留主进程缓存以便再次打开恢复）
 */
export async function stopSniffing(): Promise<void> {
  const tabId = sniffingTabId.value;
  if (tabId) {
    await invoke("browser-sniffer:stop", { tabId }).catch(() => {});
  }
  sniffingTabId.value = "";
  items.value = [];
}

/**
 * 清空指定标签的嗅探结果（主进程 + 本地）
 * @param tabId 必填，标签 ID
 */
export async function clearSniffItems(tabId: string): Promise<void> {
  await invoke("browser-sniffer:clear", { tabId }).catch(() => {});
  if (tabId === sniffingTabId.value) {
    items.value = [];
  }
}

/**
 * 导出资源链接清单（TXT，写入系统「下载」文件夹，一行一个 URL）
 * @param items 必填，要导出的资源列表
 * @returns 导出文件绝对路径；失败返回 null
 */
export async function exportSniffItems(items: SniffItem[]): Promise<string | null> {
  if (!items.length) return null;
  try {
    const res = await invoke<{ success: boolean; data?: string; error?: string }>("browser-sniffer:export", { items });
    return res?.success && res.data ? res.data : null;
  } catch (e) {
    console.error("[browser-sniffer] 导出失败（主进程通道未注册？需重启应用）:", e);
    return null;
  }
}

/**
 * 资源嗅探（组件入口；负责挂载期的推送订阅）
 */
export function useSniffer() {
  const onUpdate = (_event: any, payload: { tabId: string; items: SniffItem[] }) => {
    if (payload?.tabId === sniffingTabId.value && Array.isArray(payload.items)) {
      items.value = payload.items;
    }
  };

  onMounted(() => {
    (window as any).ipcRenderer.on(UPDATED_CHANNEL, onUpdate);
  });

  onUnmounted(() => {
    (window as any).ipcRenderer.off(UPDATED_CHANNEL, onUpdate);
    // 组件卸载兜底停止嗅探
    if (sniffingTabId.value) {
      invoke("browser-sniffer:stop", { tabId: sniffingTabId.value }).catch(() => {});
      sniffingTabId.value = "";
      items.value = [];
    }
  });

  return { sniffingTabId, items, isSniffing, startSniffing, stopSniffing, clearSniffItems };
}
