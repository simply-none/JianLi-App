import { send } from "@/utils/common";
import usePomodoroRuntime from "@/store/usePomodoroRuntime";
import useGlobalSetting from "@/store/useGlobalSetting";
import { appNotify } from "@/utils/notify";

// 番茄钟（多状态提醒）全局桥接层。
//
// 背景：番茄钟的「当前状态 / 下次切换」时间线由主进程 job.ts 的 stateful 调度引擎持有，
// 通过 ipc 'reminder-state-change' 事件权威下发。渲染端只负责展示 + 写记录。
//
// 历史问题：事件监听分散在各页面各自 ipcRenderer.on（useOpenWindow / reminder 列表页），
// 漏注册的页面（如 setting 番茄钟设置卡片）永远收不到状态 → 显示「未开始」。
//
// 本桥接在 App 启动期注册「唯一一次」全局监听，统一写入 usePomodoroRuntime + curStatusC，
// 并主动 request-reminder-state 补偿启动竞态首帧。所有页面只消费 store，不再各自注册监听，
// 从根上消除「某页面漏注册导致状态空白」的 bug。
//
// 设计：模块级单例，setup 幂等（重复调用只注册一次）；teardown 反向只移除本桥接的引用。

let listenerRegistered = false;
let stateChangeListener: ((e: any, arg: any) => void) | null = null;
let bootNoticeListener: ((e: any, arg: any) => void) | null = null;

// 主进程下发的「启动轮次提示」事件 → 系统通知
function handleBootNotice(_e: any, arg: any) {
  if (!arg || !arg.type) return;
  if (arg.type === 'continue') {
    appNotify('番茄钟', arg.message || '上一轮次未结束，现在将继续上一轮番茄钟。', 5000);
  } else if (arg.type === 'deferred') {
    appNotify('番茄钟', arg.message || '上一轮番茄钟已结束，30 秒后将开始新的轮次。', 6000);
  }
}

// 主进程下发的状态事件 → 写入运行时 store + 全局当前状态
function handleStateChange(_e: any, arg: any) {
  if (!arg || !arg.reminderId) return;
  const runtime = usePomodoroRuntime();
  const { setCurStatus } = useGlobalSetting();
  // 权威「下次切换 / 当前状态起点」由主进程算好随事件下发
  runtime.setNextStateTime(arg.nextTime ?? null);
  runtime.setStateStartTime(arg.stateStartTime ?? null);
  runtime.setActiveId(arg.reminderId);
  runtime.setCurrentStateKey(arg.stateKey ?? "");
  // 扩展字段：供 reminder 列表页展示「下一个状态 / 注入态 / 停止态」
  runtime.setStateLabel(arg.stateLabel ?? "");
  runtime.setNextStateLabel(arg.nextStateLabel ?? null);
  runtime.setInjected(!!arg.injected);
  runtime.setStopped(!!arg.stopped);
  // setCurStatus 会写入 pomodoro_status 记录，保留番茄钟记录功能
  setCurStatus({ label: arg.stateLabel, value: arg.stateKey });
}

// App 启动期调用：注册唯一一次全局监听 + 补偿启动竞态首帧
export function setupPomodoroBridge() {
  if (listenerRegistered) return;
  stateChangeListener = handleStateChange;
  window.ipcRenderer.on("reminder-state-change", stateChangeListener);
  bootNoticeListener = handleBootNotice;
  window.ipcRenderer.on("reminder-boot-notice", bootNoticeListener);
  // 补偿启动竞态：渲染端可能错过主进程首帧 state-change，主动拉取当前状态
  send("request-reminder-state", {});
  listenerRegistered = true;
}

// 应用退出 / 测试场景调用：移除本桥接的监听（不影响其它方独立注册的监听）
export function teardownPomodoroBridge() {
  if (stateChangeListener) {
    window.ipcRenderer.removeListener("reminder-state-change", stateChangeListener);
    stateChangeListener = null;
  }
  if (bootNoticeListener) {
    window.ipcRenderer.removeListener("reminder-boot-notice", bootNoticeListener);
    bootNoticeListener = null;
  }
  listenerRegistered = false;
}

// 主动请求主进程补偿一次当前状态（页面挂载后调用，幂等安全）
export function requestPomodoroState() {
  send("request-reminder-state", {});
}
