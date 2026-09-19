/**
 * 小纸条数据层（功能化）：封装与主进程 noteSlip.ts 的 IPC 通信。
 *
 * 通道清单（主进程 electron/main/module/noteSlip.ts 注册）：
 * - slip:scan            → 扫描局域网手机端（复用 sync 发现，剔除 PC）
 * - slip:targets         → 已记忆的发送目标（electron-store 持久化）
 * - slip:last-peer       → 最近一次成功发送的目标 IP
 * - slip:send            → {ip?, text, peerName?} 发送文本/链接
 * - slip:send-clipboard  → {ip?} 把当前系统剪贴板文本发到最近目标（快捷键/托盘入口）
 * - slip:list            → 本机收发记录（created_at 倒序）
 * - slip:read            → {key} 标记已读
 * - slip:delete          → {key} 删除单条
 * - slip:clear           → 清空全部
 *
 * 事件（主进程 → 渲染端）：slip:received {key, content, kind, from}
 */

import type {
  NoteSlipItem,
  SlipPeer,
  SlipSendResult,
  SlipTarget,
} from "../types";

interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  unsupported?: boolean;
}

/** 统一经 preload 的 handlePromise 与主进程交互（args 必传，preload 类型签名如此） */
function invoke<T = unknown>(
  channel: string,
  args: Record<string, unknown> = {},
): Promise<IpcResult<T>> {
  return window.ipcRenderer.handlePromise(channel, args);
}

export const noteSlipApi = {
  /** 扫描局域网手机端（PC 之间互发无意义，已剔除） */
  scan: () => invoke<SlipPeer[]>("slip:scan"),

  /** 已记忆的发送目标清单 */
  targets: () => invoke<SlipTarget[]>("slip:targets"),

  /** 最近一次成功发送的目标 IP（空串 = 还没发过） */
  lastPeer: () => invoke<string>("slip:last-peer"),

  /** 发送文本/链接；ip 省略时用最近目标 */
  send: (text: string, ip?: string, peerName?: string) =>
    invoke<SlipSendResult>("slip:send", { text, ip, peerName }),

  /** 把当前系统剪贴板文本发到最近目标（快捷键 / 托盘入口） */
  sendClipboard: (ip?: string) =>
    invoke<SlipSendResult>("slip:send-clipboard", { ip }),

  /**
   * 本机收发记录（created_at 倒序）。
   * ⚠️ `ensureTableExists` 只建 TEXT 列，故 `read` / `created_at` 从库里出来可能是字符串，
   *    这里统一归一化成数字，避免渲染端 `!item.read` 把 "0" 当成已读。
   */
  list: async () => {
    const res = await invoke<NoteSlipItem[]>("slip:list");
    if (res.success && Array.isArray(res.data)) {
      res.data = res.data.map((r) => ({
        ...r,
        read: Number(r.read) > 0 ? 1 : 0,
        created_at: Number(r.created_at) || 0,
      }));
    }
    return res;
  },

  /** 标记已读 */
  read: (key: string) => invoke<unknown>("slip:read", { key }),

  /** 删除单条 */
  remove: (key: string) => invoke<unknown>("slip:delete", { key }),

  /** 清空全部 */
  clear: () => invoke<unknown>("slip:clear"),
};
