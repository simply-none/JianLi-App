import { send } from "@/utils/common";
import useTipsRuntime from "@/store/useTipsRuntime";
import useGlobalSetting from "@/store/useGlobalSetting";

// 多状态提醒（番茄钟）全局桥接层。
//
// 时间线由主进程 newReminder.ts 持有，通过：
//  - tips-state-change（channel A：状态进入=提醒到了）→ 刷 UI + 写 pomodoro_status 记录 + 弹通知（通知在 App.vue）
//  - tips-state-sync（channel B：补偿/恢复/停止）→ 仅刷 UI，不写记录、不弹通知
// 两条通道下发。本桥接在 App 启动期注册「唯一一次」全局监听，统一写入 useTipsRuntime +
// useGlobalSetting 的 curStatus，所有页面只消费 store，不再各自注册监听。

let listenerRegistered = false;
let stateChangeListener: ((e: any, arg: any) => void) | null = null;
let stateSyncListener: ((e: any, arg: any) => void) | null = null;

// 第二窗口（番茄钟小窗 / 迷你窗）只消费 store 刷 UI，不写 pomodoro_status 记录（避免重复落库），通知由主窗口负责
const isSecondWindow =
  typeof location !== "undefined" && location.href.includes("isSecondWindow=true");

// 状态进入事件（channel A）→ 刷 UI + 写记录
function handleStateEnter(_e: any, arg: any) {
  if (!arg || !arg.reminderId) return;
  const runtime = useTipsRuntime();
  runtime.applyPayload(arg);
  if (isSecondWindow) return;
  const { setCurStatus } = useGlobalSetting();
  // 仅「允许记录」(recordable !== false) 的状态才落库（强制锁屏 record=0 不记）
  const shouldRecord = arg.recordable !== false;
  setCurStatus({ label: arg.stateLabel, value: arg.stateKey }, shouldRecord);
}

// 状态同步事件（channel B）→ 仅刷 UI
function handleStateSync(_e: any, arg: any) {
  if (!arg || !arg.reminderId) return;
  useTipsRuntime().applyPayload(arg);
}

// App 启动期调用：注册唯一一次全局监听 + 补偿启动竞态首帧
export function setupTipsBridge() {
  if (listenerRegistered) return;
  stateChangeListener = handleStateEnter;
  window.ipcRenderer.on("tips-state-change", stateChangeListener);
  stateSyncListener = handleStateSync;
  window.ipcRenderer.on("tips-state-sync", stateSyncListener);
  // 补偿启动竞态：主动拉取当前状态（幂等）
  send("request-tips-state", { reminderId: "pomodoro" });
  listenerRegistered = true;
}

// 移除本桥接的监听
export function teardownTipsBridge() {
  if (stateChangeListener) {
    window.ipcRenderer.removeAllListeners("tips-state-change");
    stateChangeListener = null;
  }
  if (stateSyncListener) {
    window.ipcRenderer.removeAllListeners("tips-state-sync");
    stateSyncListener = null;
  }
  listenerRegistered = false;
}

// 主动请求主进程补偿一次当前状态（页面挂载后调用，幂等安全）
export function requestTipsState(reminderId = "pomodoro") {
  send("request-tips-state", { reminderId });
}
