import { ref } from "vue";
import { storeToRefs } from "pinia";
import { sysNotify, appNotify } from "../utils/notify";
import useGlobalSetting from "../store/useGlobalSetting";
import usePomodoroRuntime from "../store/usePomodoroRuntime";
import { send } from "../utils/common";
import {
  setupPomodoroBridge,
  requestPomodoroState,
} from "./usePomodoroBridge";

// 番茄钟（多状态提醒）固定 id，对应 useReminder 中播种的 stateful 提醒
const POMODORO_REMINDER_ID = "pomodoro";

// 桥接层：主进程持有时间线并下发状态切换事件，渲染端只负责展示 + 写记录。
// 原「渲染端 setTimeout + 主进程 CronJob 双层舞蹈」已移除——时间线统一由
// 主进程 job.ts 的 stateful 调度引擎持有，从根本上消除「锚点过期/下次变过去」的 bug。
//
// 全局监听已下沉到 usePomodoroBridge（App 启动期注册唯一一次），本 hook 的
// registerGlobalListener / unregisterGlobalListener 仅作兼容委托，避免重复注册。
export function useWorkOrRest() {
  const { setCurStatus, forceWorkTimesC, todayForceWorkTimesC, setTodayForceWorkTimes } = useGlobalSetting();
  const runtime = usePomodoroRuntime();

  // 注册全局侦听：委托给唯一一次的桥接层（幂等，重复调用不会重复注册）
  function registerGlobalListener() {
    setupPomodoroBridge();
  }

  function unregisterGlobalListener() {
    // 桥接为 app 级单例，不应随某个页面卸载而移除（否则主窗口会丢失监听）。
    // 这里仅请求一次状态补偿，确保该页面挂载后能立即拿到当前状态。
    requestPomodoroState();
  }

  // 应用初始化：主进程已根据提醒配置自动排程，此处无需额外启动
  function startApp() {
    // no-op，状态机由主进程驱动
  }

  // 强制回到工作状态（受 useGlobalSetting 的强制次数限制）
  function forceWorkWithTimes(_opts?: any) {
    if (todayForceWorkTimesC.value?.times >= forceWorkTimesC.value) {
      appNotify("提示", "太累了，您不能再继续强制工作");
      sysNotify("提示", "太累了，您不能再继续强制工作", "");
      return;
    }
    setTodayForceWorkTimes((todayForceWorkTimesC.value?.times || 0) + 1);
    send("reminder-force-state", { reminderId: POMODORO_REMINDER_ID, stateKey: "work" });
  }

  // 运行时强制插入一个「非序列状态」（如番茄钟强制锁屏），
  // 结束后自动回到当前序列循环。供首页「开启锁屏」等入口调用。
  function injectState(stateKey: string) {
    send("reminder-inject-state", { reminderId: POMODORO_REMINDER_ID, stateKey });
  }

  // 手动解除一个「被注入的非序列状态」（如强制锁屏）。
  // 主进程按该状态 continueLoop 决定：归位序列继续循环 / 停止整体。供首页「开始工作」调用。
  function endInjectedState() {
    send("reminder-end-injected-state", { reminderId: POMODORO_REMINDER_ID });
  }

  return {
    startApp,
    registerGlobalListener,
    unregisterGlobalListener,
    forceWorkWithTimes,
    injectState,
    endInjectedState,
  };
}
