/**
 * 下载器数据访问层（渲染端，IPC 封装）
 * ------------------------------------------------------------------
 * 与主进程 downloadIpc.ts 的通道契约一一对应；
 * 统一返回 { success, data?, error? } 形态，调用方按需判错。
 */

/** 下载任务（渲染端视图结构，speed 为运行时字段） */
export interface DownloadTaskItem {
  /** 任务 ID */
  id: string;
  /** 资源地址 */
  url: string;
  /** 保存文件名 */
  filename: string;
  /** 保存路径（绝对） */
  savePath: string;
  /** 保存目录 */
  saveDir: string;
  /** 状态：waiting/downloading/paused/completed/failed */
  status: string;
  /** 总字节数（0 = 未知） */
  totalSize: number;
  /** 已接收字节 */
  receivedSize: number;
  /** 分类 */
  category: string;
  /** 实时速度（B/s） */
  speed: number;
  /** 是否支持断点续传 */
  acceptRanges: boolean;
  /** 并发连接数 */
  connections: number;
  /** 错误信息 */
  errorMsg: string;
  /** 创建时间 */
  createdAt: string;
  /** 完成时间 */
  completedAt: string;
}

/** 下载器配置（与主进程 DownloaderConfig 一致） */
export interface DownloaderConfig {
  /** 默认保存目录 */
  saveDir: string;
  /** 同时下载任务数上限 */
  maxConcurrent: number;
  /** 单任务并发连接数 */
  connectionsPerTask: number;
  /** 全局限速（B/s），0 = 不限 */
  maxSpeed: number;
  /** 是否接管内置浏览器下载 */
  takeOverBrowser: boolean;
  /** 是否开启剪贴板监视 */
  clipboardMonitor: boolean;
}

/** IPC 统一结果形态 */
interface IpcResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 通用 IPC 调用（统一 catch，失败返回 {success:false}）
 * @param channel 必填，通道名（download:*）
 * @param args 可选，参数对象
 * @returns 主进程返回的结果
 */
async function call<T = any>(channel: string, args?: any): Promise<IpcResult<T>> {
  try {
    return (await window.ipcRenderer.invoke(channel, args)) as IpcResult<T>;
  } catch (e: any) {
    console.error(`[downloader] IPC 调用失败 ${channel}:`, e);
    return { success: false, error: String(e?.message || e) };
  }
}

/**
 * 查询任务列表
 * @returns 任务数组（失败返回空数组）
 */
export async function fetchTasks(): Promise<DownloadTaskItem[]> {
  const res = await call<DownloadTaskItem[]>("download:list");
  return res.success ? res.data || [] : [];
}

/**
 * 新建下载任务
 * @param url 必填，资源地址
 * @param opts 可选，{ filename?, saveDir?, connections? }（connections=0 表示跟随设置）
 * @returns 成功返回 {success:true}；失败返回错误信息（探测失败等，含中文状态码映射）
 */
export async function createTask(
  url: string,
  opts: { filename?: string; saveDir?: string; connections?: number } = {}
): Promise<IpcResult> {
  return call("download:create", { url, ...opts });
}

/**
 * 弹出系统文件夹选择框（复用项目既有的 get-file-list 通道）
 * @returns 选中的目录绝对路径；取消选择返回空字符串
 */
export function selectFolder(): string {
  const res = window.ipcRenderer.sendSync("get-file-list", "select-dir") as string[] | undefined;
  return res?.[0] || "";
}

/**
 * 暂停任务
 * @param id 必填，任务 ID
 */
export function pauseTask(id: string): Promise<IpcResult> {
  return call("download:pause", { id });
}

/**
 * 恢复（继续）任务
 * @param id 必填，任务 ID
 */
export function resumeTask(id: string): Promise<IpcResult> {
  return call("download:resume", { id });
}

/**
 * 删除任务
 * @param id 必填，任务 ID
 * @param deleteFile 可选，是否同时删除已完成文件，默认 false
 */
export function removeTask(id: string, deleteFile = false): Promise<IpcResult> {
  return call("download:remove", { id, deleteFile });
}

/**
 * 打开已下载文件
 * @param id 必填，任务 ID
 */
export function openFile(id: string): Promise<IpcResult> {
  return call("download:open", { id });
}

/**
 * 在文件夹中显示文件
 * @param id 必填，任务 ID
 */
export function showInFolder(id: string): Promise<IpcResult> {
  return call("download:show-in-folder", { id });
}

/**
 * 读取下载器配置
 * @returns 配置对象（失败返回 null）
 */
export async function fetchConfig(): Promise<DownloaderConfig | null> {
  const res = await call<DownloaderConfig>("download:get-config");
  return res.success ? res.data || null : null;
}

/**
 * 保存下载器配置
 * @param partial 必填，要更新的配置项
 * @returns 保存后的完整配置
 */
export async function saveConfig(partial: Partial<DownloaderConfig>): Promise<DownloaderConfig | null> {
  const res = await call<DownloaderConfig>("download:set-config", { partial });
  return res.success ? res.data || null : null;
}
