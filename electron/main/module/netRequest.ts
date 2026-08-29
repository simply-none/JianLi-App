/**
 * 网络请求工作台 - 主进程模块
 * ------------------------------------------------------------------
 * 为渲染端「网络请求」页面（Postman 风格）提供系统级能力（渲染端禁止直接
 * 发起跨域请求/操作系统资源，一切走 IPC）：
 *
 * 1. net-request:send        HTTP 请求（axios，返回完整元数据：状态码/耗时/大小/响应头）
 * 2. net-request:ws-open     WebSocket 连接管理（Node 22 内置全局 WebSocket，暂不支持自定义握手 Header）
 * 3. net-request:ws-send     WebSocket 发送消息
 * 4. net-request:ws-close    WebSocket 关闭连接
 * 5. net-request:ws-event    主→渲染推送（连接状态/收发消息）
 * 6. net-request:pick-file   选择本地文件（binary / form-data 文件行 / 导入文件）
 * 7. net-request:read-file   读取本地文本文件内容（导入 Postman/OpenAPI JSON 用）
 *
 * 历史记录 / 集合 / 环境变量的持久化由渲染端 db.ts 走通用 new-sql 通道，
 * 本模块不直接操作数据库。
 */

import { ipcMain, dialog } from "electron";
import axios from "axios";
import https from "node:https";
import fs from "node:fs";
import { win } from "./mainWindow.ts";

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

/** form-data 单行数据（文本行或文件行） */
interface FormDataRow {
  /** 行类型：text=文本，file=文件 */
  type: "text" | "file";
  /** 参数名 */
  key: string;
  /** 文本行的值 */
  value?: string;
  /** 文件行的绝对路径（主进程负责读取） */
  filePath?: string;
}

/** HTTP 请求参数（渲染端 net-request:send 传入） */
interface NetRequestPayload {
  /** 请求地址（可含查询串） */
  url: string;
  /** 请求方法（GET/POST/PUT/...） */
  method: string;
  /** 请求头键值对 */
  headers?: Record<string, string>;
  /** URL 查询参数键值对 */
  params?: Record<string, any>;
  /** 请求体类型：none / form-data / x-www-form-urlencoded / raw / binary */
  bodyType?: string;
  /** raw 子类型：json / text / xml / html */
  rawType?: string;
  /** raw 文本内容 */
  rawBody?: string;
  /** form-data 行列表 */
  formData?: FormDataRow[];
  /** x-www-form-urlencoded 键值对 */
  urlEncoded?: Record<string, string>;
  /** binary 文件路径 */
  binaryFilePath?: string;
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number;
  /** 是否跟随重定向，默认 true */
  followRedirects?: boolean;
  /** 是否校验 SSL 证书，默认 true */
  validateSsl?: boolean;
}

/* ------------------------------------------------------------------ */
/* HTTP 请求                                                           */
/* ------------------------------------------------------------------ */

/**
 * 构造请求体数据
 * @param payload 请求参数
 * @returns 组装好的 data（可能为 undefined）；构造失败抛错
 * @throws {Error} 文件不存在或读取失败时抛出中文错误信息
 */
function buildRequestData(payload: NetRequestPayload): any {
  switch (payload.bodyType) {
    case "form-data": {
      // 使用 Node 22 全局 FormData/Blob 组装 multipart 表单，文件行由主进程读盘
      const fd = new FormData();
      for (const row of payload.formData || []) {
        if (!row.key) continue;
        if (row.type === "file" && row.filePath) {
          if (!fs.existsSync(row.filePath)) {
            throw new Error(`文件不存在：${row.filePath}`);
          }
          const buf = fs.readFileSync(row.filePath);
          const fileName = row.filePath.split(/[\\/]/).pop() || "file";
          fd.append(row.key, new Blob([buf]), fileName);
        } else {
          fd.append(row.key, row.value ?? "");
        }
      }
      return fd;
    }
    case "x-www-form-urlencoded":
      return new URLSearchParams(payload.urlEncoded || {}).toString();
    case "binary": {
      if (!payload.binaryFilePath || !fs.existsSync(payload.binaryFilePath)) {
        throw new Error(`文件不存在：${payload.binaryFilePath || "未选择"}`);
      }
      return fs.readFileSync(payload.binaryFilePath);
    }
    case "raw": {
      const raw = payload.rawBody || "";
      // raw-json 时尝试转对象交给 axios 序列化；失败则按纯文本发送
      if (payload.rawType === "json") {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    }
    default:
      return undefined;
  }
}

/**
 * 将响应 Buffer 按内容类型解码为可展示数据
 * @param data 响应原始字节
 * @param contentType 响应 content-type 头
 * @returns { body: 解析后的对象或文本, contentType }
 */
function decodeResponse(data: Buffer, contentType: string): { body: any; contentType: string } {
  const text = data.toString("utf8");
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      return { body: JSON.parse(text), contentType };
    } catch {
      // JSON 解析失败退回原始文本
    }
  }
  return { body: text, contentType };
}

