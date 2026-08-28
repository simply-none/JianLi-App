/**
 * 日期与连击计算（纯函数，不依赖 Vue / IPC，便于复用与单测）。
 */

/** 数字补零，保证 YYYY-MM-DD / HH:mm:ss 的定长格式（字典序即时间序） */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date → YYYY-MM-DD */
export function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → HH:mm:ss */
export function timeToStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Date → YYYY-MM-DD HH:mm:ss */
export function dateTimeToStr(d: Date): string {
  return `${dateToStr(d)} ${timeToStr(d)}`;
}

/** 今天 YYYY-MM-DD */
export function todayStr(): string {
  return dateToStr(new Date());
}

/**
 * 日期字符串偏移（按天）。用本地时间构造，避免 toISOString 的时区偏移问题。
 * @param dateStr YYYY-MM-DD
 * @param days 正数向后、负数向前
 */
export function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dateToStr(dt);
}

/**
 * 由打卡日期集合计算连击。
 *
 * 「当前连续」的判定带一天宽限：今天已打卡则从今天往回数；
 * 今天还没打但昨天打了，仍视为连击未中断（从昨天往回数），
 * 避免刚过零点就把 streak 清零的糟糕体验。
 */
export function computeStreak(dates: string[]): { current: number; longest: number; total: number } {
  const set = new Set(dates.filter(Boolean));
  const sorted = Array.from(set).sort();

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && shiftDateStr(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  let current = 0;
  let cursor = todayStr();
  if (!set.has(cursor)) {
    cursor = shiftDateStr(cursor, -1);
    // 今天与昨天都没打卡 → 连击已断
    if (!set.has(cursor)) return { current: 0, longest, total: sorted.length };
  }
  while (set.has(cursor)) {
    current += 1;
    cursor = shiftDateStr(cursor, -1);
  }

  return { current, longest, total: sorted.length };
}
