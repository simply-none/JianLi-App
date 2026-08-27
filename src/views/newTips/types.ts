// 全新提醒系统的类型定义。
// 约定：布尔字段（recordAfter / lockScreen / sequential / continueLoop / loop / enabled）
// 在内存与数据库中均以 1/0 数值表示，UI 用 el-switch 的 active-value=1 / inactive-value=0。

export type TipsMode = 'time' | 'interval' | 'stateful';
export type TipsRepeat = 'once' | 'daily' | 'weekly' | 'hourly' | 'monthly' | 'yearly';

// 多状态模式下的单个状态节点
export interface TipsState {
  key: string; // 状态标识：'work' | 'rest' | 'lock' | 自定义
  label: string; // 状态显示名
  content?: string; // 进入该状态时展示的提醒内容（可空）
  duration: number; // 持续时长数值
  unit: number; // 时长单位：1000 / 60000 / 3600000
  record: number; // 1/0 进入该状态是否记录
  lockScreen: number; // 1/0 进入该状态是否锁屏
  sequential: number; // 1/0 是否序列状态（参与循环）
  continueLoop: number; // 1/0 非序列态结束后：1=继续未完成循环，0=开始新循环
}

// 空闲时间（免打扰时段）：每日固定时段，可配置多个。
// 当前时间落在任一时段内时，该提醒不触发（定点/周期不通知、多状态不进入状态），
// 空闲结束后立即开始新的或新一轮提醒。时段支持跨午夜（start > end，如 22:00-06:00）。
export interface IdleTimeSlot {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface TipsReminder {
  id: string;
  mode: TipsMode;
  title: string;
  content: string;
  enabled: number; // 1/0
  // 空闲时间（免打扰时段）：null / [] 表示不设置
  idleTime?: IdleTimeSlot[] | null;
  // 开始时间（绝对毫秒时间戳）：首次生效 / 第 1 个状态进入基准；null = 立即
  startTime: number | null;
  // 定点模式
  time?: string; // "HH:mm"
  repeat?: TipsRepeat;
  date?: string; // "YYYY-MM-DD"
  weekDays?: number[]; // [0-6]，0=周日
  minute?: number; // hourly 时：0-59
  dayOfMonth?: number; // monthly/yearly：1-31
  month?: number; // yearly：1-12
  // 周期模式
  interval?: number;
  unit?: number; // 1000 / 60000 / 3600000
  // 结束后是否跳转主题对话记录情绪
  recordAfter: number; // 1/0
  // 多状态模式
  states?: TipsState[];
  loop: number; // 1/0 状态序列是否循环
}
