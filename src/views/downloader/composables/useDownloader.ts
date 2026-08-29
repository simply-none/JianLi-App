/**
 * 下载器状态管理（渲染端，模块级单例 composable）
 * ------------------------------------------------------------------
 * - tasks：任务列表（由主进程 download:updated 全量推送驱动，800ms 节流）；
 * - config：下载器配置；
 * - totalSpeed：所有下载中任务的速度之和；
 * - onClipboardDetected：注册「剪贴板发现下载链接」回调（下载器页面弹新建窗）。
 * 首次 useDownloader() 时自动订阅推送并拉取一次列表/配置。
 */
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchTasks,
  fetchConfig,
  saveConfig as apiSaveConfig,
  createTask as apiCreateTask,
  pauseTask as apiPause,
  resumeTask as apiResume,
  removeTask as apiRemove,
  openFile as apiOpen,
  showInFolder as apiShowInFolder,
  type DownloadTaskItem,
  type DownloaderConfig,
} from "../api/downloaderApi";

/** 任务列表（响应式） */
const tasks = ref<DownloadTaskItem[]>([]);
/** 配置（null = 未加载） */
const config = ref<DownloaderConfig | null>(null);
/** 是否已初始化订阅 */
let initialized = false;
/** 剪贴板回调集合 */
const clipboardHandlers = new Set<(url: string) => void>();
/** 列表加载中标志（防并发重复拉取） */
let loadingList = false;

/**
 * 模块初始化：订阅主进程推送 + 拉取初始数据（只执行一次）
 * @returns void
 */
function init(): void {
  if (initialized) return;
  initialized = true;
  // 任务列表全量推送
  window.ipcRenderer.on("download:updated", (_e: any, list: DownloadTaskItem[]) => {
    tasks.value = Array.isArray(list) ? list : [];
  });
  // 剪贴板发现下载链接
  window.ipcRenderer.on("download:clipboard-detected", (_e: any, payload: { url?: string }) => {
    if (payload?.url) clipboardHandlers.forEach((h) => h(payload.url!));
  });
  refreshTasks();
  refreshConfig();
}

/**
 * 手动刷新任务列表
 * @returns Promise，刷新完成
 */
async function refreshTasks(): Promise<void> {
  if (loadingList) return;
  loadingList = true;
  try {
    tasks.value = await fetchTasks();
  } finally {
    loadingList = false;
  }
}

/**
 * 刷新配置
 * @returns Promise，刷新完成
 */
async function refreshConfig(): Promise<void> {
  config.value = await fetchConfig();
}

/** 总速度（所有下载中任务之和） */
const totalSpeed = computed(() =>
  tasks.value.filter((t) => t.status === "downloading").reduce((s, t) => s + (t.speed || 0), 0)
);

/** 下载中任务数 */
const activeCount = computed(() => tasks.value.filter((t) => t.status === "downloading").length);

/**
 * 新建任务（主进程探测失败时提示错误）
 * @param url 必填，资源地址
 * @param saveDir 可选，保存目录
 * @returns 是否创建成功
 */
async function createTask(url: string, saveDir?: string): Promise<boolean> {
  const res = await apiCreateTask(url, { saveDir });
  if (!res.success) {
    ElMessage.error(`创建下载失败：${res.error || "未知错误"}`);
    return false;
  }
  ElMessage.success("任务已添加");
  return true;
}

/**
 * 暂停任务（失败时提示）
 * @param id 必填，任务 ID
 */
async function pause(id: string): Promise<void> {
  const res = await apiPause(id);
  if (!res.success) ElMessage.warning(res.error || "暂停失败");
}

/**
 * 继续/重试任务
 * @param id 必填，任务 ID
 */
async function resume(id: string): Promise<void> {
  const res = await apiResume(id);
  if (!res.success) ElMessage.warning(res.error || "继续失败");
}

/**
 * 删除任务（可选删除文件）
 * @param id 必填，任务 ID
 * @param deleteFile 可选，是否删除已完成文件
 */
async function remove(id: string, deleteFile = false): Promise<void> {
  const res = await apiRemove(id, deleteFile);
  if (!res.success) ElMessage.warning(res.error || "删除失败");
  // 立刻刷新，不等下一次推送
  refreshTasks();
}

/**
 * 打开文件 / 在文件夹中显示（统一错误提示）
 * @param id 必填，任务 ID
 * @param mode 必填，'open' 或 'folder'
 */
async function openOrShow(id: string, mode: "open" | "folder"): Promise<void> {
  const res = mode === "open" ? await apiOpen(id) : await apiShowInFolder(id);
  if (!res.success) ElMessage.error(res.error || "操作失败");
}

/**
 * 保存配置（主进程持久化 + 本地刷新）
 * @param partial 必填，配置项
 * @returns 是否保存成功
 */
async function saveConfig(partial: Partial<DownloaderConfig>): Promise<boolean> {
  const next = await apiSaveConfig(partial);
  if (next) {
    config.value = next;
    return true;
  }
  ElMessage.error("保存配置失败");
  return false;
}

/**
 * 注册剪贴板下载链接回调
 * @param fn 必填，回调（参数为链接）
 * @returns 取消注册函数
 */
function onClipboardDetected(fn: (url: string) => void): () => void {
  clipboardHandlers.add(fn);
  return () => clipboardHandlers.delete(fn);
}

/**
 * 下载器 composable 入口（首次调用时初始化订阅）
 * @returns 状态与操作集合
 */
export function useDownloader() {
  init();
  // 组件卸载不影响模块级订阅（下载器页面关闭后主进程仍继续下载并推送）
  return {
    tasks,
    config,
    totalSpeed,
    activeCount,
    refreshTasks,
    refreshConfig,
    createTask,
    pause,
    resume,
    remove,
    openOrShow,
    saveConfig,
    onClipboardDetected,
  };
}
