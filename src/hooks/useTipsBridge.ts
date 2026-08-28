import { send } from "@/utils/common";
import { useRuntime } from "@/store/useTipsRuntime";
import useGlobalSetting from "@/store/useGlobalSetting";
import useNewReminder from "@/store/useNewReminder";
import { watch } from "vue";

// 多状态提醒全局桥接层。
//
// 时间线由主进程 newReminder.ts 持有，通过：
//  - tips-state-change（channel A：状态进入=提醒到了）→ 刷 UI + 写记录 + 弹通知（通知在 App.vue）
//  - tips-state-sync（channel B：补偿/恢复/停止）→ 仅刷 UI，不写记录、不弹通知
// 两条通道下发。本桥接在 App 启动期注册「唯一一次」全局监听，按 reminderId 路由到各自独立的
// useRuntime(id) 实例，所有页面只消费对应 store，不再各自注册监听。
//
// 落库约束（需求约定）：仅番茄钟（id='pomodoro'）的多状态记录写入 pomodoro_status 表；
// 其余提醒（定点/周期/其他多状态提醒）一律不落库。

let listenerRegistered = false;
let stateChangeListener: ((e: any, arg: any) => void) | null = null;
let stateSyncListener: ((e: any, arg: any) => void) | null = null;

// 第二窗口（番茄钟小窗 / 迷你窗）只消费 store 刷 UI，不写 pomodoro_status 记录（避免重复落库），通知由主窗口负责
const isSecondWindow =
  typeof location !== "undefined" && location.href.includes("isSecondWindow=true");

// 仅番茄钟写库：其余提醒不落库（需求约定）
function shouldPersist(arg: any): boolean {
  return arg?.reminderId === "pomodoro";
}

// 状态进入事件（channel A：状态切换 / 强制锁屏注入等）→ 刷 UI + 写记录
function handleStateEnter(_e: any, arg: any) {
  if (!arg || !arg.reminderId) return;
  const runtime = useRuntime(arg.reminderId);
  runtime.applyPayload(arg);
  if (isSecondWindow) return;
  // 仅番茄钟落库；小窗只刷 UI（避免主/小窗双写）。
  if (!shouldPersist(arg)) return;
  const { setCurStatus } = useGlobalSetting();
  // 三个状态（工作 / 休息 / 强制锁屏）一律记录；其余自定义状态沿用 recordable 标记 opt-out。
  // arg.stateStartTime 为主进程算出的「真实进入时刻」，作为记录起点（而非渲染端 moment()）。
  const shouldRecord = arg.stateKey === "lock" ? true : arg.recordable !== false;
  setCurStatus({ label: arg.stateLabel, value: arg.stateKey }, shouldRecord, arg.stateStartTime);
}

// 状态同步事件（channel B：启动补偿 / 编辑重算 / 主动请求 / 空闲中）→ 刷 UI + 补记「当前运行段」起点
function handleStateSync(_e: any, arg: any) {
  if (!arg || !arg.reminderId) return;
  const runtime = useRuntime(arg.reminderId);
  runtime.applyPayload(arg);
  // 空闲中（免打扰）同步：仅刷新 UI 标记，不写记录、不落库
  if (arg.idle) return;
  // 小窗只消费 runtime 刷 UI，不写 curStatus / 不落库（与 handleStateEnter 一致）。
  if (isSecondWindow) return;
  if (!arg || typeof arg.stateKey !== "string") return;
  // 其余提醒不落库
  if (!shouldPersist(arg)) return;
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

// 补偿启动竞态：请求所有「已启用 + stateful」提醒的当前状态（含内置番茄钟）。
// 提醒表异步加载完成后会再次触发，覆盖启动时尚不存在的自定义提醒。
const requestedIds = new Set<string>();
function requestAllTipsStates() {
  const store = useNewReminder();
  const ids = store.reminders
    .filter((r: any) => r.mode === "stateful" && r.enabled)
    .map((r: any) => r.id);
  if (!ids.includes("pomodoro")) ids.unshift("pomodoro"); // 内置番茄钟始终补偿
  ids.forEach((id: string) => {
    if (!requestedIds.has(id)) {
      requestedIds.add(id);
      send("request-tips-state", { reminderId: id });
    }
  });
}

// App 启动期调用：注册唯一一次全局监听 + 补偿启动竞态首帧
export function setupTipsBridge() {
  if (listenerRegistered) return;
  stateChangeListener = handleStateEnter;
  window.ipcRenderer.on("tips-state-change", stateChangeListener);
  stateSyncListener = handleStateSync;
  window.ipcRenderer.on("tips-state-sync", stateSyncListener);
  // 补偿启动竞态：主动拉取当前状态（幂等）
  requestAllTipsStates();
  // 提醒表异步加载 / 后续新增启用的 stateful 提醒，补请求其当前状态
  const reminderStore = useNewReminder();
  watch(
    () => reminderStore.reminders,
    () => requestAllTipsStates(),
    { deep: true }
  );
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
