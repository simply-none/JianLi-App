import { defineStore } from "pinia";
import { ref } from "vue";

// 番茄钟（多状态提醒）的运行时状态：由主进程下发，渲染端只做展示与记录。
// 时间线完全由主进程持有，nextStateTime 永远是权威的「下次切换」时间戳，
// 因此界面绝不会再显示「过去的时间」。
export default defineStore("pomodoro-runtime", () => {
  // 下次状态切换的权威时间（ms 时间戳），null 表示序列已结束
  const nextStateTime = ref<number | null>(null);
  // 当前状态开始时间（ms 时间戳），用于进度条
  const stateStartTime = ref<number | null>(null);
  // 当前多状态提醒 id（番茄钟固定为 'pomodoro'）
  const activeId = ref<string>("");
  // 当前状态 key（work/rest/screen/自定义）
  const currentStateKey = ref<string>("");
  // 当前状态显示名（如「工作」「休息」），供列表页展示
  const stateLabel = ref<string>("");
  // 下一状态显示名（如「休息」），供列表页展示「下一个状态：X」
  const nextStateLabel = ref<string | null>(null);
  // 当前是否处于「被注入的非序列状态」（如强制锁屏）
  const injected = ref<boolean>(false);
  // 番茄钟是否已停止（endInjectedState 下发 stopped 时置位）
  const stopped = ref<boolean>(false);

  function setNextStateTime(t: number | null) {
    nextStateTime.value = t;
  }
  function setStateStartTime(t: number | null) {
    stateStartTime.value = t;
  }
  function setActiveId(id: string) {
    activeId.value = id;
  }
  function setCurrentStateKey(key: string) {
    currentStateKey.value = key;
  }
  function setStateLabel(label: string) {
    stateLabel.value = label;
  }
  function setNextStateLabel(label: string | null) {
    nextStateLabel.value = label;
  }
  function setInjected(v: boolean) {
    injected.value = v;
  }
  function setStopped(v: boolean) {
    stopped.value = v;
  }

  return {
    nextStateTime,
    stateStartTime,
    activeId,
    currentStateKey,
    stateLabel,
    nextStateLabel,
    injected,
    stopped,
    setNextStateTime,
    setStateStartTime,
    setActiveId,
    setCurrentStateKey,
    setStateLabel,
    setNextStateLabel,
    setInjected,
    setStopped,
  };
});
