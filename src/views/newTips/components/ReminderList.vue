<template>
  <div class="reminder-set">
    <div v-if="reminders.length > 0" class="reminder-list">
      <div
        v-for="item in reminders"
        :key="item.id"
        class="reminder-card"
        :class="{ disabled: !item.enabled }"
      >
        <div class="reminder-icon" :class="item.mode">
          <LucideIcon :name="modeIcon(item.mode)" :size="20" />
        </div>
        <div class="reminder-info">
          <div class="reminder-title">{{ item.title }}</div>
          <div class="reminder-rule">{{ getRuleText(item) }}</div>
          <div class="reminder-sub">{{ subInfoText(item) }}</div>
        </div>
        <el-tag size="small" :type="modeTagType(item.mode)" class="mode-tag" effect="plain">
          {{ modeTagText(item.mode) }}
        </el-tag>
        <el-tag v-if="item.recordAfter" size="small" type="warning" effect="plain" class="record-tag">
          记录
        </el-tag>
        <el-tag
          v-if="item.idleTime && item.idleTime.length"
          size="small"
          type="info"
          effect="plain"
          class="idle-tag"
        >
          免打扰{{ item.idleTime.length }}段
        </el-tag>
        <el-switch
          :model-value="item.enabled"
          :active-value="1"
          :inactive-value="0"
          @change="(val: number) => $emit('toggle', item.id, val)"
        />
        <div class="reminder-actions">
          <el-button size="small" @click="$emit('edit', item)" class="act-btn edit">
            <LucideIcon name="Pen" :size="14" />
            编辑
          </el-button>
          <el-tooltip v-if="item.id === 'pomodoro'" content="系统内置番茄钟不可删除" placement="top">
            <el-button size="small" disabled class="act-btn delete" title="系统内置番茄钟不可删除">
              <LucideIcon name="Lock" :size="14" />
              删除
            </el-button>
          </el-tooltip>
          <el-button v-else size="small" @click="$emit('delete', item)" class="act-btn delete">
            <LucideIcon name="Trash" :size="14" />
            删除
          </el-button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <LucideIcon name="BellRing" :size="48" class="empty-icon" />
      <div class="empty-text">暂无提醒，点击右上角「新增提醒」添加</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";
import useTipsRuntime from "@/store/useTipsRuntime";
import type { TipsReminder } from "../types";

const props = defineProps<{ reminders: TipsReminder[] }>();
const emit = defineEmits<{
  edit: [item: TipsReminder];
  delete: [item: TipsReminder];
  toggle: [id: string, enabled: number];
}>();

const runtime = useTipsRuntime();

// 当前多状态运行时（匹配到指定提醒 id）
function runtimeByItem(id: string) {
  if (id !== runtime.activeId) return null;
  return {
    stateLabel: runtime.stateLabel,
    nextStateLabel: runtime.nextStateLabel,
    nextTime: runtime.nextStateTime,
    stateStartTime: runtime.stateStartTime,
    injected: !!runtime.injected,
    stopped: !!runtime.stopped,
    idle: !!runtime.idle,
  };
}

const weekOptions = [
  { label: "周日", value: 0 },
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
];
const unitOptions = [
  { label: "秒", value: 1000 },
  { label: "分钟", value: 60 * 1000 },
  { label: "小时", value: 60 * 60 * 1000 },
];
const weekLabelMap: Record<number, string> = {
  0: "日", 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六",
};

