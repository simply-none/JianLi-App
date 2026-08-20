import { computed, onMounted, ref, toRaw, unref } from "vue";
import { defineStore } from "pinia";
import { setStore, send } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

export type ReminderMode = 'time' | 'interval';
export type ReminderRepeat = 'once' | 'daily' | 'weekly' | 'hourly' | 'monthly' | 'yearly';

export interface Reminder {
  id: string;
  mode: ReminderMode;
  title: string;
  content: string;
  enabled: boolean;
  // 定点模式
  time?: string;        // "HH:mm"
  repeat?: ReminderRepeat;
  date?: string;        // repeat='once' 时："YYYY-MM-DD"
  weekDays?: number[];  // repeat='weekly' 时：[0-6]，0=周日
  minute?: number;      // repeat='hourly' 时：0-59
  dayOfMonth?: number;  // repeat='monthly'/'yearly' 时：1-31
  month?: number;       // repeat='yearly' 时：1-12
  // 周期模式
  interval?: number;    // 间隔数值
  unit?: number;        // 1000 / 60000 / 3600000
  // 提醒结束后是否跳转到「主题对话」记录当前情绪
  recordAfter?: boolean;
}

export default defineStore("reminder", () => {
  const reminders = ref<Reminder[]>([]);
  const remindersC = computed(() => reminders.value);

  // 同步完整配置到主进程，由主进程重建定时任务
  function syncToMain() {
    send('update-reminders', toRaw(reminders.value));
  }

  function persist() {
    setStore("reminders", toRaw(reminders.value));
    syncToMain();
  }

  function setReminders(val: Reminder[]) {
    reminders.value = toRaw(unref(val));
    persist();
  }

  function addReminder(item: Reminder) {
    reminders.value.push(item);
    persist();
  }

  function updateReminder(item: Reminder) {
    const idx = reminders.value.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      reminders.value.splice(idx, 1, item);
      persist();
    }
  }

  function deleteReminder(id: string) {
    reminders.value = reminders.value.filter(i => i.id !== id);
    persist();
  }

  function toggleReminder(id: string, enabled: boolean) {
    const item = reminders.value.find(i => i.id === id);
    if (item) {
      item.enabled = enabled;
      persist();
    }
  }

  function init() {
    const objectVars: defaultField[] = [
      { field: 'reminders', default: [], map: reminders },
    ];
    initPiniaStatus(objectVars);
    // 初始化后同步到主进程，恢复已启用的定时提醒
    syncToMain();
  }

  function $reset() {
    init();
  }

  onMounted(() => {
    init();
  });

  return {
    reminders,
    remindersC,
    setReminders,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleReminder,
    $reset,
  };
});