/**
 * 发送 HTTP 请求（net-request:send）
 * - validateStatus 放开为全部接收：4xx/5xx 也作为「响应」返回（与 Postman 行为一致）
 * - 返回完整元数据：状态码/状态文本/耗时（ms）/大小（字节）/响应头/响应体
 * @returns 成功：{ success:true, data:{ status,statusText,time,size,headers,body,contentType } }
 *          网络级失败：{ success:false, error:{ message, code } }
 */
ipcMain.handle("net-request:send", async (event, payload: NetRequestPayload) => {
  const start = Date.now();
  try {
    const isHttps = (payload.url || "").startsWith("https:");
    const res = await axios({
      url: payload.url,
      method: (payload.method || "GET").toLowerCase() as any,
      headers: payload.headers,
      params: payload.params,
      data: buildRequestData(payload),
      timeout: payload.timeout || 30000,
      // 不跟随重定向时 maxRedirects 置 0（axios 默认 5 次上限）
      maxRedirects: payload.followRedirects === false ? 0 : 5,
      // SSL 校验开关仅对 https 生效
      httpsAgent: isHttps
        ? new https.Agent({ rejectUnauthorized: payload.validateSsl !== false })
        : undefined,
      // 关键：以 arraybuffer 接收，拿到真实字节大小，再按 content-type 解码
      responseType: "arraybuffer",
      // 4xx/5xx 也视为正常响应（Postman 行为），网络错误仍走 catch
      validateStatus: () => true,
    });
    const buffer = Buffer.from(res.data);
    const contentType = String(res.headers["content-type"] || "");
    const decoded = decodeResponse(buffer, contentType);
    const headers: Record<string, string> = {};
    Object.entries(res.headers).forEach(([k, v]) => {
      headers[k] = Array.isArray(v) ? v.join(", ") : String(v);
    });
    return {
      success: true,
      data: {
        status: res.status,
        statusText: res.statusText || "",
        time: Date.now() - start,
        size: buffer.length,
        headers,
        body: decoded.body,
        contentType,
        // 原始响应的 base64（供渲染端保存二进制响应到磁盘；文本体较小可接受）
        base64: buffer.toString("base64"),
      },
    };
  } catch (err: any) {
    // 网络级错误（DNS 失败/连接拒绝/超时等，无 HTTP 响应）
    return {
      success: false,
      error: {
        message: err?.message || String(err),
        code: err?.code || "",
      },
    };
  }
});

/* ------------------------------------------------------------------ */
/* WebSocket                                                           */
/* ------------------------------------------------------------------ */

/**
 * WebSocket 客户端实例表：key 为渲染端生成的连接 id，
 * 支持多连接并存（同一页面可同时开多个 WS 调试会话）。
 */
const wsClients = new Map<string, any>();

/**
 * 向渲染端推送 WebSocket 事件
 * @param payload { id, type: open|message|close|error|send, data, time }
 */
function wsPush(payload: Record<string, any>) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("net-request:ws-event", payload);
  }
}

/**
 * 打开 WebSocket 连接（net-request:ws-open）
 * @param args { id: 连接标识, url: ws/wss 地址 }
 * @returns { success, message? } 已存在同 id 连接时会先关闭旧连接
 */
