import { computed, ref } from "vue";
import { defineStore } from "pinia";
import useNewReminder from "@/store/useNewReminder";
import type { TipsReminder } from "@/views/newTips/types";
import * as habitApi from "@/views/habit/api/habitApi";
import type { HabitCheckin, HabitCheckinSource, HabitDef, StreakInfo } from "@/views/habit/types";
import { computeStreak, dateTimeToStr, timeToStr, todayStr } from "@/views/habit/utils/streak";
import { dispatchChainActions, rollbackChainActions } from "@/views/habit/chainActions";
import type { ChainActionResult } from "@/views/habit/chainActions";

/**
 * 通用习惯打卡 store。
 *
 * 设计要点：
 * 1. 习惯定义与打卡记录都存在自有表（habit_def / habit_checkin），不碰番茄钟的落库路径。
 * 2. 「引擎复用」：习惯不自己实现调度器，而是把每个提醒时刻同步成提醒系统里的一条
 *    mode='time' 定点重复提醒（id 形如 habit:<habitKey>#<序号>），
 *    由主进程 newReminder 统一负责排程、免打扰、重启恢复。
 *    习惯只管「定义 + 记录」，调度能力全部白嫖既有引擎。
 */

/** 习惯提醒 id 的前缀，用于识别「这条提醒是由习惯同步出来的」 */
export const HABIT_REMINDER_PREFIX = "habit:";

/** 构造某个习惯第 index 个提醒时刻对应的提醒 id */
export function habitReminderId(habitKey: string, index: number): string {
  return `${HABIT_REMINDER_PREFIX}${habitKey}#${index}`;
}

/** 判断提醒 id 是否由习惯同步产生 */
export function isHabitReminderId(id: string): boolean {
  return typeof id === "string" && id.startsWith(HABIT_REMINDER_PREFIX);
}

