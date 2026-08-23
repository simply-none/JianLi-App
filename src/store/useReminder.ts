import { computed, onMounted, ref, toRaw, unref } from "vue";
import { defineStore } from "pinia";
import { send } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";

export type ReminderMode = 'time' | 'interval' | 'stateful';
export type ReminderRepeat = 'once' | 'daily' | 'weekly' | 'hourly' | 'monthly' | 'yearly';

// 多状态模式（stateful）中的单个状态节点
export interface ReminderState {
  key: string;          // 状态标识：'work' | 'rest' | 'screen' | 自定义
  label: string;        // 状态显示名
  content?: string;     // 该状态进入时展示的提醒内容（可空）
  duration: number;     // 该状态持续时长数值
  unit: number;         // 时长单位：1000 / 60000 / 3600000
  record?: boolean;     // 进入该状态时是否记录（番茄钟默认记录）
  lockScreen?: boolean; // 进入该状态时是否聚焦/锁屏
  // 是否「序列状态」：
  //  true（默认）→ 参与序列循环（如番茄钟的 work/rest）
  //  false        → 非序列状态，不参与循环；可运行时被强制「插入」当前序列，
  //                  其结束后自动移出并回到插入前的序列状态继续循环（如强制锁屏）
  sequential?: boolean;
  // 仅作用于「非序列状态」：该状态结束后是否继续回到序列循环。
  //  true（默认）→ 结束后自动归位到插入前的序列状态继续循环；
  //  false        → 结束后不再回到序列，番茄钟（stateful 提醒）整体停止。
  //  注：duration 为 0 的非序列状态为「永久」状态，不会自动结束，需手动解除；
  //      解除时即按此字段决定是归位序列还是停止整体。
  continueLoop?: boolean;
}

export interface Reminder {
  id: string;
  mode: ReminderMode;
  title: string;
  content: string;
  enabled: boolean;
  // 开始时间（绝对毫秒时间戳）：该提醒「首次生效/首次进入第 1 个状态」的基准点。
  //  - 周期提醒：下次触发 = startTime + interval×unit×N，向前推到未来；
  //  - 多状态提醒：第 1 个序列状态进入的绝对时刻，之后按各状态间隔推进；
  //  - 定点提醒：不使用 startTime（仅按 cron 值前端推算下次触发，如每天 9:00 → 次日 9:00）。
  //  为 null/0 时表示「立即」：已开启提醒启动时会由主进程填为应用启动时间并持久化。
  startTime?: number | null;

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
  // 多状态模式（stateful）
  states?: ReminderState[]; // 有序状态序列
  loop?: boolean;           // 状态序列是否循环（番茄钟=true）
}

export default defineStore("reminder", () => {
  const reminders = ref<Reminder[]>([]);
  const remindersC = computed(() => reminders.value);

  // 同步完整配置到主进程，由主进程重建定时任务，并双写落库到 reminders 独立表
  function syncToMain() {
    send('update-reminders', toRaw(reminders.value));
  }

  // 持久化：完整配置交给主进程（主进程 applyReminders 会双写 reminders 表 + 重建调度）。
  // 不再写入 basic_info.reminders 字段——每条提醒独立成 reminders 表的一行。
  function persist() {
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
    // 通知主进程从 reminders 表删除该行，并停止其调度
    send('delete-reminder', id);
  }

  function toggleReminder(id: string, enabled: boolean) {
    const item = reminders.value.find(i => i.id === id);
    if (item) {
      item.enabled = enabled;
      persist();
    }
  }

  async function init() {
    // 从主进程 reminders 独立表读取全部提醒（替代旧的 basic_info.reminders 字段）。
    // 用 invoke 异步读取——数据库查询是异步的，sendSync 会拿到空数组导致读不到已落库数据。
    try {
      const stored: Reminder[] = await (window as any).ipcRenderer.invoke('get-reminders') || [];
      if (Array.isArray(stored) && stored.length > 0) {
        reminders.value = stored;
      }
    } catch (e) {
      console.error('读取提醒表失败:', e);
    }
    // 若尚未存在多状态（番茄钟）提醒，则播种默认实例（默认开启），使其并入提醒系统
    seedDefaultPomodoro();
    // 初始化后同步到主进程，恢复已启用的定时提醒（并双写落库）
    syncToMain();
  }

  // 默认番茄钟：工作 35 分钟 → 休息 5 分钟，循环（均为序列状态）。
  // 额外携带一个「强制锁屏」非序列状态（sequential:false）：不参与循环，
  // 仅由首页「开启锁屏」按钮运行时注入，结束后自动回到 work/rest 循环。
  function seedDefaultPomodoro() {
    const pomodoro = reminders.value.find(r => r.mode === 'stateful');
    if (pomodoro) {
      // 历史数据可能缺少 startTime 字段（旧版本 seed 尚未引入），会导致每次启动
      // 主进程把「开始时间」当作应用启动时间、番茄钟每轮从头开始。这里补回锚点。
      if (!pomodoro.startTime || isNaN(pomodoro.startTime)) {
        pomodoro.startTime = Date.now();
        persist();
      }
      return;
    }
    const seed: Reminder = {
      id: 'pomodoro',
      mode: 'stateful',
      title: '番茄钟',
      content: '',
      enabled: true,
      // startTime 作为第 1 个序列状态（work）进入的绝对时刻基准；
      // 这里取「当前时间对齐到整分钟」作为首次起点，引擎会按此锚点推进，
      // 若已过期则向前推到下一轮未来时刻，避免「下次提醒早已过去」。
      startTime: Date.now(),
      loop: true,
      states: [
        { key: 'work', label: '工作', content: '', duration: 35, unit: 60 * 1000, record: true, sequential: true },
        { key: 'rest', label: '休息', content: '', duration: 5, unit: 60 * 1000, record: true, sequential: true },
        // 非序列状态：强制锁屏。lockScreen=true 让进入时聚焦/锁屏；
        // sequential=false 使其不进入循环序列，仅可运行时注入；
        // duration=0 表示「永久」生效（不会自动结束），需手动解除；
        // continueLoop=true 解除后自动归位到插入前的 work/rest 序列继续循环。
        { key: 'lock', label: '强制锁屏', content: '已开启强制锁屏，请输入密码解除', duration: 0, unit: 1000, record: false, lockScreen: true, sequential: false, continueLoop: true },
      ],
    };
    reminders.value.push(seed);
    persist();
  }

  function $reset() {
    init();
  }

  onMounted(() => {
    init();
    // 监听主进程回填的「开始时间」（启动时对未设 startTime 的已开启提醒，
    // 用应用启动时间作为开始时间并回写，保证下一轮仍从此基准起算）
    window.ipcRenderer.on('reminder-starttime-updated', (_e: any, payload: { id: string; startTime: number }) => {
      const item = reminders.value.find(i => i.id === payload.id);
      if (item && item.startTime !== payload.startTime) {
        item.startTime = payload.startTime;
        persist();
      }
    });
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