function fmt(ts?: number | null): string {
  if (!ts || isNaN(Number(ts))) return "—";
  const d = new Date(Number(ts));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 计算「下一次提醒时间」
function nextTriggerTime(item: TipsReminder): number | null {
  if (item.mode === "stateful") {
    return runtimeByItem(item.id)?.nextTime ?? null;
  }
  if (item.mode === "interval") {
    const gap = Number(item.interval) * Number(item.unit);
    if (isNaN(gap) || gap <= 0) return null;
    const base = item.startTime && !isNaN(item.startTime) ? Number(item.startTime) : Date.now();
    let next = base;
    const now = Date.now();
    if (next <= now) {
      const rounds = Math.floor((now - next) / gap) + 1;
      next += gap * rounds;
    }
    return next;
  }
  return nextCronTime(item);
}

// 定点模式下一次触发
function nextCronTime(item: TipsReminder): number | null {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const toTs = (yr: number, mo: number, da: number, h: number, mi: number) =>
    new Date(yr, mo - 1, da, h, mi, 0, 0).getTime();
  const [h, m] = (item.time || "09:00").split(":").map(Number);

  if (item.repeat === "hourly") {
    const mi = item.minute ?? 0;
    let t = new Date(now);
    t.setMinutes(mi, 0, 0);
    if (t.getTime() <= now.getTime()) t = new Date(t.getTime() + 3600000);
    return t.getTime();
  }
  if (item.repeat === "daily") {
    let t = toTs(now.getFullYear(), now.getMonth() + 1, now.getDate(), h, m);
    if (t <= now.getTime()) t += 86400000;
    return t;
  }
  if (item.repeat === "weekly") {
    const days = item.weekDays || [];
    for (let add = 0; add < 8; add++) {
      const d = new Date(now.getTime() + add * 86400000);
      if (days.includes(d.getDay())) {
        const t = toTs(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m);
        if (t > now.getTime()) return t;
      }
    }
    return null;
  }
  if (item.repeat === "monthly") {
    const dom = item.dayOfMonth || 1;
    for (let add = 0; add < 62; add++) {
      const d = new Date(now.getTime() + add * 86400000);
      if (d.getDate() === dom) {
        const t = toTs(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m);
        if (t > now.getTime()) return t;
      }
    }
    return null;
  }
  if (item.repeat === "yearly") {
    const mon = item.month || 1;
    const dom = item.dayOfMonth || 1;
    for (let add = 0; add < 400; add++) {
      const d = new Date(now.getTime() + add * 86400000);
      if (d.getMonth() + 1 === mon && d.getDate() === dom) {
        const t = toTs(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m);
        if (t > now.getTime()) return t;
      }
    }
    return null;
  }
  if (item.repeat === "once") {
    const [h2, m2] = (item.time || "09:00").split(":").map(Number);
    const parts = (item.date || "").split("-").map(Number);
    if (parts.length < 3) return null;
    const t = toTs(parts[0], parts[1], parts[2], h2, m2);
    return t > now.getTime() ? t : null;
  }
  return null;
}

function subInfoText(item: TipsReminder): string {
  const startTimeText =
    item.startTime && !isNaN(item.startTime)
      ? `（本次开始时间：${fmt(item.startTime)}）`
      : "（本次开始时间：立即）";
  if (item.mode === "stateful") {
    const rt = runtimeByItem(item.id);
    if (rt?.idle) {
      return `空闲中（已暂停，免打扰时段内不打扰）；空闲结束后立即开始新一轮${startTimeText}`;
    }
    if (!rt || rt.stopped) {
      return `当前状态：—，下一个状态：—的提醒时间为 —${startTimeText}`;
    }
    const cur = rt.stateLabel || "?";
    const nextLabel = rt.nextStateLabel || "?";
    const nextT = fmt(rt.nextTime);
    const startText =
      rt.stateStartTime && !isNaN(rt.stateStartTime)
        ? `（本次开始时间：${fmt(rt.stateStartTime)}）`
        : startTimeText;
    return `当前状态：${cur}，下一个状态：${nextLabel} 的提醒时间为 ${nextT}${startText}`;
  }
  const nextT = fmt(nextTriggerTime(item));
  return `下一次提醒时间：${nextT}${startTimeText}`;
}

function getRuleText(item: TipsReminder): string {
  const startText =
    item.startTime && !isNaN(Number(item.startTime))
      ? ` 起${new Date(Number(item.startTime)).toLocaleString("zh-CN", {
          hour12: false,
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "";
  if (item.mode === "stateful") {
    const seq = (item.states || []).map((s, i) => {
      const u = unitOptions.find((o) => o.value === s.unit)?.label || "";
      const tag = s.sequential === 0 ? "※" : `${i + 1}`;
      return `${tag}${s.label || "?"}${s.duration || 0}${u}`;
    }).join(" → ");
    return seq + (item.loop ? "（循环）" : "") + startText;
  }
  if (item.mode === "time") {
    const t = item.time || "--:--";
    let base = "";
    if (item.repeat === "hourly") base = `每小时第 ${item.minute ?? 0} 分钟`;
    else if (item.repeat === "daily") base = `每天 ${t}`;
    else if (item.repeat === "weekly") {
      const days = (item.weekDays || []).slice().sort((a, b) => a - b).map((d) => weekLabelMap[d] || "").filter(Boolean).join("、");
      base = `每周${days} ${t}`;
    } else if (item.repeat === "monthly") base = `每月 ${item.dayOfMonth || 1} 日 ${t}`;
    else if (item.repeat === "yearly") base = `每年 ${item.month || 1} 月 ${item.dayOfMonth || 1} 日 ${t}`;
    else if (item.repeat === "once") base = `${item.date || "--"} ${t}`;
    else base = t;
    return base + startText;
  }
  const unit = unitOptions.find((u) => u.value === item.unit)?.label || "";
  return `每 ${item.interval || 0} ${unit}` + startText;
}

function modeIcon(mode?: string): string {
  if (mode === "time") return "AlarmClock";
  if (mode === "stateful") return "Repeat";
  return "RefreshCw";
}
function modeTagType(mode?: string): any {
  if (mode === "time") return "primary";
  if (mode === "stateful") return "warning";
  return "success";
}
function modeTagText(mode?: string): string {
  if (mode === "time") return "定点";
  if (mode === "stateful") return "多状态";
  return "周期";
}
</script>

<style scoped lang="scss">
.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.reminder-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light, #f5f7fa);
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  &.disabled {
    opacity: 0.55;
  }
}
.reminder-icon {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  &.time { background: #409eff; }
  &.interval { background: #67c23a; }
  &.stateful { background: #e6a23c; }
}
.reminder-info {
  flex: 1;
  min-width: 0;
}
.reminder-title {
  font-weight: 600;
  font-size: 14px;
}
.reminder-rule {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}
.reminder-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}
.mode-tag { flex-shrink: 0; }
.record-tag { flex-shrink: 0; }
.idle-tag { flex-shrink: 0; }
.reminder-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 0;
  color: var(--el-text-color-secondary, #909399);
}
</style>