/** 生成习惯主键（不引第三方依赖，够用且可读） */
function genHabitKey(): string {
  return `habit:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 由习惯定义 + 提醒时刻，构造底层提醒条目 */
function buildReminder(habit: HabitDef, time: string, index: number): TipsReminder {
  return {
    id: habitReminderId(habit.key, index),
    mode: "time",
    title: `打卡提醒：${habit.name}`,
    content: habit.remark || `别忘了完成「${habit.name}」的今日打卡`,
    enabled: habit.enabled,
    startTime: null,
    time,
    repeat: habit.freqType, // daily / weekly
    weekDays: habit.freqType === "weekly" ? habit.weekDays : undefined,
    // 打卡不走「结束后跳转主题对话」；非多状态提醒，loop 无意义
    recordAfter: 0,
    loop: 0,
    idleTime: null,
  };
}

/** 比较两条提醒的业务字段是否一致（避免无意义的重复写库与重排程） */
function sameReminder(a: TipsReminder, b: TipsReminder): boolean {
  return (
    a.mode === b.mode &&
    a.title === b.title &&
    a.content === b.content &&
    a.enabled === b.enabled &&
    a.time === b.time &&
    a.repeat === b.repeat &&
    JSON.stringify(a.weekDays ?? []) === JSON.stringify(b.weekDays ?? [])
  );
}

export default defineStore("habit", () => {
  /** 全部习惯定义 */
  const habits = ref<HabitDef[]>([]);
  /** 全部打卡记录 */
  const checkins = ref<HabitCheckin[]>([]);
  /** 是否加载中 */
  const loading = ref(false);

  /** 今天（YYYY-MM-DD） */
  const today = computed(() => todayStr());

  /** 今天已打卡的习惯 key 集合 */
  const checkedTodayKeys = computed(
    () => new Set(checkins.value.filter((c) => c.date === today.value).map((c) => c.habitKey))
  );

  /** 每个习惯的打卡日期列表：habitKey -> YYYY-MM-DD[]（升序） */
  const datesByHabit = computed(() => {
    const map: Record<string, string[]> = {};
    for (const c of checkins.value) {
      if (!c.habitKey) continue;
      (map[c.habitKey] ||= []).push(c.date);
    }
    Object.values(map).forEach((list) => list.sort());
    return map;
  });

  /** 每个习惯的连击统计：habitKey -> StreakInfo */
  const streakByHabit = computed(() => {
    const map: Record<string, StreakInfo> = {};
    for (const [habitKey, dates] of Object.entries(datesByHabit.value)) {
      map[habitKey] = computeStreak(dates);
    }
    return map;
  });

  /** 某个习惯今天是否已打卡 */
  function isCheckedToday(habitKey: string): boolean {
    return checkedTodayKeys.value.has(habitKey);
  }

  /** 取某个习惯的连击信息（未打过卡时返回全 0） */
  function streakOf(habitKey: string): StreakInfo {
    return streakByHabit.value[habitKey] ?? { current: 0, longest: 0, total: 0 };
  }

  /**
   * 把习惯定义同步为底层提醒（引擎复用的核心）。
   * - 习惯的每个提醒时刻 → 一条 mode='time' 的定点重复提醒
   * - 已不存在 / 时刻变少的旧提醒会被清理，避免残留
   * - 内容无变化时不重复写库
   */
  async function syncReminders() {
    const reminderStore = useNewReminder();
    // store 内部的 onMounted 只在组件上下文中触发，这里显式兜底加载一次
    if (!reminderStore.reminders.length) await reminderStore.load();

    const desired = new Map<string, TipsReminder>();
    habits.value.forEach((habit) => {
      (habit.reminderTimes ?? []).forEach((time, index) => {
        if (!time) return;
        desired.set(habitReminderId(habit.key, index), buildReminder(habit, time, index));
      });
    });

    // 清理：由习惯产生但已不在期望集合中的提醒（删除习惯 / 减少提醒时刻）
    const stale = reminderStore.reminders.filter(
      (r) => isHabitReminderId(r.id) && !desired.has(r.id)
    );
    for (const r of stale) {
      reminderStore.deleteReminder(r.id);
    }

    // 新增 / 更新：仅在业务字段有变化时才写库
    for (const [id, next] of desired) {
      const prev = reminderStore.reminders.find((r) => r.id === id);
      if (prev && sameReminder(prev, next)) continue;
      try {
        await reminderStore.saveReminder(next);
      } catch (err) {
        console.error("[habit] 同步习惯提醒失败:", id, err);
      }
    }
  }

  /** 重新拉取打卡记录 */
  async function refreshCheckins() {
    checkins.value = await habitApi.fetchCheckins();
  }

  /**
   * 加载全部数据。
   * @param options.sync 是否顺带同步底层提醒。小窗只做只读展示与打卡，
   *   传 `{ sync: false }` 可省掉多余的提醒读写（同步本身幂等，但没必要在第二个窗口再跑一遍）。
   */
  async function load(options: { sync?: boolean } = {}) {
    const needSync = options.sync !== false;
    loading.value = true;
    try {
      // 先把表结构摆正（补 key 列 + 唯一索引），避免历史破表导致 upsert 失败
      await habitApi.ensureHabitTables();
      habits.value = await habitApi.fetchHabitDefs();
      await refreshCheckins();
      if (needSync) await syncReminders();
    } finally {
      loading.value = false;
    }
  }

  /**
   * 新增或更新习惯（key 为空视为新增）。
   * @param input 习惯表单数据（不含 key / 时间戳时由本方法补全）
   */
  async function saveHabit(input: Partial<HabitDef> & { name: string }) {
    const now = dateTimeToStr(new Date());
    const existKey = input.key ? habits.value.find((h) => h.key === input.key) : undefined;
    const habit: HabitDef = {
      key: input.key || genHabitKey(),
      name: input.name,
      remark: input.remark ?? "",
      freqType: input.freqType ?? "daily",
      weekDays: input.weekDays ?? [],
      reminderTimes: input.reminderTimes ?? [],
      enabled: input.enabled ?? 1,
      chainActions: input.chainActions ?? [],
      createTime: existKey?.createTime || input.createTime || now,
      updateTime: now,
    };
    const ok = await habitApi.upsertHabitDef(habit);
    if (!ok) return false;

    const idx = habits.value.findIndex((h) => h.key === habit.key);
    if (idx !== -1) habits.value.splice(idx, 1, habit);
    else habits.value.push(habit);
    // 提醒时刻可能变了，重新同步
    await syncReminders();
    return true;
  }

  /** 删除习惯：清理定义、其全部打卡记录，以及同步出去的提醒 */
  async function removeHabit(key: string) {
    await habitApi.deleteHabitDef(key);
    await habitApi.deleteCheckinsByHabit(key);
    habits.value = habits.value.filter((h) => h.key !== key);
    checkins.value = checkins.value.filter((c) => c.habitKey !== key);
    await syncReminders();
  }

  /** 启停习惯：同步到底层提醒的 enabled */
  async function toggleHabit(key: string, enabled: number) {
    const habit = habits.value.find((h) => h.key === key);
    if (!habit) return;
    habit.enabled = enabled;
    await habitApi.upsertHabitDef(habit);
    await syncReminders();
  }

  /**
   * 打卡。一天一条（主键 <habitKey>#<date>），重复打卡覆盖更新时间与备注。
   * @returns 打卡失败返回 null；成功返回链式动作的执行结果（无串接时为 []）。
   *          注意：链式动作失败不影响返回值 —— 打卡本身已经成功，串接只是附加能力。
   */
  async function checkIn(
    habitKey: string,
    payload: { value?: string; note?: string; source?: HabitCheckinSource } = {}
  ): Promise<ChainActionResult[] | null> {
    const habit = habits.value.find((h) => h.key === habitKey);
    const date = todayStr();
    const record: HabitCheckin = {
      key: `${habitKey}#${date}`,
      habitKey,
      date,
      time: timeToStr(new Date()),
      value: payload.value ?? "",
      note: payload.note ?? "",
      source: payload.source ?? "manual",
    };
    const ok = await habitApi.upsertCheckin(record);
    if (!ok) return null;
    await refreshCheckins();
    // 打卡成功后再派发串接动作
    if (!habit) return [];
    return await dispatchChainActions(habit, record);
  }

  /** 撤销打卡（默认撤销今天）。返回被回滚的链式动作结果，删除失败返回 null */
  async function undoCheckIn(
    habitKey: string,
    date: string = todayStr()
  ): Promise<ChainActionResult[] | null> {
    const habit = habits.value.find((h) => h.key === habitKey);
    // 先取出记录：删掉之后就没有回滚所需的上下文了
    const record = checkins.value.find((c) => c.key === `${habitKey}#${date}`);
    const ok = await habitApi.deleteCheckin(`${habitKey}#${date}`);
    if (!ok) return null;
    await refreshCheckins();
    if (!habit || !record) return [];
    return await rollbackChainActions(habit, record);
  }

  return {
    habits,
    checkins,
    loading,
    today,
    checkedTodayKeys,
    datesByHabit,
    streakByHabit,
    isCheckedToday,
    streakOf,
    load,
    refreshCheckins,
    saveHabit,
    removeHabit,
    toggleHabit,
    checkIn,
    undoCheckIn,
    syncReminders,
  };
});
