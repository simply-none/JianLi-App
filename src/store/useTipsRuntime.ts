import { defineStore } from "pinia";
import { ref } from "vue";

// 多状态提醒（番茄钟等）运行时 store 工厂。
// 每条 stateful 提醒（以 reminderId 区分）拥有独立 store 实例，互相不覆盖，可并行运行
// （番茄钟 + 喝水 + 习惯… 同时跑互不干扰）。时间线完全由主进程持有，
// nextStateTime 永远是权威的「下次切换」时间戳，因此界面绝不会再显示「过去的时间」。

// setup 工厂：每条提醒共用同一份 state 形状，仅 activeId / reset 需要 id 入参
function createRuntimeStoreBody(id: string) {
  // 下次状态切换的权威时间（ms 时间戳），null 表示序列已结束
  const nextStateTime = ref<number | null>(null);
  // 当前状态开始时间（ms 时间戳），用于进度条
  const stateStartTime = ref<number | null>(null);
  // 当前多状态提醒 id
  const activeId = ref<string>(id);
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
  // 是否处于「空闲中（免打扰）」：由主进程在空闲时段内下发 idle:true 同步，UI 据此展示已暂停
  const idle = ref<boolean>(false);

  function setNextStateTime(t: number | null) {
    nextStateTime.value = t;
  }
  function setStateStartTime(t: number | null) {
    stateStartTime.value = t;
  }
  function setActiveId(v: string) {
    activeId.value = v;
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
  function setIdle(v: boolean) {
    idle.value = v;
  }

  // 主进程下发的状态 payload 写入运行时（A/B 通道共用）
  function applyPayload(arg: any) {
    if (!arg) return;
    setNextStateTime(arg.nextTime ?? null);
    setStateStartTime(arg.stateStartTime ?? null);
    setActiveId(arg.reminderId ?? id);
    setCurrentStateKey(arg.stateKey ?? "");
    setStateLabel(arg.stateLabel ?? "");
    setNextStateLabel(arg.nextStateLabel ?? null);
    setInjected(!!arg.injected);
    setStopped(!!arg.stopped);
    // idle 仅在主进程显式下发 idle:true 时置位；其余 payload（含 idle:false，正常状态流转）复位为空闲中标记
    setIdle(!!arg.idle);
  }

  function resetRuntime() {
    nextStateTime.value = null;
    stateStartTime.value = null;
    activeId.value = id;
    currentStateKey.value = "";
    stateLabel.value = "";
    nextStateLabel.value = null;
    injected.value = false;
    stopped.value = false;
    idle.value = false;
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
    idle,
    setNextStateTime,
    setStateStartTime,
    setActiveId,
    setCurrentStateKey,
    setStateLabel,
    setNextStateLabel,
    setInjected,
    setStopped,
    setIdle,
    applyPayload,
    resetRuntime,
  };
}

// 番茄钟（内置）作为规范化 store：既用于类型推导，也直接作为 pomodoro 实例，
// 避免重复 defineStore 同 id 引发的注册冲突。
const usePomodoroStore = defineStore("tips-runtime-pomodoro", () =>
  createRuntimeStoreBody("pomodoro")
);
// 所有提醒共用同一份 state 形状，实例类型一致
type TipsRuntimeStore = ReturnType<typeof usePomodoroStore>;

const runtimeCache: Record<string, any> = {};

// 取（或惰性创建）某条提醒的运行时 store 实例。id 缺省回退到内置番茄钟。
// 注意：pomodoro 始终走规范化 usePomodoroStore，保证 useTipsRuntime() 与 useRuntime('pomodoro') 是同一实例。
// 返回类型用 any：动态 id 的 store 实例泛型含具体 id，彼此不兼容；字段访问对调用方足够，别名再收窄为强类型。
export function useRuntime(id: string = "pomodoro"): any {
  if (!id) id = "pomodoro";
  if (!runtimeCache[id]) {
    if (id === "pomodoro") {
      runtimeCache[id] = usePomodoroStore();
    } else {
      const useStore = defineStore("tips-runtime-" + id, () =>
        createRuntimeStoreBody(id)
      );
      runtimeCache[id] = useStore();
    }
  }
  return runtimeCache[id];
}

// 向后兼容别名：历史所有 useTipsRuntime() 调用（番茄钟专属展示）继续指向内置番茄钟实例，零改动。
export default function useTipsRuntime(): TipsRuntimeStore {
  return useRuntime("pomodoro") as TipsRuntimeStore;
}
