/**
 * 倒计时数据契约（渲染端自建，纯前端结构；跨进程走 IPC）。
 */

/** 倒计时状态 */
export type CountdownStatus = "running" | "paused" | "finished";

/** 设定方式：指定结束时刻 / 指定时长 */
export type CountdownMode = "datetime" | "duration";

/** 展示样式（全局统一切换，不落库倒计时表，存 electron-store） */
export type CountdownStyle = "digital" | "bar" | "flip" | "gradient";

/** 展示样式可选清单 */
export const COUNTDOWN_STYLES: { value: CountdownStyle; label: string }[] = [
  { value: "digital", label: "数字" },
  { value: "bar", label: "进度条" },
  { value: "flip", label: "翻转" },
  { value: "gradient", label: "渐变文字" },
];

/** 数据库行（字段与 electron/main/module/countdown.ts 的表结构一致） */
export interface CountdownRow {
  key: string;
  name: string;
  mode: CountdownMode;
  /** 目标结束时间戳(ms) */
  end_time: number;
  /** 原始时长(ms)，用于「重置」 */
  duration: number;
  /** 暂停时冻结的剩余时长(ms)，恢复时作为 start 的 duration */
  paused_remaining: number;
  status: CountdownStatus;
  /** 是否弹完成通知 0/1 */
  notify: number;
  /** 提示音（可选） */
  sound: string;
  /** 卡片 / 进度环颜色 */
  color: string;
  created_at: number;
  finished_at: number;
}

/** 新建 / 编辑表单输入 */
export interface CountdownInput {
  /** 编辑时传入，创建时留空由 store 生成 */
  key?: string;
  name: string;
  mode: CountdownMode;
  /** mode=datetime：目标时刻(ms) */
  targetTime?: number;
  /** mode=duration：时长(ms) */
  durationMs?: number;
  notify?: boolean;
  sound?: string;
  color?: string;
  /** 编辑时若需保持原 timing，直接传原行字段（不再重算） */
  end_time?: number;
  duration?: number;
  status?: CountdownStatus;
  created_at?: number;
}
