import { ref } from "vue";
import { sysNotify, appNotify } from "@/utils/notify";
import useGlobalSetting from "@/store/useGlobalSetting";
import useNewReminder from "@/store/useNewReminder";
import { send } from "@/utils/common";
import { setupTipsBridge, requestTipsState } from "@/hooks/useTipsBridge";

/**
 * 全新「多状态提醒」控制器（不是旧 useWorkOrRest 的拷贝）。
 *
 * 番茄钟只是多状态提醒类型下的一个系统内置数据（id='pomodoro'），不再是独立子系统。
 * 本模块负责：把 UI 的动作翻译成主进程 newReminder.ts 的 tips-* 控制通道，
 * 并为需要番茄钟展示数据的模块（小窗口、home 主题组件）提供转发。
 */
export function useTipsActions() {
  const { setCurStatus, forceWorkTimesC, todayForceWorkTimesC, setTodayForceWorkTimes } = useGlobalSetting();
  const reminderStore = useNewReminder();

  // 应用初始化：状态机由主进程驱动，此处无需额外启动
  function startApp() {
    // no-op
  }

  // 注册全局侦听（委托给唯一一次的桥接层，幂等）
  function registerGlobalListener() {
    setupTipsBridge();
  }

  function unregisterGlobalListener() {
    requestTipsState();
  }

  // 主动请求某条 stateful 提醒的当前状态
  function requestState(reminderId = "pomodoro") {
    requestTipsState(reminderId);
  }

  // 强制切换多状态提醒到指定状态（如快捷键强制回到工作）
  function forceToState(reminderId: string, stateKey: string) {
    send("tips-force-state", { reminderId, stateKey });
  }

  // 运行时强制注入一个非序列状态（如强制锁屏）
  function injectState(reminderId: string, stateKey: string) {
    send("tips-inject-state", { reminderId, stateKey });
  }

  // 手动解除一个被注入的非序列状态（如强制锁屏）
  function endInjectedState(reminderId: string) {
    send("tips-end-injected-state", { reminderId });
  }

  // 番茄钟（多状态 stateful 提醒）：强制切回工作状态，受每日强制次数限制。
  // 新提醒系统下走 tips-force-state 通道 → 主进程 forceReminderState 强制进入 work 状态，
  // 主进程会重置 startedAt 并开始该状态计时（即开始新一轮工作，对应 isUpdateStartTime 语义）。
  function forceWorkWithTimes(_options?: { isUpdateStartTime?: boolean }) {
    if (todayForceWorkTimesC.value?.times >= forceWorkTimesC.value) {
      appNotify("提示", "太累了，您不能再继续强制工作");
      sysNotify("提示", "太累了，您不能再继续强制工作", "");
      return;
    }
    setTodayForceWorkTimes((todayForceWorkTimesC.value?.times || 0) + 1);
    forceToState("pomodoro", "work");
  }

  // 番茄钟设置卡片：把工作/休息时长写回 stateful 提醒的 states，并同步主进程重建调度
  function savePomodoroStates(states: any[]) {
    const p = reminderStore.reminders.find((r: any) => r.id === "pomodoro" && r.mode === "stateful");
    if (!p) return;
    reminderStore.saveReminder({ ...p, states });
  }

  // 锁屏相关（修复旧系统 startScreenSaverFn/closeScreenSaverFn 未定义的 bug）：
  // 开启锁屏 = 注入 lock 非序列状态；关闭锁屏 = 解除注入态
  function startScreenSaverFn() {
    injectState("pomodoro", "lock");
  }
  function closeScreenSaverFn() {
    endInjectedState("pomodoro");
  }

  return {
    startApp,
    registerGlobalListener,
    unregisterGlobalListener,
    requestState,
    forceToState,
    injectState,
    endInjectedState,
    forceWorkWithTimes,
    savePomodoroStates,
    startScreenSaverFn,
    closeScreenSaverFn,
  };
}
