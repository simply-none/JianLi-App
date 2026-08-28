// 通用习惯打卡 —— 类型定义。
//
// 落库红线（务必遵守）：
// 1. 习惯数据只写自有表 habit_def / habit_checkin，绝不复用番茄钟 pomodoro_status 的隐式写库路径。
// 2. 习惯本身不依赖 stateful 多状态引擎；"每天 X 点提醒打卡" 在提醒系统里是
//    mode='time' + repeat='daily' 的定点重复提醒，由 newReminder 统一调度。
//
// 数组字段（weekDays / reminderTimes）在库中以 JSON 字符串存储（sqlite 只认标量），
// 序列化与反序列化统一在 api 层完成，业务侧拿到的始终是真正的数组。

/** 习惯频率：每日 / 每周（每周需配合 weekDays） */
export type HabitFreqType = "daily" | "weekly";

/**
 * 链式动作配置：打卡成功后按顺序派发，撤销打卡时反向回滚。
 * type 对应 chainActions/registry 里注册的动作，params 由各动作自行解释。
 */
export interface HabitChainActionConfig {
  type: string;
  params?: Record<string, any>;
}

/** 习惯定义（对应表 habit_def，主键 key，形如 'habit:<uuid>'） */
export interface HabitDef {
  /** 习惯唯一 id，同时是底层提醒 id 的组成部分 */
  key: string;
  /** 习惯名称 */
  name: string;
  /** 备注 / 打卡时的提醒文案 */
  remark: string;
  /** 频率类型 */
  freqType: HabitFreqType;
  /** weekly 生效：0-6（0=周日）；daily 时为空数组 */
  weekDays: number[];
  /** 每日提醒时刻列表，如 ["08:00","21:00"]；为空表示不提醒 */
  reminderTimes: string[];
  /** 1/0 是否启用：同时控制底层提醒的 enabled */
  enabled: number;
  /** 链式动作：打卡后派发到其它模块（待办 / 笔记 / …），为空表示不串接 */
  chainActions: HabitChainActionConfig[];
  /** 创建时间（YYYY-MM-DD HH:mm:ss） */
  createTime: string;
  /** 更新时间（YYYY-MM-DD HH:mm:ss） */
  updateTime: string;
}

/** 打卡来源，便于后续统计各入口的使用情况 */
export type HabitCheckinSource = "manual" | "miniWindow" | "palette" | "notification";

/**
 * 打卡记录（对应表 habit_checkin）。
 * 主键 key = '<habitKey>#<date>' —— 用主键天然保证「一个习惯一天只有一条记录」，
 * 重复打卡走 upsert 覆盖（更新时间与备注），撤销打卡即删除该行。
 */
export interface HabitCheckin {
  key: string;
  habitKey: string;
  /** 打卡日期 YYYY-MM-DD */
  date: string;
  /** 打卡时刻 HH:mm:ss */
  time: string;
  /** 可选量化值（时长 / 次数等），留空表示只做完成式打卡 */
  value: string;
  /** 备注 */
  note: string;
  /** 来源 */
  source: HabitCheckinSource | string;
}

/** 连击统计结果 */
export interface StreakInfo {
  /** 当前连续天数（今天未打卡但昨天打了，仍计入未中断） */
  current: number;
  /** 历史最长连续天数 */
  longest: number;
  /** 累计打卡天数 */
  total: number;
}
