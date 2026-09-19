/**
 * 小纸条模块公共类型（渲染端）
 *
 * 与主进程 electron/main/module/noteSlip.ts 的字段同构（表 note_slip 逐列对齐）；
 * 协议细节见该文件头注释，移动端对称实现在
 * jianli-mobile-app/lib/features/note_slip/。
 */

/** 一条小纸条（表 note_slip 的行） */
export interface NoteSlipItem {
  /** 幂等键：`${ts}-${rand}`，双端同键 */
  key: string;
  /** in=收到 / out=发出 */
  direction: "in" | "out";
  /** text=文本 / url=链接 */
  kind: "text" | "url";
  /** 首行摘要（≤40 字） */
  title: string;
  /** 正文全文 */
  content: string;
  /** 对端设备名 */
  peer_name: string;
  /** 对端 IP */
  peer_ip: string;
  /** 已读标记：0=未读 1=已读（发出的恒为 1） */
  read: number;
  /** 毫秒时间戳 */
  created_at: number;
}

/** 发送目标（历史记忆，electron-store 持久化） */
export interface SlipTarget {
  ip: string;
  name: string;
}

/** 扫描到的手机端设备（复用 sync 的发现结果，已剔除 PC） */
export interface SlipPeer {
  ip: string;
  name: string;
  id: string;
  platform: string;
}

/** 主进程 slip:received 事件载荷 */
export interface SlipReceivedPayload {
  key: string;
  content: string;
  kind: "text" | "url";
  from: string;
}

/** 发送结果 */
export interface SlipSendResult {
  ip: string;
  name: string;
}

/** 单条内容上限（字符），与主进程 MAX_CHARS / 移动端 kSlipMaxChars 一致 */
export const SLIP_MAX_CHARS = 8000;
