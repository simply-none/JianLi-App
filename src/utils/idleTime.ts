// 空闲时段（免打扰）判定工具：与 electron/main/module/newReminder.ts 的 isInIdlePeriod 逻辑保持一致。
// 渲染端各展示点（番茄钟设置页 / 提醒列表 / 番茄钟小窗）统一调用本函数做「当前是否处于空闲时段」判定，
// 由「提醒配置的 idleTime + 当前时间」本地推导，确定性一致，不依赖主进程事件推送是否准时到达。

export interface IdleTimeSlot {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

function toMinOfDay(t?: string | null): number {
  if (!t || typeof t !== "string") return -1;
  const parts = t.split(":").map((p) => Number(p));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
  return parts[0] * 60 + parts[1];
}

// 判断给定时刻是否处于空闲时段内（支持跨午夜：start>end 表示晚段[start,24)+早段[0,end)）
export function isInIdlePeriod(
  idle?: IdleTimeSlot[] | null,
  now: Date = new Date()
): boolean {
  if (!Array.isArray(idle) || idle.length === 0) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const w of idle) {
    const s = toMinOfDay(w?.start);
    const e = toMinOfDay(w?.end);
    if (s < 0 || e < 0) continue;
    if (s > e) {
      // 跨午夜：晚段 [s,24) 或 早段 [0,e)
      if (cur >= s || cur < e) return true;
    } else if (s <= e) {
      if (cur >= s && cur < e) return true;
    }
  }
  return false;
}
