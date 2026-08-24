import { defineStore } from "pinia";
import { ref } from "vue";

// 多状态提醒（番茄钟）的运行时状态：由主进程下发，渲染端只做展示与记录。
// 时间线完全由主进程持有，nextStateTime 永远是权威的「下次切换」时间戳，
// 因此界面绝不会再显示「过去的时间」。
export default defineStore("tips-runtime", () => {
  // 下次状态切换的权威时间（ms 时间戳），null 表示序列已结束
  const nextStateTime = ref<number | null>(null);
  // 当前状态开始时间（ms 时间戳），用于进度条
  const stateStartTime = ref<number | null>(null);
  // 当前多状态提醒 id
  const activeId = ref<string>("");
  // 当前状态 key（work/rest/lock/自定义）
  const currentStateKey = ref<string>("");
  // 当前状态显示名
  const stateLabel = ref<string>("");
  // 下一状态显示名
  const nextStateLabel = ref<string | null>(null);
  // 当前是否处于「被注入的非序列状态」
  const injected = ref<boolean>(false);
  // 是否已停止
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

  // 主进程下发的状态 payload 写入运行时（A/B 通道共用）
  function applyPayload(arg: any) {
    if (!arg) return;
    setNextStateTime(arg.nextTime ?? null);
    setStateStartTime(arg.stateStartTime ?? null);
    setActiveId(arg.reminderId ?? "");
    setCurrentStateKey(arg.stateKey ?? "");
    setStateLabel(arg.stateLabel ?? "");
    setNextStateLabel(arg.nextStateLabel ?? null);
    setInjected(!!arg.injected);
    setStopped(!!arg.stopped);
  }

  function resetRuntime() {
    nextStateTime.value = null;
    stateStartTime.value = null;
    activeId.value = "";
    currentStateKey.value = "";
    stateLabel.value = "";
    nextStateLabel.value = null;
    injected.value = false;
    stopped.value = false;
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
    applyPayload,
    resetRuntime,
  };
});
