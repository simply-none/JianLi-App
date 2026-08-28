/**
 * 习惯统计（纯函数）：日历热力网格 + 总览指标。
 * 不依赖 Vue / IPC，输入打卡记录即可算出结果，便于复用与单测。
 */

import type { HabitCheckin, HabitDef } from "../types";
import { computeStreak, shiftDateStr, todayStr } from "./streak";

/** 热力图单个格子 */
export interface HeatCell {
  /** YYYY-MM-DD */
  date: string;
  /** 当天打卡次数 */
  count: number;
  /** 是否晚于结束日（未来格子，不参与着色） */
  future: boolean;
}

export interface HeatmapResult {
  cells: HeatCell[];
  /** 网格起始日 */
  start: string;
  /** 网格结束日（通常是今天） */
  end: string;
  /** 单日最大打卡次数，用于归一化着色 */
  max: number;
}

/**
 * 取星期几（0=周一 … 6=周日），与中文习惯一致。
 * JS 的 getDay() 是 0=周日，这里做一次换算。
 */
export function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=周日
  return (jsDay + 6) % 7;
}

/**
 * 构建热力网格（列优先：每列一周，共 weeks 列，最后一列包含结束日）。
 * 日期字符串是定长 YYYY-MM-DD，可直接用字典序比较。
 */
export function buildHeatmap(
  countByDate: Record<string, number>,
  weeks = 12,
  endDate = todayStr()
): HeatmapResult {
  const endWeekday = weekdayIndex(endDate);
  // 结束日所在周的周一
  const lastColMonday = shiftDateStr(endDate, -endWeekday);
  // 再往前推 weeks-1 周，得到整块网格的起点（保证最后一列含结束日）
  const start = shiftDateStr(lastColMonday, -(weeks - 1) * 7);

  const cells: HeatCell[] = [];
  const total = weeks * 7;
  for (let i = 0; i < total; i++) {
    const date = shiftDateStr(start, i);
    cells.push({
      date,
      count: countByDate[date] ?? 0,
      future: date > endDate,
    });
  }

  const max = cells.reduce((m, c) => Math.max(m, c.count), 0);
  return { cells, start, end: endDate, max };
}

/** 由打卡记录聚合出「日期 → 打卡次数」 */
export function countByDateOf(checkins: HabitCheckin[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of checkins) {
    if (!c?.date) continue;
    map[c.date] = (map[c.date] ?? 0) + 1;
  }
  return map;
}

export interface HabitOverview {
  /** 累计打卡次数 */
  totalCheckins: number;
  /** 有打卡的天数 */
  activeDays: number;
  /** 所有习惯中最长的历史连击 */
  longestStreak: number;
  /** 近 30 天里有打卡的天数占比（0~1） */
  last30Rate: number;
}

/** 计算总览指标 */
export function computeOverview(
  checkins: HabitCheckin[],
  habits: HabitDef[]
): HabitOverview {
  const dateSet = new Set(checkins.map((c) => c.date).filter(Boolean));

  // 最长连击取所有习惯中的最大值
  const longestStreak = habits.reduce((max, h) => {
    const dates = checkins.filter((c) => c.habitKey === h.key).map((c) => c.date);
    return Math.max(max, computeStreak(dates).longest);
  }, 0);

  const today = todayStr();
  const from = shiftDateStr(today, -29);
  const last30 = new Set([...dateSet].filter((d) => d >= from && d <= today));

  return {
    totalCheckins: checkins.length,
    activeDays: dateSet.size,
    longestStreak,
    last30Rate: last30.size / 30,
  };
}
