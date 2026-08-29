/**
 * 内置浏览器 - 资源嗅探（主进程）
 * ------------------------------------------------------------------
 * 职责：在 `persist:browser` 会话上挂钩 webRequest.onHeadersReceived，
 * 持续识别网页加载的媒体/图片资源，按 webContentsId 维护缓冲，
 * 嗅探开启的标签实时推送给渲染端。
 *
 * 设计要点（重要，勿回退）：
 * - **常驻录制**：不依赖「嗅探是否开启」。所有请求都做轻量媒体检测
 *   （content-type/扩展名字符串判断，开销极小），命中即写入对应
 *   webContentsId 的环形缓冲（上限 300，超出淘汰最旧）。
 *   这样「先打开网页、后开嗅探抽屉」也能回填已加载的资源——
 *   对齐主流浏览器（360/QQ）嗅探器的体验；
 * - **按需推送**：仅对「正在嗅探的 webContentsId」推送渲染端（零常驻开销的是推送，不是检测）；
 * - **标签关联**：请求 details.webContentsId ↔ 渲染端 webview.getWebContentsId() 映射；
 *   若媒体请求缺失 webContentsId 会打诊断日志（正常不应发生，Electron 36 已确认支持）；
 * - **类型识别**：content-type 响应头优先，URL 扩展名兜底（详见 detectResourceType）；
 * - **去重与清理**：按 url+类型 去重；webContents 销毁时释放其缓冲防内存泄漏。
 *
 * IPC 通道：
 * - browser-sniffer:start  {tabId, webContentsId}  开始嗅探（返回该 webContentsId 已录制的缓冲，实现回填）
 * - browser-sniffer:stop   {tabId}                 停止推送（缓冲保留，重开抽屉可恢复）
 * - browser-sniffer:clear  {tabId}                 清空指定标签的嗅探结果
 * - browser-sniffer:export {items}                 导出链接清单 TXT 到系统「下载」文件夹
 */
import { app, ipcMain, session } from "electron";
import path from "node:path";
import fs from "node:fs";
import { win } from "./mainWindow.ts";

/** 资源类型 */
export type SniffType = "video" | "audio" | "image";

/** 嗅探到的资源条目（推送给渲染端的结构） */
export interface SniffItem {
  /** 资源地址 */
  url: string;
  /** 资源类型 */
  type: SniffType;
  /** MIME 类型（无法识别时为空串） */
  mime: string;
  /** 内容长度（字节，未知为 0） */
  size: number;
  /** 是否流媒体（m3u8/mpd 等索引清单，仅可复制链接） */
  stream: boolean;
  /** 首次发现时间戳（ms） */
  foundAt: number;
}

/** 媒体资源缓冲：webContentsId -> items（常驻录制，与是否嗅探无关） */
const mediaBuffers = new Map<number, SniffItem[]>();
/** 正在嗅探（推送中）的集合：webContentsId -> tabId */
const sniffingTargets = new Map<number, string>();

/** 单 webContents 结果上限 */
const MAX_ITEMS = 300;

/** 渲染端推送通道 */
const UPDATED_CHANNEL = "browser-sniffer:updated";

