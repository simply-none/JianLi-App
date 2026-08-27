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

// 状态进入事件（channel A：状态切换 / 强制锁屏注入等）→ 刷 UI + 写记录
function handleStateEnter(_e: any, arg: any) {
  if (!arg || !arg.reminderId) return;
  const runtime = useTipsRuntime();
  runtime.applyPayload(arg);
  if (isSecondWindow) return;
  const { setCurStatus } = useGlobalSetting();
  // 仅主窗口落库；小窗只刷 UI（避免主/小窗双写）。
  // 三个状态（工作 / 休息 / 强制锁屏）一律记录；其余自定义状态沿用 recordable 标记 opt-out。
  // arg.stateStartTime 为主进程算出的「真实进入时刻」，作为记录起点（而非渲染端 moment()）。
  const shouldRecord = arg.stateKey === "lock" ? true : arg.recordable !== false;
  setCurStatus({ label: arg.stateLabel, value: arg.stateKey }, shouldRecord, arg.stateStartTime);
}

// 状态同步事件（channel B：启动补偿 / 编辑重算 / 主动请求 / 空闲中）→ 刷 UI + 补记「当前运行段」起点
function handleStateSync(_e: any, arg: any) {
  if (!arg || !arg.reminderId) return;
  const runtime = useTipsRuntime();
  runtime.applyPayload(arg);
  // 空闲中（免打扰）同步：仅刷新 UI 标记，不写记录、不落库
  if (arg.idle) return;
  // 小窗只消费 runtime 刷 UI，不写 curStatus / 不落库（与 handleStateEnter 一致）。
  if (isSecondWindow) return;
  if (!arg || typeof arg.stateKey !== "string") return;
  const { setCurStatus } = useGlobalSetting();

  // 带权威开始时刻且非「停止」广播，且开始时刻不晚于当前（排除未来首轮占位）→
  // 既是刷新展示，也是「补记当前运行段的起点」：应用在状态开始后才启动，这段已运行时长
  // 也能计入统计（此前通道 B 从不记录，导致整段缺失）。去重在主进程按「开始时刻」合并，重复补偿不会写多条。
  if (arg.stateStartTime && !arg.stopped && Number(arg.stateStartTime) <= Date.now()) {
    const shouldRecord = arg.stateKey === "lock" ? true : arg.recordable !== false;
    setCurStatus({ label: arg.stateLabel, value: arg.stateKey }, shouldRecord, arg.stateStartTime);
    return;
  }
  // 其余同步（如停止广播、未来首轮占位、无开始时刻）→ 仅刷 UI 不落库
  setCurStatus({ label: arg.stateLabel, value: arg.stateKey }, false);
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