ipcMain.handle("net-request:ws-open", async (event, args: { id: string; url: string }) => {
  const { id, url } = args || ({} as any);
  if (!id || !url) return { success: false, message: "缺少连接 id 或地址" };
  // 同 id 重复打开：先关闭旧连接，避免实例泄漏
  const old = wsClients.get(id);
  if (old) {
    try {
      old.close();
    } catch {
      /* 忽略旧连接关闭异常 */
    }
    wsClients.delete(id);
  }
  try {
    // Node 22 / Electron 36 内置全局 WebSocket（undici 实现）
    const ws = new (globalThis as any).WebSocket(url);
    wsClients.set(id, ws);
    ws.onopen = () => wsPush({ id, type: "open", time: Date.now() });
    ws.onmessage = (ev: any) => wsPush({ id, type: "message", data: ev.data, time: Date.now() });
    ws.onclose = (ev: any) => {
      wsPush({ id, type: "close", data: `code=${ev?.code ?? ""}`, time: Date.now() });
      wsClients.delete(id);
    };
    ws.onerror = () => wsPush({ id, type: "error", data: "连接错误", time: Date.now() });
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || String(err) };
  }
});

/**
 * 向指定连接发送消息（net-request:ws-send）
 * @param args { id: 连接标识, data: 文本内容 }
 * @returns { success, message? }
 */
ipcMain.handle("net-request:ws-send", async (event, args: { id: string; data: string }) => {
  const ws = wsClients.get(args?.id);
  if (!ws) return { success: false, message: "连接不存在或已关闭" };
  try {
    ws.send(args.data);
    wsPush({ id: args.id, type: "send", data: args.data, time: Date.now() });
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || String(err) };
  }
});

/**
 * 关闭 WebSocket 连接（net-request:ws-close）
 * @param args { id: 连接标识 }
 * @returns { success, message? }
 */
ipcMain.handle("net-request:ws-close", async (event, args: { id: string }) => {
  const ws = wsClients.get(args?.id);
  if (!ws) return { success: false, message: "连接不存在或已关闭" };
  try {
    ws.close();
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || String(err) };
  }
});

/* ------------------------------------------------------------------ */
/* 文件选择 / 读取                                                      */
/* ------------------------------------------------------------------ */

/**
 * 打开文件选择对话框（net-request:pick-file）
 * @param args { title?: 对话框标题 }
 * @returns { success, path?: 选中文件绝对路径 } 取消选择时 path 为空
 */
ipcMain.handle("net-request:pick-file", async (event, args: { title?: string }) => {
  const res = await dialog.showOpenDialog({
    title: args?.title || "选择文件",
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths?.length) {
    return { success: true, path: "" };
  }
  return { success: true, path: res.filePaths[0] };
});

/**
 * 读取本地文本文件内容（net-request:read-file）
 * 供「导入」功能读取 Postman Collection / OpenAPI 导出 JSON 使用
 * @param args { path: 文件绝对路径 }
 * @returns { success, content?: utf8 文本, message? }
 */
ipcMain.handle("net-request:read-file", async (event, args: { path: string }) => {
  try {
    if (!args?.path || !fs.existsSync(args.path)) {
      return { success: false, message: "文件不存在" };
    }
    return { success: true, content: fs.readFileSync(args.path, "utf8") };
  } catch (err: any) {
    return { success: false, message: err?.message || String(err) };
  }
});

/**
 * 保存内容到本地文件（net-request:save-file）
 * 通用出口：响应体保存（base64 二进制 / 文本）与导出 JSON 共用
 * @param args { title?: 对话框标题, defaultName?: 建议文件名, base64?: 二进制内容, text?: 文本内容 }
 * @returns { success, path?: 保存后的绝对路径 } 用户取消时 path 为空
 */
ipcMain.handle(
  "net-request:save-file",
  async (
    event,
    args: { title?: string; defaultName?: string; base64?: string; text?: string }
  ) => {
    try {
      const res = await dialog.showSaveDialog({
        title: args?.title || "保存文件",
        defaultPath: args?.defaultName || "download",
      });
      if (res.canceled || !res.filePath) {
        return { success: true, path: "" };
      }
      if (args?.base64 !== undefined) {
        fs.writeFileSync(res.filePath, Buffer.from(args.base64, "base64"));
      } else {
        fs.writeFileSync(res.filePath, args?.text ?? "", "utf8");
      }
      return { success: true, path: res.filePath };
    } catch (err: any) {
      return { success: false, message: err?.message || String(err) };
    }
  }
);

/* ------------------------------------------------------------------ */
/* 模块初始化                                                          */
/* ------------------------------------------------------------------ */

/**
 * 初始化网络请求模块（在 electron/main/index.ts 中注册）
 * 所有 ipcMain.handle 均为声明即注册，此函数仅作统一挂载入口
 */
export function initNetRequest() {
  // 通道已在上方通过 ipcMain.handle 注册，无需额外逻辑
}