/** 视频扩展名 */
const VIDEO_EXT = /\.(mp4|webm|mkv|flv|avi|mov|mpd|m3u8)(\?|#|$)/i;
/** 音频扩展名 */
const AUDIO_EXT = /\.(mp3|aac|wav|ogg|m4a|flac|opus)(\?|#|$)/i;
/** 图片扩展名 */
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|#|$)/i;
/** 流媒体清单扩展名 */
const STREAM_EXT = /\.(m3u8|mpd)(\?|#|$)/i;

/** 诊断日志去重：缺失 webContentsId 的提示只打一次 */
let warnedNoWebContentsId = false;

/**
 * 生成去重键
 * @param type 必填，资源类型
 * @param url 必填，资源地址
 * @returns 去重键
 */
function dedupeKey(type: SniffType, url: string): string {
  return `${type}|${url}`;
}

/**
 * 判断 MIME 是否属于指定资源类型（前缀匹配，如 video/mp4）
 * @param mime 必填，MIME 字符串
 * @param prefix 必填，类型前缀
 * @returns true 表示匹配
 */
function mimeIs(mime: string, prefix: SniffType): boolean {
  if (!mime) return false;
  return mime.toLowerCase().startsWith(prefix === "video" ? "video/" : prefix === "audio" ? "audio/" : "image/");
}

/**
 * 从响应头中提取 content-type 与 content-length
 * @param headers 必填，响应头对象（值为字符串数组）
 * @returns { mime, size }
 */
function pickHeaders(headers: Record<string, string[]> | undefined): { mime: string; size: number } {
  if (!headers) return { mime: "", size: 0 };
  const mime = (headers["content-type"] || headers["Content-Type"] || [""])[0].split(";")[0].trim();
  const lenStr = (headers["content-length"] || headers["Content-Length"] || [""])[0];
  const size = Number(lenStr) || 0;
  return { mime, size };
}

/**
 * 识别资源类型（content-type 优先，扩展名兜底）
 * @param url 必填，请求地址
 * @param mime 必填，content-type（可为空）
 * @returns { type, stream }；不属于目标类型时 type 为 null
 */
function detectResourceType(url: string, mime: string): { type: SniffType | null; stream: boolean } {
  const clean = url.split("#")[0];
  // 1) content-type 优先
  if (mimeIs(mime, "video")) return { type: "video", stream: STREAM_EXT.test(clean) };
  if (mimeIs(mime, "audio")) return { type: "audio", stream: false };
  if (mimeIs(mime, "image")) return { type: "image", stream: false };
  // 2) 扩展名兜底（m3u8 的响应常是 application/octet-stream / mpegurl）
  if (STREAM_EXT.test(clean)) return { type: "video", stream: true };
  if (VIDEO_EXT.test(clean)) return { type: "video", stream: false };
  if (AUDIO_EXT.test(clean)) return { type: "audio", stream: false };
  if (IMAGE_EXT.test(clean)) return { type: "image", stream: false };
  return { type: null, stream: false };
}

/**
 * 处理单个响应：识别媒体、写入常驻缓冲、命中嗅探目标则推送
 * @param details 必填，onHeadersReceived 详情
 */
function handleResponse(details: any) {
  const url: string = details?.url || "";
  // 过滤非 http(s)
  if (!/^https?:\/\//i.test(url)) return;

  const { mime, size } = pickHeaders(details?.responseHeaders);
  const { type, stream } = detectResourceType(url, mime);
  if (!type) return;

  const webContentsId: number | undefined = details.webContentsId;
  if (webContentsId === undefined) {
    // 诊断打点：正常不应发生；若出现说明该版本/场景 webview 关联异常
    if (!warnedNoWebContentsId) {
      warnedNoWebContentsId = true;
      console.warn("[browser-sniffer] 媒体请求缺失 webContentsId，无法关联标签：", url);
    }
    return;
  }

  let items = mediaBuffers.get(webContentsId);
  if (!items) {
    items = [];
    mediaBuffers.set(webContentsId, items);
  }
  const key = dedupeKey(type, url);
  if (items.some((it) => dedupeKey(it.type, it.url) === key)) return;

  // 容量控制：超出上限淘汰最旧
  if (items.length >= MAX_ITEMS) {
    items.shift();
  }
  const item: SniffItem = { url, type, mime, size, stream, foundAt: Date.now() };
  items.push(item);

  // 仅对正在嗅探的标签推送（小列表全量）
  if (sniffingTargets.has(webContentsId)) {
    pushUpdate(sniffingTargets.get(webContentsId)!, items);
  }
}

/**
 * 把指定标签的嗅探结果推送给渲染端
 * @param tabId 必填，标签 ID
 * @param items 必填，结果列表
 */
function pushUpdate(tabId: string, items: SniffItem[]) {
  try {
    win?.webContents.send(UPDATED_CHANNEL, { tabId, items });
  } catch (e) {
    // 窗口销毁等场景忽略
    console.error("[browser-sniffer] 推送失败:", e);
  }
}

/**
 * 初始化资源嗅探模块（在 createWindow 中调用一次）
 */
export function initBrowserSniffer() {
  const s = session.fromPartition("persist:browser");
  // content-type 必须在响应头阶段读取，onHeadersReceived 是最可靠的挂点
  s.webRequest.onHeadersReceived((details, callback) => {
    handleResponse(details);
    // 不修改请求，直接放行
    callback({});
  });

  // webContents 销毁时释放其缓冲，防内存泄漏
  app.on("web-contents-created", (_event, contents) => {
    contents.once("destroyed", () => {
      mediaBuffers.delete(contents.id);
      sniffingTargets.delete(contents.id);
    });
  });

  // ---- IPC ----
  // 开始嗅探：登记 webContentsId -> tabId，并回填该 webContents 已录制的缓冲
  ipcMain.handle("browser-sniffer:start", (_e, args: { tabId?: string; webContentsId?: number }) => {
    const { tabId, webContentsId } = args || {};
    if (!tabId || webContentsId === undefined) return { success: false, error: "参数缺失" };
    sniffingTargets.set(webContentsId, tabId);
    // 回填：返回启动前已录制的资源（核心：解决「先开网页后开嗅探」看不到历史资源的问题）
    return { success: true, data: mediaBuffers.get(webContentsId) || [] };
  });

  // 停止嗅探：解除该标签所有登记（缓冲保留，重开抽屉可恢复）
  ipcMain.handle("browser-sniffer:stop", (_e, args: { tabId?: string }) => {
    const tabId = args?.tabId || "";
    for (const [wcId, tid] of [...sniffingTargets.entries()]) {
      if (tid === tabId) sniffingTargets.delete(wcId);
    }
    return { success: true };
  });

  // 清空指定标签的嗅探结果（按 tabId 反查所有登记的 webContentsId）
  ipcMain.handle("browser-sniffer:clear", (_e, args: { tabId?: string }) => {
    const tabId = args?.tabId || "";
    for (const [wcId, tid] of [...sniffingTargets.entries()]) {
      if (tid === tabId) {
        mediaBuffers.set(wcId, []);
        pushUpdate(tabId, []);
      }
    }
    return { success: true, data: [] };
  });

  // 导出资源链接清单（TXT，一行一个 URL，写入系统「下载」文件夹）
  ipcMain.handle("browser-sniffer:export", (_e, args: { items?: SniffItem[] }) => {
    const items = Array.isArray(args?.items) ? args.items : [];
    if (items.length === 0) return { success: false, error: "没有可导出的资源" };
    try {
      const time = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      const stamp = `${time.getFullYear()}${p(time.getMonth() + 1)}${p(time.getDate())}_${p(time.getHours())}${p(time.getMinutes())}${p(time.getSeconds())}`;
      const dir = app.getPath("downloads");
      // 重名自动加 (n) 序号
      let filePath = path.join(dir, `嗅探资源_${stamp}.txt`);
      let n = 1;
      while (fs.existsSync(filePath)) {
        filePath = path.join(dir, `嗅探资源_${stamp}(${n}).txt`);
        n += 1;
      }
      // 纯 URL 行（便于外部下载工具直接读取），元数据放注释头
      const lines = [
        `# 内置浏览器资源嗅探导出 ${time.getFullYear()}-${p(time.getMonth() + 1)}-${p(time.getDate())} ${p(time.getHours())}:${p(time.getMinutes())}:${p(time.getSeconds())}`,
        `# 共 ${items.length} 项；流媒体(m3u8/mpd)请使用专门下载工具处理`,
        ...items.map((it) => it.url),
      ];
      fs.writeFileSync(filePath, lines.join("\r\n"), "utf-8");
      return { success: true, data: filePath };
    } catch (err) {
      console.error("[browser-sniffer] 导出失败:", err);
      return { success: false, error: String(err) };
    }
  });
}

// 应用退出前清理（防御性，避免引用悬挂）
app.on("will-quit", () => {
  sniffingTargets.clear();
  mediaBuffers.clear();
});
