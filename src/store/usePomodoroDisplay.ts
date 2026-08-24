import { computed, ref } from "vue";
import { defineStore } from "pinia";
import useTipsRuntime from "@/store/useTipsRuntime";
import useNewReminder from "@/store/useNewReminder";

/**
 * 番茄钟展示数据「转发适配层」。
 *
 * 旧 home 主题组件直接消费 useWorkOrRestStore 的 nextWorkTime / nextRestTime /
 * workTimeGap / restTimeGap / workTimeGapUnit / restTimeGapUnit 等字段。
 * 这些字段本质是「由运行时 nextStateTime 派生 + 由内置番茄钟 states 配置提供」，
 * 本 store 按它们所需的字段名与格式对外暴露，使 13 个 home 组件只需把 import 路径
 * 从 '@/store/useWorkOrReset' 改为 '@/store/usePomodoroDisplay'，逻辑零改动。
 */
const usePomodoroDisplay = defineStore("pomodoro-display", () => {
  const runtime = useTipsRuntime();
  const reminderStore = useNewReminder();

  // 内置番茄钟（多状态提醒）配置
  const pomodoro = computed(() =>
    reminderStore.reminders.find((r: any) => r.id === "pomodoro" && r.mode === "stateful")
  );

  const formatNext = (t: number | null) =>
    t ? new Date(t).toLocaleString("zh", { hour12: false }) : "--";

  // 下一状态权威时间（主进程算好下发），旧组件按 curStatus 自行展示其一
  const nextWorkTime = computed(() => formatNext(runtime.nextStateTime));
  const nextRestTime = computed(() => formatNext(runtime.nextStateTime));

  // 由番茄钟 states 配置派生（states[0]=工作, states[1]=休息）
  const workTimeGap = computed(() => Number(pomodoro.value?.states?.[0]?.duration) || 35);
  const workTimeGapUnit = computed(() => Number(pomodoro.value?.states?.[0]?.unit) || 60 * 1000);
  const restTimeGap = computed(() => Number(pomodoro.value?.states?.[1]?.duration) || 5);
  const restTimeGapUnit = computed(() => Number(pomodoro.value?.states?.[1]?.unit) || 60 * 1000);

  // 遗留配置 ref（仅用于同步到其它窗口，值不重要）
  const startWorkTime = ref<number | null>(null);
  const closeWorkTime = ref<number | null>(null);

  const workTimeGapC = computed(() => workTimeGap.value);
  const workTimeGapUnitC = computed(() => workTimeGapUnit.value);
  const restTimeGapC = computed(() => restTimeGap.value);
  const restTimeGapUnitC = computed(() => restTimeGapUnit.value);
  const startWorkTimeC = computed(() => startWorkTime.value);
  const closeWorkTimeC = computed(() => closeWorkTime.value);

  return {
    workTimeGap,
    restTimeGap,
    workTimeGapUnit,
    restTimeGapUnit,
    startWorkTime,
    closeWorkTime,
    nextWorkTime,
    nextRestTime,
    workTimeGapC,
    restTimeGapC,
    workTimeGapUnitC,
    restTimeGapUnitC,
    startWorkTimeC,
    closeWorkTimeC,
  };
});

export default usePomodoroDisplay;
