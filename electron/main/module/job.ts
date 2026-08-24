import { ipcMain, BrowserWindow } from "electron";
import { CronJob } from "cron";
import momemt from "moment";
import { win, hideApp, focusAppToTop, showApp, isMainWindowVisible } from "./mainWindow.ts";
import { createOtherWindow, closeOtherWindow, hideOtherWindow, showOtherWindow } from "./newWindow.ts";
import { queryByConditions, upsertData, deleteData, reminderTable } from "../utils/sql.ts";
import { myDb } from "./sql.ts";
import { tableName } from "./store.ts";

let job = {
  // 工作/休息定时器
  workOrRest: null,
};
// 停止job
let sJob = {

}

// 番茄钟状态事件广播：主窗口与所有小窗口（番茄钟迷你窗、其它 secondWindow）都需要收到，
// 否则独立渲染进程的小窗口永远收不到权威状态 → 倒计时卡在「同步中」。
// 用 getAllWindows 覆盖主窗口 + 全部 childWindow，避免小窗口漏收。
function broadcastStateChange(payload: any) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w && !w.isDestroyed() && w.webContents) {
      w.webContents.send('reminder-state-change', payload);
    }
  }
}

export function createJob({
  win,
  time = 5 * 60 * 1000,
  onTick = () => {},
  isTick = true,
  msgName = "tip-job",
  type = 'workOrRest',
}) {
  if (job[type]) {
    stopJob(type);
  }
  let jobTime = time;
  if (jobTime < 5 * 1000) jobTime = 5 * 1000;

  const currentSecondTime = new Date().getSeconds();
  const currentMinuteTime = new Date().getMinutes();
  console.log(currentSecondTime, jobTime);
  const nextRunTime = momemt().add(jobTime, "milliseconds").toDate();

  try {
    job[type] = new CronJob(
      nextRunTime, // cronTime
      function () {
        onTick();
        if (!isTick) return;
        win?.webContents.send(msgName, Date.now() + 1000);
      }, // onTick
      null, // onComplete
      true, // start
      'Asia/Shanghai' // timeZone
    );
  } catch (error) {
    let truthMsg = error.message || error.toString();
    if (truthMsg.includes("Date in past")) {
      // 如果是过去的时间，则直接执行
      onTick();
      if (!isTick) return;
      win?.webContents.send(msgName, Date.now() + 1000);
    } else {
      throw error;
    }
  }
}

export function stopJob(type?: string) {
  if (!type) {
    // 清除所有的job
    for (const key in job) {
      if (Object.prototype.hasOwnProperty.call(job, key)) {
        stopJob(key);
      }
    }
  } else {
    job[type]?.stop();
    job[type] = null;
    delete job[type];
  }
}

// 定时提醒任务管理
let reminderJobs: Record<string, CronJob> = {};

// 多状态（stateful）提醒的运行时状态
//  index       : 当前所处状态在 states 中的索引
//  startedAt   : 当前状态实际进入时间（用于 UI 倒计时基准）
//  cycleStart  : 本轮周期锚点（第 1 个序列状态进入的绝对时刻），所有状态间隔都以此为基准推算；
//                默认取 reminder.startTime，过期则向前推到未来首轮起点
//  injected    : 若存在，表示当前正处于「被强制插入的非序列状态」，
//                resumeIndex 记录插入前的序列位置，非序列状态结束后据此归位
let statefulRuntime: Record<string, { reminder: any; index: number; startedAt: number; cycleStart: number; injected?: { resumeIndex: number } }> = {};
// 最近一次 applyReminders 收到的完整提醒配置（供强制切换状态查询）
let latestReminders: any[] = [];
// 缓存每条 stateful 提醒「最后一次下发的状态事件」：用于渲染端注册监听后补偿首帧，
// 彻底消除「主进程 restoreReminders 与渲染端 onMounted 注册监听之间的启动竞态」。
// 无论哪一方先就绪，渲染端挂载后发 request-reminder-state 都能从缓存拿到当前状态。
let lastStateEvents: Record<string, any> = {};

// 渲染端是否曾在「主进程尚未建好 stateful runtime」时请求过当前状态。
// 若请求瞬间 lastStateEvents 与 statefulRuntime 都空（restoreReminders 异步链未完成），
// 首帧会丢失；置此标记后，等 restoreReminders 完成建好 runtime 时统一补发，消除启动竞态。
let pendingStateRequest = false;

// 根据定点提醒生成 cron 表达式
function buildReminderCronExpr(reminder: any): string {
  const [hour, minute] = (reminder.time || '09:00').split(':').map(Number);
  if (reminder.repeat === 'hourly') {
    // 每小时的第 X 分钟
    const m = reminder.minute ?? minute;
    return `${m} * * * *`;
  }
  if (reminder.repeat === 'daily') {
    return `${minute} ${hour} * * *`;
  }
  if (reminder.repeat === 'weekly') {
    const days = (reminder.weekDays || []).join(',');
    return `${minute} ${hour} * * ${days || '*'}`;
  }
  if (reminder.repeat === 'monthly') {
    // 每月 X 号 HH:mm
    const dom = reminder.dayOfMonth || 1;
    return `${minute} ${hour} ${dom} * *`;
  }
  if (reminder.repeat === 'yearly') {
    // 每年 X 月 Y 日 HH:mm
    const mon = reminder.month || 1;
    const dom = reminder.dayOfMonth || 1;
    return `${minute} ${hour} ${dom} ${mon} *`;
  }
  // 仅一次：具体日期
  const parts = (reminder.date || '').split('-').map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return '';
  const [y, m, d] = parts;
  return `${minute} ${hour} ${d} ${m} *`;
}

// 到点触发提醒
function triggerReminder(reminder: any) {
  // 若开启「结束后记录」且主窗口处于隐藏/最小化状态，先唤起主窗口，
  // 以便用户在主题对话页进行情绪记录。
  if (reminder?.recordAfter) {
    showApp();
  }
  win?.webContents.send('reminder-trigger', {
    ...reminder,
    triggerTime: Date.now(),
  });
}

// 调度单条提醒
function scheduleReminder(reminder: any) {
  // 多状态模式：工作-休息-工作…（可选锁屏）等有序状态机，由主进程持有时间线
  if (reminder.mode === 'stateful') {
    // 配置未变且仍在运行则保持，避免重置计时
    if (statefulRuntime[reminder.id]) return;
    startStatefulReminder(reminder);
    return;
  }
  if (reminder.mode === 'interval') {
    // 周期提醒：以 startTime 为首次触发基准，向后推算最近一次「未来」触发时刻
    const gap = Number(reminder.interval) * Number(reminder.unit);
    if (isNaN(gap) || gap <= 0) return;
    // 锚点：优先 startTime；若为空（提醒刚启用/从未设过），则「开始时间 = 应用启动时间」，
    // 并持久化回存储，保证下一轮仍从启动时间起算（不再回落到 null）。
    // 注意：由 reminderJobs[id] 是否存在判断「上一轮是否还在跑」——只有已停止/全新的提醒才回填启动时间。
    if (!reminder.startTime || isNaN(reminder.startTime)) {
      reminder.startTime = Date.now();
      persistStartTime(reminder);
    }
    const base = Number(reminder.startTime);
    const now = Date.now();
    // 向前推进整轮间隔，直到落在未来（避免「下次触发早已过去」）
    let nextTime = base;
    if (nextTime <= now) {
      const elapsed = now - nextTime;
      const rounds = Math.floor(elapsed / gap) + 1;
      nextTime += gap * rounds;
    }
    const job = new CronJob(
      new Date(nextTime),
      () => {
        triggerReminder(reminder);
        // 触发后把 startTime 重写为本次触发时刻，作为下一轮锚点，再重新排程
        reminder.startTime = nextTime;
        scheduleReminder(reminder);
      },
      null,
      true,
      'Asia/Shanghai'
    );
    reminderJobs[reminder.id] = job;
  } else {
    // 定点提醒：cron 表达式
    const cronExpr = buildReminderCronExpr(reminder);
    if (!cronExpr) return;
    try {
      const job = new CronJob(
        cronExpr,
        () => triggerReminder(reminder),
        null,
        true,
        'Asia/Shanghai'
      );
      reminderJobs[reminder.id] = job;
    } catch (error) {
      console.error('创建定点提醒失败:', reminder, error);
    }
  }
}

// 清除所有提醒任务
function clearReminderJobs() {
  for (const id in reminderJobs) {
    reminderJobs[id]?.stop();
    delete reminderJobs[id];
  }
  for (const id in statefulRuntime) {
    delete statefulRuntime[id];
  }
  // 同步清空状态事件缓存，避免对已停止/删除的提醒下发过期状态
  lastStateEvents = {};
}

// 全量应用提醒配置：非 stateful 任务全量重建；stateful 任务仅在配置变更或停用时重建，
// 避免编辑其它提醒时把正在运行的番茄钟计时器重置掉
function applyReminders(reminders: any[]) {
  latestReminders = reminders || [];
  const incoming = reminders || [];
  // 入口兜底：无论渲染端传入 boolean/数字/字符串，统一归一化为 boolean，
  // 避免 enabled 误判（例如 '1' 字符串被 `!` 判成 false 导致番茄钟被跳过不调度）。
  incoming.forEach(r => {
    r.enabled = !!r.enabled;
    r.loop = !!r.loop;
    r.recordAfter = !!r.recordAfter;
  });

  // 0) 双写落库：把每条提醒 upsert 进 reminders 独立表（独立于 basic_info.reminders 字段）
  incoming.forEach(r => persistReminder(r));

  // 1) 非 stateful 任务全量重建；stateful 的推进计时（reminderJobs[id]）由 runtime 持有，
  //    切勿在此删除，否则会丢掉状态推进器、导致番茄钟卡在当前状态且不再切换。
  for (const id in reminderJobs) {
    if (statefulRuntime[id]) continue;
    reminderJobs[id]?.stop();
    delete reminderJobs[id];
  }

  // 2) stateful 运行时：保留配置未变的，清理其余（变更/停用/缺失）
  for (const id in statefulRuntime) {
    const rem = incoming.find(r => r.id === id);
    const sameConfig =
      !!rem && rem.mode === 'stateful' && rem.enabled &&
      JSON.stringify(rem.states) === JSON.stringify(statefulRuntime[id].reminder.states) &&
      rem.loop === statefulRuntime[id].reminder.loop;
    if (!sameConfig) {
      delete statefulRuntime[id];
      delete lastStateEvents[id];
    }
  }

  // 3) 调度所有启用的提醒（stateful 若仍在运行则跳过）
  incoming.forEach(reminder => {
    if (!reminder.enabled) return;
    scheduleReminder(reminder);
  });

  // 4) 补偿启动竞态：若渲染端曾在 runtime 尚未建好时请求过状态（pendingStateRequest），
  //    此时 runtime 已就绪，主动把当前状态补发给渲染端，避免首帧丢失导致「读取不到当前状态」。
  if (pendingStateRequest) {
    for (const id in statefulRuntime) {
      emitCurrentStateful(id);
    }
    pendingStateRequest = false;
  }
}

// ============ 多状态（stateful）提醒调度 ============

// 将 stateful 运行时按「当前时间」重新对齐到正确轮次：
//  - 若「开始时间 + 整轮周期」已全部小于 now（整轮已过期/错过多轮），
//    则把 cycleStart 前推到未来首轮起点，并**重写 reminder.startTime 持久化**，
//    实现「开始时间 + 所有序列状态时间 < 当前时间 → 重新开始新轮次、开始时间重新写入」。
//  - 重新计算当前应处于哪个序列状态（index），并刷新 startedAt。
// 该函数是所有「进入/推进/补偿」路径的统一对齐入口，确保任何时刻读取到的状态
// 都基于当前时间正确对齐，避免 CronJob 因睡眠/挂起错过整轮而导致 nextTime 倒流、状态错乱。
function realignStatefulRuntime(rt: any, now: number) {
  const reminder = rt.reminder;
  const seqIdx = sequentialIndices(reminder);
  if (seqIdx.length === 0) return;
  const cycleDuration = seqIdx.reduce((sum: number, i: number) => {
    const s = reminder.states[i];
    return sum + Number(s.duration) * Number(s.unit);
  }, 0);

  let cycleStart = rt.cycleStart;
  // 整轮是否过期：上一轮「开始时间 + 整轮时长」是否 ≤ 当前时间 now。
  // - 未过期（cycleStart + 整轮 > now）：上一轮仍在进行 → 续跑当前状态，保持 cycleStart/startTime 不动。
  // - 已过期（cycleStart + 整轮 ≤ now）：上一轮已结束 → 开始新一轮，把 cycleStart/startTime/startedAt
  //   对齐到「当前时间 now」，index 回到首个序列状态，并持久化新的 startTime（满足「刷新开始时间为当前时间，开始新一轮」）。
  if (cycleDuration > 0 && cycleStart + cycleDuration <= now) {
    cycleStart = now;
    rt.cycleStart = cycleStart;
    reminder.startTime = cycleStart;
    persistStartTime(reminder);
  }

  // 定位当前应处的序列状态：从 cycleStart 起按序列间隔累加，找到 now 所在区段
  let index = seqIdx[0];
  if (cycleStart <= now) {
    let acc = cycleStart;
    let cursor = seqIdx[0];
    const maxSteps = seqIdx.length + 1;
    for (let step = 0; step < maxSteps; step++) {
      const s = reminder.states[cursor];
      const dur = Number(s.duration) * Number(s.unit);
      if (dur <= 0) {
        index = cursor; // 永久/0 时长状态：停留其上
        break;
      }
      if (now < acc + dur) {
        index = cursor;
        break;
      }
      acc += dur;
      const pos = seqIdx.indexOf(cursor);
      const nextPos = pos >= 0 && pos + 1 < seqIdx.length ? pos + 1 : (reminder.loop ? 0 : -1);
      if (nextPos < 0) { index = cursor; break; }
      cursor = seqIdx[nextPos];
      if (step === maxSteps - 1) index = cursor;
    }
  }

  rt.index = index;
  rt.startedAt = Math.min(cycleStart + seqOffsetFromCycleStart(reminder, seqIdx[0], index), now);
}

// 启动一条多状态提醒：以 startTime 为第 1 个序列状态的绝对进入时刻基准；
// 若整轮「开始时间 + 各状态间隔累计」已全部小于当前时间（已错过整轮），则向前推到未来首轮，
// 并记录当前应处于哪个状态（index），从那里继续。所有「过期前推 + 定位 index + 重写 startTime」
// 的逻辑统一收敛到 realignStatefulRuntime，避免分散实现导致的不一致。
function startStatefulReminder(reminder: any) {
  if (!reminder.states || !reminder.states.length) return;
  const seqIdx = sequentialIndices(reminder);
  if (seqIdx.length === 0) return;
  const firstIdx = seqIdx[0];
  const now = Date.now();

  // 本轮锚点初始化：优先 startTime；若为空（提醒刚启用/从未设过），则「开始时间 = 当前时间」，
  // 并持久化回存储，保证下一轮/重启仍从本轮真实起点续上。
  if (!(reminder.startTime && !isNaN(reminder.startTime))) {
    reminder.startTime = now;
    persistStartTime(reminder);
  }

  // 若 runtime 已存在（上一轮仍在跑 / 渲染端重复触发 / apply 重入）：先按当前时间重新对齐
  // （过期则重置轮次 + 重写 startTime），再纯恢复当前状态（不重跑进入副作用、不重新触发锁屏），
  // 仅按当前状态 lockScreen 值恢复窗口，避免「启动即无条件强制锁屏」。
  if (statefulRuntime[reminder.id]) {
    realignStatefulRuntime(statefulRuntime[reminder.id], now);
    emitCurrentStateful(reminder.id);
    applyStateWindowBehavior(statefulRuntime[reminder.id].reminder.states[statefulRuntime[reminder.id].index]);
    return;
  }

  const oldCycleStart = Number(reminder.startTime);
  // 整轮时长（仅序列状态之和），用于判断「上一轮是否已结束」
  const cycleDuration = seqIdx.reduce((sum: number, i: number) => {
    const s = reminder.states[i];
    return sum + Number(s.duration) * Number(s.unit);
  }, 0);

  statefulRuntime[reminder.id] = { reminder, index: firstIdx, startedAt: now, cycleStart: oldCycleStart };
  // 统一对齐：整轮过期则前推 + 重写 startTime，并定位当前应处状态
  realignStatefulRuntime(statefulRuntime[reminder.id], now);

  if (cycleDuration > 0 && oldCycleStart + cycleDuration <= now) {
    // 「上一轮已结束 / 整轮已过期（如 app 睡眠错过多轮）」：延迟 30 秒开启新一轮，
    // 且开始时间顺延到 30 秒后，让系统从新的轮次起点起算。
    const newCycleStart = now + 30000;
    statefulRuntime[reminder.id].cycleStart = newCycleStart;
    statefulRuntime[reminder.id].startedAt = newCycleStart;
    statefulRuntime[reminder.id].index = firstIdx;
    reminder.startTime = newCycleStart;
    persistStartTime(reminder);
    // 立即下发「即将开始」状态（UI 显示第一个序列状态，nextTime 为 30 秒后 + 首状态时长）
    emitCurrentStateful(reminder.id);
    // 30 秒后真正进入首个状态（排程推进），此时才会按 lockScreen 值触发窗口行为
    setTimeout(() => {
      const rt = statefulRuntime[reminder.id];
      if (rt) emitStatefulEnter(reminder.id, firstIdx);
    }, 30000);
    // 下发启动提示：30 秒后将开始新的轮次
    win?.webContents.send('reminder-boot-notice', {
      type: 'deferred',
      message: '上一轮番茄钟已结束，30 秒后将开始新的轮次。',
    });
    return;
  }

  if (oldCycleStart <= now) {
    // 「上一轮仍在进行中」：纯恢复当前状态（不重跑进入副作用、不重新触发锁屏），
    // 仅按当前状态 lockScreen 值恢复窗口，并提示「继续上一轮」。
    emitCurrentStateful(reminder.id);
    applyStateWindowBehavior(statefulRuntime[reminder.id].reminder.states[statefulRuntime[reminder.id].index]);
    win?.webContents.send('reminder-boot-notice', {
      type: 'continue',
      message: '上一轮次未结束，现在将继续上一轮番茄钟。',
    });
    return;
  }

  // 「未来首轮」（刚启用且 startTime 在未来）：直接正常进入首个状态（会按 lockScreen 值触发行为）
  emitStatefulEnter(reminder.id, firstIdx);
}

// 计算「第 fromIdx 个序列状态」到「toIdx 个序列状态」之间，在周期内的累计偏移（毫秒）
// 用于在 cycleStart 基准上定位任意状态的绝对进入时刻
function seqOffsetFromCycleStart(reminder: any, fromIdx: number, toIdx: number): number {
  const seqIdx = sequentialIndices(reminder);
  if (fromIdx === toIdx) return 0;
  const posFrom = seqIdx.indexOf(fromIdx);
  const posTo = seqIdx.indexOf(toIdx);
  if (posFrom < 0 || posTo < 0) return 0;
  let offset = 0;
  let cursor = posFrom;
  // 仅向前累计（toIdx 在 fromIdx 之后）
  while (cursor !== posTo) {
    const i = seqIdx[cursor];
    const s = reminder.states[i];
    offset += Number(s.duration) * Number(s.unit);
    cursor = cursor + 1 < seqIdx.length ? cursor + 1 : 0;
    if (cursor === posFrom) break; // 绕回，防止死循环
  }
  return offset;
}

// 进入状态时的窗口干预行为（统一收口）：
//  - 仅当 state.lockScreen === true 才强制锁屏（focusAppToTop：screen-saver 级 + 全屏，
//    默认操作切不走其他应用；唯一出口 = show_app 快捷键 / 系统托盘「隐藏应用」调用 hideApp()）。
//  - lockScreen 无值或为 false：不对该状态做任何窗口干预（不 hideApp、不 focusAppToTop），
//    继续维持用户当前窗口状态，仅状态机正常流转。
//  该函数供「正常进入状态」与「启动恢复状态」两路径共用，确保「只按 lockScreen 值判定」语义一致。
function applyStateWindowBehavior(state: any) {
  if (state && state.lockScreen === true) {
    focusAppToTop();
  }
}

// 进入指定状态索引：下发权威 nextTime 事件，并排程该状态结束后的推进
function emitStatefulEnter(id: string, index: number, isInjected = false) {
  const rt = statefulRuntime[id];
  if (!rt) return;
  const states = rt.reminder.states;
  const state = states[index];
  if (!state) return;
  const gap = Number(state.duration) * Number(state.unit);
  // 整轮时长（仅序列状态之和），供注入态归位后回绕补一整轮使用
  const cycleDuration = sequentialIndices(rt.reminder).reduce((sum: number, i: number) => {
    const s = rt.reminder.states[i];
    return sum + Number(s.duration) * Number(s.unit);
  }, 0);
  // 停掉上一次排程的同一提醒计时，避免重复推进
  if (reminderJobs[id]) {
    reminderJobs[id].stop();
    delete reminderJobs[id];
  }
  // 注意：duration=0（或 gap<=0）表示「永久」状态（如强制锁屏），
  // 此时仍要进入状态、下发事件、执行锁屏，只是不排程自动推进（不会自动结束）。
  if (isNaN(gap) || gap <= 0) {
    // 永久状态：进入后下发事件，但不创建 CronJob 推进计时
    emitStatefulEvent(id, index, isInjected, null);
    return;
  }

  // 计算下一状态的绝对进入时刻（nextTime）。
  // 关键修正：不得用「cycleStart + seqOffset(seqIdx[0]→nextIndex)」直接算——
  // 当 nextIndex 回绕到 seqIdx[0]（如 rest→work 开新一轮）时，seqOffset 返回 0，
  // 会把 nextTime 算成早已过去的 cycleStart 起点（即为你看到的「提醒时间=本次开始时间」）。
  // 正确做法：nextTime = 当前状态真实结束时刻 = rt.startedAt + 当前状态时长。
  // rt.startedAt 是「当前状态真实进入时刻」（realign 基于对齐后的 cycleStart 定位得到），
  // 加当前状态时长即下一个状态起点，永远落在 now 之后，天然兼容跨轮回绕。
  let nextState: any = null;
  let nextAbsTime: number | null = null;
  const curDur = Number(state.duration) * Number(state.unit);
  if (isInjected && rt.injected) {
    const resumeIndex = rt.injected.resumeIndex;
    const seqStates = sequentialIndices(rt.reminder);
    const pos = seqStates.indexOf(resumeIndex);
    const nextSeqIndex = pos >= 0 && pos + 1 < seqStates.length
      ? seqStates[pos + 1]
      : (rt.reminder.loop ? seqStates[0] : -1);
    nextState = nextSeqIndex >= 0 ? states[nextSeqIndex] : null;
    if (nextState) {
      // 注入态（多为永久 lock）归位后的状态：以其归位后状态在周期内的偏移推算；
      // 若回绕到首位则补一整轮，避免落到过去。
      const seqIdx0 = seqStates[0];
      const posNext = seqStates.indexOf(nextSeqIndex);
      const baseOffset = seqOffsetFromCycleStart(rt.reminder, seqIdx0, nextSeqIndex);
      const offset = (posNext >= 0 && pos >= 0 && posNext <= pos)
        ? cycleDuration + baseOffset
        : baseOffset;
      nextAbsTime = rt.cycleStart + offset;
    }
  } else {
    const nextIndex = nextSequentialIndex(rt.reminder, index);
    nextState = nextIndex >= 0 ? states[nextIndex] : null;
    if (nextState && curDur > 0) {
      // 当前状态有确定时长：下一状态 = 当前状态结束时刻（基于真实进入时刻 startedAt，跨轮安全）
      nextAbsTime = rt.startedAt + curDur;
    } else if (nextState && curDur <= 0) {
      // 当前状态为永久态（理论上非注入分支不会进到这里，防御）：用 cycleStart 锚点
      nextAbsTime = rt.cycleStart + seqOffsetFromCycleStart(rt.reminder, sequentialIndices(rt.reminder)[0], nextIndex);
    }
  }

  // 进入该状态时的窗口干预（统一收口到 applyStateWindowBehavior：仅 lockScreen===true 才锁屏）
  applyStateWindowBehavior(state);

  const stateChangePayload = {
    reminderId: id,
    stateKey: state.key,
    stateLabel: state.label,
    nextStateKey: nextState ? nextState.key : null,
    nextStateLabel: nextState ? nextState.label : null,
    stateStartTime: rt.startedAt,
    nextTime: nextAbsTime,
    // 标记当前是否处于「被注入的非序列状态」，UI 据此提示「临时插入，结束后自动归位」
    injected: isInjected,
    // 状态进入通知文案：title 缺省「提醒」，content 优先取当前状态的 content，否则「xx提醒到了」
    title: rt.reminder.title || '提醒',
    content: (state.content && String(state.content).trim()) || `${state.label}提醒到了`,
    // 标记这是「真正进入状态」事件，渲染端据此弹通知；emitCurrentStateful 的补偿恢复不弹
    notify: true,
    // 是否写入 pomodoro_status 记录：跟随状态定义里的 record 字段（缺省视为 true）。
    // 仅「真实进入 + 允许记录」的状态才应由渲染端落库，强制锁屏(record:false) 等不记。
    recordable: state.record !== false,
  };
  lastStateEvents[id] = stateChangePayload;
  broadcastStateChange(stateChangePayload);

  // 排程该状态结束 → 推进到下一状态（自排程，复用 CronJob，使用绝对未来时刻）
  const job = new CronJob(
    new Date(nextAbsTime ?? Date.now() + gap),
    () => advanceStateful(id, index),
    null,
    true,
    'Asia/Shanghai'
  );
  reminderJobs[id] = job;
}

// 仅下发状态切换事件（不排程推进计时），供「永久」状态（duration=0）进入时使用
function emitStatefulEvent(id: string, index: number, isInjected: boolean, nextTime: number | null) {
  const rt = statefulRuntime[id];
  if (!rt) return;
  const states = rt.reminder.states;
  const state = states[index];
  if (!state) return;
  let nextState: any = null;
  if (isInjected && rt.injected) {
    const resumeIndex = rt.injected.resumeIndex;
    const seqStates = sequentialIndices(rt.reminder);
    const pos = seqStates.indexOf(resumeIndex);
    const nextSeqIndex = pos >= 0 && pos + 1 < seqStates.length
      ? seqStates[pos + 1]
      : (rt.reminder.loop ? seqStates[0] : -1);
    nextState = nextSeqIndex >= 0 ? states[nextSeqIndex] : null;
  } else {
    const nextIndex = nextSequentialIndex(rt.reminder, index);
    nextState = nextIndex >= 0 ? states[nextIndex] : null;
  }
  if (state.lockScreen === true) {
    // 强制锁屏：顶级置顶（screen-saver + 全屏），默认操作切不走其他应用；
    // 唯一出口 = show_app 快捷键 / 系统托盘「隐藏应用」调用 hideApp()。
    focusAppToTop();
  }
  // 其余状态（lockScreen 无值/false）不干预窗口，维持用户当前状态。
  const stateChangePayload = {
    reminderId: id,
    stateKey: state.key,
    stateLabel: state.label,
    nextStateKey: nextState ? nextState.key : null,
    nextStateLabel: nextState ? nextState.label : null,
    stateStartTime: rt.startedAt,
    nextTime,
    injected: isInjected,
    // 状态进入通知文案：title 缺省「提醒」，content 优先取当前状态的 content，否则「xx提醒到了」
    title: rt.reminder.title || '提醒',
    content: (state.content && String(state.content).trim()) || `${state.label}提醒到了`,
    // 真正进入状态才弹通知（emitCurrentStateful 的恢复不发 notify）
    notify: true,
    // 是否写入 pomodoro_status 记录：跟随状态定义里的 record 字段（缺省视为 true）
    recordable: state.record !== false,
  };
  lastStateEvents[id] = stateChangePayload;
  broadcastStateChange(stateChangePayload);
}

// 取参与循环的序列状态索引列表（sequential !== false 的状态）
function sequentialIndices(reminder: any): number[] {
  const states = reminder.states || [];
  const idx: number[] = [];
  states.forEach((s: any, i: number) => {
    if (s.sequential !== false) idx.push(i);
  });
  return idx;
}

// 在「序列状态」循环里取 index 的下一个索引（loop 时回首位；无后续返回 -1）。
// 非序列状态（sequential===false，如 lock 强制锁屏）永远不参与轮次推进，
// 只能由 injectStatefulState / forceReminderState 主动注入进入；推进时一律跳过它们，
// 直接落到下一个 sequential 状态（或开启新一轮）。这是「sequential=false 不轮次」语义的落点。
function nextSequentialIndex(reminder: any, index: number): number {
  const seqStates = sequentialIndices(reminder);
  if (seqStates.length === 0) return -1;
  const pos = seqStates.indexOf(index);
  if (pos < 0) {
    // index 本身非序列状态（例如 lock），从首个序列状态继续（开启新一轮）
    return seqStates[0];
  }
  return pos + 1 < seqStates.length
    ? seqStates[pos + 1]
    : (reminder.loop ? seqStates[0] : -1);
}

// 向渲染进程重发某 stateful 提醒的当前状态（用于启动后补偿竞态，不重置计时）
function emitCurrentStateful(id: string) {
  const rt = statefulRuntime[id];
  if (!rt) return;
  const states = rt.reminder.states;
  const state = states[rt.index];
  if (!state) return;
  let nextState: any = null;
  if (rt.injected) {
    const resumeIndex = rt.injected.resumeIndex;
    const seqStates = sequentialIndices(rt.reminder);
    const pos = seqStates.indexOf(resumeIndex);
    const nextSeqIndex = pos >= 0 && pos + 1 < seqStates.length
      ? seqStates[pos + 1]
      : (rt.reminder.loop ? seqStates[0] : -1);
    nextState = nextSeqIndex >= 0 ? states[nextSeqIndex] : null;
  } else {
    const nextIndex = nextSequentialIndex(rt.reminder, rt.index);
    nextState = nextIndex >= 0 ? states[nextIndex] : null;
  }
  // nextTime = 当前状态真实结束时刻（startedAt + 当前状态时长），跨轮回绕安全；
  // 不依赖 cycleStart + seqOffset 的旧写法（回绕到 seqIdx[0] 时会错算成过去的 cycleStart 起点）。
  const curDur = Number(state.duration) * Number(state.unit);
  const nextTime = nextState && curDur > 0 ? rt.startedAt + curDur : null;
  broadcastStateChange({
    reminderId: id,
    stateKey: state.key,
    stateLabel: state.label,
    nextStateKey: nextState ? nextState.key : null,
    nextStateLabel: nextState ? nextState.label : null,
    stateStartTime: rt.startedAt || Date.now(),
    nextTime,
    injected: !!rt.injected,
  });
}

// 静默（无通知、无锁屏）重新排程当前状态的推进 CronJob：
// 停掉旧 Job，按「当前状态真实结束时刻 = rt.startedAt + 当前状态时长」新建，到点触发 advanceStateful。
// 供「刷新当前时间 / 启动补偿」路径使用——realign 实时对齐时间线后，必须重新排程才能让下一状态继续流转，否则卡死。
function rescheduleStatefulAdvance(id: string) {
  const rt = statefulRuntime[id];
  if (!rt) return;
  const state = rt.reminder.states[rt.index];
  if (!state) return;
  const curDur = Number(state.duration) * Number(state.unit);
  if (isNaN(curDur) || curDur <= 0) return; // 永久 / 0 时长状态不排程（与 emitStatefulEnter 一致）
  const completedIndex = rt.index;
  if (reminderJobs[id]) {
    reminderJobs[id].stop();
    delete reminderJobs[id];
  }
  reminderJobs[id] = new CronJob(
    new Date(rt.startedAt + curDur),
    () => advanceStateful(id, completedIndex),
    null,
    true,
    'Asia/Shanghai'
  );
}

// 某状态结束，推进到下一状态
function advanceStateful(id: string, completedIndex: number) {
  const rt = statefulRuntime[id];
  if (!rt) return;
  const states = rt.reminder.states;
  const completedState = states[completedIndex];

  // 若刚结束的是「被注入的非序列状态」：直接归位到插入前的序列位置，继续循环
  if (rt.injected && completedState && completedState.sequential === false) {
    const resumeIndex = rt.injected.resumeIndex;
    rt.injected = undefined;
    const seqIdx = sequentialIndices(rt.reminder);
    const pos = seqIdx.indexOf(resumeIndex);
    // 归位到下一段序列状态（即插入前所在序列状态的下一个）
    let nextSeqIndex = pos >= 0 && pos + 1 < seqIdx.length
      ? seqIdx[pos + 1]
      : (rt.reminder.loop ? seqIdx[0] : -1);
    if (nextSeqIndex < 0) {
      // 序列已无后续：清理运行时
      delete statefulRuntime[id];
      delete reminderJobs[id];
      return;
    }
    // 归位时若回绕到首个序列状态（开新一轮）：锁屏是永久态、靠用户手动解除，
    // 解除时刻即新一轮起点，用 now 重写 startTime，使后续轮次从解除后重新对齐。
    if (nextSeqIndex === seqIdx[0]) {
      rt.cycleStart = Date.now();
      rt.reminder.startTime = rt.cycleStart;
      persistStartTime(rt.reminder);
    }
    rt.index = nextSeqIndex;
    emitStatefulEnter(id, nextSeqIndex);
    return;
  }

  // 普通序列推进：基于「序列状态循环」取下一状态，跳过非序列状态（sequential===false 的 lock）
  const seqIdx = sequentialIndices(rt.reminder);
  const nextIndex = nextSequentialIndex(rt.reminder, completedIndex);
  if (nextIndex < 0) {
    // 序列结束且不循环：清理运行时
    delete statefulRuntime[id];
    delete reminderJobs[id];
    return;
  }
  // 是否「开新一轮」：nextIndex 回绕到首个序列状态（seqIdx[0]）。
  const isNewCycle = nextIndex === seqIdx[0];
  // 捕捉推进前的 cycleStart，用于计算「新一轮起点 = 上一轮起点 + 整轮时长」
  const prevCycleStart = rt.cycleStart;
  const cycleDuration = seqIdx.reduce((sum: number, i: number) => {
    const s = rt.reminder.states[i];
    return sum + Number(s.duration) * Number(s.unit);
  }, 0);
  // 先按「当前时间」统一对齐运行时：若整轮已过期（如 app 睡眠/挂起错过多轮），
  // 会前推到未来首轮起点并重写 startTime，同时把 index 重定位到当前应处的状态，
  // 确保即使错过多轮也能正确续上，且读取到的状态始终基于当前时间对齐。
  // 注：若仅正常推进一格（CronJob 按时触发），realign 算出的 index 即等于 nextIndex，行为一致。
  realignStatefulRuntime(rt, Date.now());
  // 进入新一轮：把 startTime/cycleStart 重写为「新一轮起点」，
  // 让系统始终基于「当前正在跑的轮次起点」计算，而非停留在历史起点，更直观、更易算。
  if (isNewCycle && cycleDuration > 0) {
    const newCycleStart = prevCycleStart + cycleDuration;
    rt.cycleStart = newCycleStart;
    rt.reminder.startTime = newCycleStart;
    persistStartTime(rt.reminder);
  }
  emitStatefulEnter(id, rt.index);
}

// 强制切换到指定状态（快捷键 / 手动干预）
export function forceReminderState(reminderId: string, stateKey: string) {
  const reminder = (latestReminders || []).find(r => r.id === reminderId);
  if (!reminder || reminder.mode !== 'stateful' || !reminder.states || !reminder.states.length) return;
  const idx = reminder.states.findIndex((s: any) => s.key === stateKey);
  if (idx < 0) return;
  const target = reminder.states[idx];
  // 目标为「非序列状态」时，等价于运行时注入（插入后自动归位），复用 injectStatefulState
  if (target.sequential === false) {
    injectStatefulState(reminderId, stateKey);
    return;
  }
  // 停止当前状态计时，立即进入目标序列状态
  reminderJobs[reminderId]?.stop();
  delete reminderJobs[reminderId];
  const cycleStart = (reminder.startTime && !isNaN(reminder.startTime)) ? Number(reminder.startTime) : Date.now();
  statefulRuntime[reminderId] = { reminder, index: idx, startedAt: Date.now(), cycleStart };
  emitStatefulEnter(reminderId, idx);
}

// 强制插入一个「非序列状态」：暂停当前序列，进入该状态；
// 其结束后自动移出并回到插入前所在的序列状态继续循环。
export function injectStatefulState(reminderId: string, stateKey: string) {
  const reminder = (latestReminders || []).find(r => r.id === reminderId);
  if (!reminder || reminder.mode !== 'stateful' || !reminder.states || !reminder.states.length) return;
  const idx = reminder.states.findIndex((s: any) => s.key === stateKey);
  if (idx < 0) return;
  const target = reminder.states[idx];
  if (target.sequential !== false) {
    // 仅非序列状态可被注入；序列状态请用 forceReminderState
    return;
  }
  // 记录当前序列位置（若当前正处于某序列状态），作为归位锚点；
  // 若当前正处于被注入状态（连续注入），则保持原有 resumeIndex
  const rt = statefulRuntime[reminderId];
  const resumeIndex = rt && rt.injected ? rt.injected.resumeIndex : (rt ? rt.index : sequentialIndices(reminder)[0] ?? 0);
  // 停止当前状态计时，进入非序列状态（标记为 injected）
  reminderJobs[reminderId]?.stop();
  delete reminderJobs[reminderId];
  const cycleStart = (reminder.startTime && !isNaN(reminder.startTime)) ? Number(reminder.startTime) : Date.now();
  statefulRuntime[reminderId] = { reminder, index: idx, startedAt: Date.now(), cycleStart, injected: { resumeIndex } };
  emitStatefulEnter(reminderId, idx, true);
}

// 手动解除一个「被注入的非序列状态」（如强制锁屏）：
//  - 若该状态 continueLoop !== false → 归位到插入前的序列状态继续循环；
//  - 若该状态 continueLoop === false → 番茄钟（stateful 提醒）整体停止，清理运行时。
export function endInjectedState(reminderId: string) {
  const rt = statefulRuntime[reminderId];
  if (!rt || !rt.injected) return;
  const reminder = rt.reminder;
  const currentState = reminder.states?.[rt.index];
  // 停掉当前（永久）状态可能未排程计时，删除以防万一
  reminderJobs[reminderId]?.stop();
  delete reminderJobs[reminderId];
  // 仅当被解除的是「非序列状态」才按此逻辑处理
  if (!currentState || currentState.sequential !== false) {
    return;
  }
  // 该非序列状态配置为「结束后不继续循环」：整体停止
  if (currentState.continueLoop === false) {
    delete statefulRuntime[reminderId];
    delete reminderJobs[reminderId];
    // 下发一个「已停止」事件，UI 回到空闲态
    const stoppedPayload = {
      reminderId,
      stateKey: currentState.key,
      stateLabel: currentState.label,
      nextStateKey: null,
      nextStateLabel: null,
      stateStartTime: rt.startedAt,
      nextTime: null,
      injected: false,
      stopped: true,
    };
    lastStateEvents[reminderId] = stoppedPayload;
    broadcastStateChange(stoppedPayload);
    return;
  }
  // 否则：归位到插入前的序列状态继续循环
  const resumeIndex = rt.injected.resumeIndex;
  rt.injected = undefined;
  const seqIdx = sequentialIndices(reminder);
  const pos = seqIdx.indexOf(resumeIndex);
  let nextSeqIndex = pos >= 0 && pos + 1 < seqIdx.length
    ? seqIdx[pos + 1]
    : (reminder.loop ? seqIdx[0] : -1);
  if (nextSeqIndex < 0) {
    delete statefulRuntime[reminderId];
    delete reminderJobs[reminderId];
    return;
  }
  rt.index = nextSeqIndex;
  emitStatefulEnter(reminderId, nextSeqIndex);
}

// 把主进程算出的「开始时间」回写渲染端存储（仅当与现有值不同，避免无意义写库）
function persistStartTime(reminder: any) {
  if (!reminder || !reminder.id) return;
  // 直接在主进程落库（upsert 整行，含最新 startTime），不依赖渲染端 IPC 回写——
  // 否则启动补偿时渲染端 onMounted 监听尚未注册，IPC 消息丢失，DB 的 startTime 永不更新（重启后仍是旧值）。
  persistReminder(reminder);
  // 通知渲染端同步内存中的 startTime，保持 UI 一致。
  win?.webContents.send('reminder-starttime-updated', {
    id: reminder.id,
    startTime: reminder.startTime,
  });
}

// 显式确保 reminders 表存在且补齐所有列（不依赖通用 ensureTableColumns 的猜测逻辑，
// 避免「表不存在 → queryByConditions 误用空 conditions 建空表 → 缺列」导致的 SQLITE_ERROR）
function ensureRemindersTable(done: () => void) {
  // 布尔字段（enabled/loop/recordAfter）使用 INTEGER 0/1 存储，其余为 TEXT。
  // 列名 → 列类型映射；缺失列时按映射补齐类型。
  const columnTypes: Record<string, string> = {
    id: 'TEXT', mode: 'TEXT', title: 'TEXT', content: 'TEXT',
    enabled: 'INTEGER', startTime: 'TEXT', time: 'TEXT', repeat: 'TEXT',
    date: 'TEXT', minute: 'TEXT', dayOfMonth: 'TEXT', month: 'TEXT',
    interval: 'TEXT', unit: 'TEXT', recordAfter: 'INTEGER', loop: 'INTEGER',
    states: 'TEXT', weekDays: 'TEXT',
  };
  const allColumns = Object.keys(columnTypes);
  myDb.db.serialize(() => {
    myDb.db.run(
      `CREATE TABLE IF NOT EXISTS ${reminderTable} (id TEXT PRIMARY KEY);`,
      (err) => {
        if (err) { console.error('创建 reminders 表失败:', err); done(); return; }
        // 逐个补齐缺失列（按各自类型）
        let pending = allColumns.length;
        if (pending === 0) { done(); return; }
        allColumns.forEach((col) => {
          myDb.db.run(
            `ALTER TABLE ${reminderTable} ADD COLUMN ${col} ${columnTypes[col]}`,
            (alterErr: any) => {
              // SQLITE_ERROR: duplicate column 直接忽略（列已存在）
              if (alterErr && !/duplicate column/i.test(alterErr.message || '')) {
                console.error(`补齐 reminders 列失败: ${col}`, alterErr);
              }
              pending -= 1;
              if (pending === 0) done();
            }
          );
        });
      }
    );
  });
}

// 主进程侧默认番茄钟种子：与渲染端 seedDefaultPomodoro 保持一致。
// 首次使用时由 restoreReminders 调用，确保「插入数据并开始」不依赖渲染端 init。
function buildDefaultPomodoro(): any {
  return {
    id: 'pomodoro',
    mode: 'stateful',
    title: '番茄钟',
    content: '',
    enabled: true,
    // startTime 作为第 1 个序列状态（work）进入的绝对时刻基准；
    // 取应用启动时间作为首次起点，引擎会按此锚点推进，若已过期则向前推到下一轮未来时刻。
    startTime: Date.now(),
    loop: true,
    states: [
      { key: 'work', label: '工作', content: '', duration: 35, unit: 60 * 1000, record: true, sequential: true },
      { key: 'rest', label: '休息', content: '', duration: 5, unit: 60 * 1000, record: true, sequential: true },
      // 非序列状态：强制锁屏。lockScreen=true 让进入时聚焦/锁屏；
      // sequential=false 使其不进入循环序列，仅可运行时注入；
      // duration=0 表示「永久」生效（不会自动结束），需手动解除；
      // continueLoop=true 解除后自动归位到插入前的 work/rest 序列继续循环。
      { key: 'lock', label: '强制锁屏', content: '已开启强制锁屏，请输入密码解除', duration: 0, unit: 1000, record: false, lockScreen: true, sequential: false, continueLoop: true },
    ],
  };
}

// 应用启动时从「reminders 独立表」恢复定时提醒（每条提醒一行）
function restoreReminders() {
  // 0) 先确保表与全部列存在（避免后续 query/upsert 缺列报错）
  ensureRemindersTable(() => {
  // 1) 先做一次性迁移：若 basic_info 仍残留 reminders 字段（旧版数据），
  //    逐条迁入 reminders 表并删除旧字段，保证历史数据不丢。
  migrateLegacyReminders(() => {
    // 2) 从独立表读取全部提醒行
    queryByConditions({
      db: myDb.db,
      tableName: reminderTable,
      conditions: {},
      callback: (err, rows) => {
        if (err) {
          console.error('读取提醒表失败:', err);
          return;
        }
        try {
          const reminders = (rows || []).map(rowToReminder).filter(Boolean);
          // 首次使用：若 reminders 表没有任何多状态（番茄钟）提醒，
          // 由主进程直接 seed 默认番茄钟并落库 + 启动调度，
          // 不依赖渲染端 init 时机（即使渲染端未挂载，番茄钟也已插入数据并开始）。
          if (!reminders.some(r => r.mode === 'stateful')) {
            const seed = buildDefaultPomodoro();
            reminders.push(seed);
          }
          applyReminders(reminders);
        } catch (e) {
          console.error('恢复定时提醒失败:', e);
        }
      },
    });
  });
  });
}

// 布尔字段统一解析：INTEGER 列返回数字 0/1；历史 TEXT 列可能返回 '1'/'0'/'true'/'false' 字符串。
// 与「enabled=1 表示开启，=0 表示关闭，仅用户手动切换」语义一致——非 0/假值一律视为开启。
// fallback：字段缺失/异常时的默认值（stateful 番茄钟默认开启，其余默认关闭）。
function parseBool(v: any, fallback: boolean): boolean {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'y') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'n') return false;
  // 其它非空字符串一律视为开启（容错）
  return true;
}

// 将 reminders 表中的一行（平铺列）还原为渲染端 Reminder 对象
function rowToReminder(row: any): any {
  if (!row) return null;
  const reminder: any = {};
  // 基础标量字段直接取
  const scalarFields = ['id', 'mode', 'title', 'content', 'enabled', 'startTime',
    'time', 'repeat', 'date', 'minute', 'dayOfMonth', 'month', 'interval', 'unit',
    'recordAfter', 'loop'];
  scalarFields.forEach(f => {
    if (row[f] !== undefined && row[f] !== null) reminder[f] = row[f];
  });
  // 数组 / 对象字段：JSON 反序列化（表中以 TEXT 存）
  ['states', 'weekDays'].forEach(f => {
    if (row[f] !== undefined && row[f] !== null) {
      try { reminder[f] = JSON.parse(row[f]); } catch (e) { /* 解析失败保留原值 */ }
    }
  });
  if (typeof reminder.startTime === 'string') reminder.startTime = reminder.startTime ? Number(reminder.startTime) : null;
  // 布尔字段统一解析为 boolean（INTEGER 0/1 或历史字符串都能正确处理）
  reminder.enabled = parseBool(reminder.enabled, reminder.mode === 'stateful');
  reminder.loop = parseBool(reminder.loop, false);
  reminder.recordAfter = parseBool(reminder.recordAfter, false);
  return reminder;
}

// 将渲染端 Reminder 对象展开为「平铺列」行（JSON 字段序列化为 TEXT，布尔字段归一化为 INTEGER 0/1）
function reminderToRow(reminder: any): Record<string, any> {
  const row: Record<string, any> = { id: reminder.id };
  const scalarFields = ['mode', 'title', 'content', 'startTime',
    'time', 'repeat', 'date', 'minute', 'dayOfMonth', 'month', 'interval', 'unit'];
  scalarFields.forEach(f => {
    if (reminder[f] !== undefined) row[f] = reminder[f];
  });
  // 布尔字段：无论渲染端传入 boolean / 数字 / 字符串，统一归一化为 INTEGER 0/1 入库
  row.enabled = reminder.enabled ? 1 : 0;
  row.loop = reminder.loop ? 1 : 0;
  row.recordAfter = reminder.recordAfter ? 1 : 0;
  // 数组 / 对象字段序列化为 TEXT
  if (reminder.states !== undefined) row.states = JSON.stringify(reminder.states || []);
  if (reminder.weekDays !== undefined) row.weekDays = JSON.stringify(reminder.weekDays || []);
  return row;
}

// 单条 upsert 到 reminders 表（新增/编辑都走这里）
function persistReminder(reminder: any) {
  if (!reminder || !reminder.id) return;
  upsertData({
    db: myDb.db,
    tableName: reminderTable,
    data: reminderToRow(reminder),
    config: { primaryKey: 'id' },
    callback: (err) => {
      if (err) console.error('持久化提醒失败:', reminder.id, err);
    },
  });
}

// 单条删除 reminders 表行
function deleteReminderRow(id: string) {
  if (!id) return;
  deleteData({
    db: myDb.db,
    tableName: reminderTable,
    condition: { id },
    callback: (err) => {
      if (err) console.error('删除提醒失败:', id, err);
    },
  });
}

// 一次性迁移：basic_info.reminders（旧版单 JSON 数组字段）→ reminders 独立表
function migrateLegacyReminders(done: () => void) {
  queryByConditions({
    db: myDb.db,
    tableName: tableName,
    conditions: { key: 'reminders' },
    callback: (err, data) => {
      if (err || !data || data.length === 0) { done(); return; }
      let legacy: any[] = [];
      try { legacy = JSON.parse(data[0].value); } catch (e) { legacy = []; }
      if (!Array.isArray(legacy) || legacy.length === 0) {
        // 无有效旧数据也清掉字段，结束迁移
        deleteData({ db: myDb.db, tableName, condition: { key: 'reminders' }, callback: () => done() });
        return;
      }
      // 逐条写入新表
      const rows = legacy.map(reminderToRow);
      upsertData({
        db: myDb.db,
        tableName: reminderTable,
        data: rows,
        config: { primaryKey: 'id' },
        callback: () => {
          // 迁移完成后删除 basic_info 的旧 reminders 字段
          deleteData({ db: myDb.db, tableName, condition: { key: 'reminders' }, callback: () => done() });
        },
      });
    },
  });
}

// ============ 待办截止时间提醒调度 ============
let todoReminderJobs: Record<string, CronJob[]> = {};

// 从数据库读取全部待办
function getAllTodos(): Promise<any[]> {
  return new Promise((resolve) => {
    if (!myDb.db) {
      resolve([]);
      return;
    }
    myDb.db.all('SELECT * FROM todo_list', [], (err: any, rows: any[]) => {
      if (err) {
        console.error('读取待办失败:', err);
        resolve([]);
      } else {
        resolve(rows || []);
      }
    });
  });
}

// 触发待办提醒：通知渲染进程弹通知
function triggerTodoReminder(todo: any) {
  win?.webContents.send('todo-reminder-trigger', {
    ...todo,
    triggerTime: Date.now(),
  });
}

// 为单条待办排程：在截止时间前按「提醒次数 / 间隔」多次提醒
function scheduleTodoReminder(todo: any) {
  if (!todo || !todo.dueDate) return;
  // 提醒资格：已完成/已取消不排程；兼容旧数据（无 status 字段时按 completed 判断）
  const isDone = todo.status
    ? (todo.status === 'completed' || todo.status === 'cancelled')
    : Number(todo.completed) === 1;
  if (isDone) return;
  if (Number(todo.deadlineReminder) !== 1) return;

  const due = momemt(todo.dueDate, 'YYYY-MM-DD HH:mm:ss').toDate().getTime();
  const now = Date.now();
  if (isNaN(due) || due <= now) return; // 已过期不排程

  const intervalMs =
    Number(todo.remindIntervalUnit === 'hour'
      ? Number(todo.remindInterval) * 3600000
      : Number(todo.remindInterval) * 60000) || 30 * 60000;
  const count = Math.min(50, Math.max(1, Number(todo.remindCount) || 1));

  const jobs: CronJob[] = [];
  for (let i = 0; i < count; i++) {
    const t = due - i * intervalMs;
    // 仅排程尚未到达（留出 1s 余量）的时间点，避免过去时间立即触发
    if (t > now + 1000) {
      const job = new CronJob(new Date(t), () => {
        triggerTodoReminder(todo);
      }, null, true, 'Asia/Shanghai');
      jobs.push(job);
    }
  }
  if (jobs.length > 0) {
    todoReminderJobs[todo.key] = jobs;
  }
}

// 清除所有待办提醒任务
function clearTodoReminderJobs() {
  for (const key in todoReminderJobs) {
    (todoReminderJobs[key] || []).forEach(j => j.stop());
    delete todoReminderJobs[key];
  }
}

// 全量应用待办截止提醒（先清空再按当前数据排程）
async function applyTodoReminders() {
  clearTodoReminderJobs();
  const todos = await getAllTodos();
  (todos || []).forEach(todo => scheduleTodoReminder(todo));
}

// 应用启动时恢复待办截止提醒
async function restoreTodoReminders() {
  try {
    await applyTodoReminders();
  } catch (e) {
    console.error('恢复待办截止提醒失败:', e);
  }
}

export function initJob() {
  // 启动时恢复已启用的定时提醒
  restoreReminders();

  // 同步定时提醒配置
  ipcMain.on("update-reminders", (e, reminders: any[]) => {
    applyReminders(reminders);
  });

  // 渲染端从主进程读取 reminders 表全部行（用于 init 加载，替代旧 basic_info.reminders 字段）。
  // 注意：数据库查询是异步的，必须用 ipcMain.handle（invoke 异步返回），
  // 不能用 ipcMain.on + sendSync——后者在 handler 同步 return 时就取返回值，
  // 异步查询尚未完成，渲染端永远拿到空数组，导致读不到已落库的（含默认开启的）番茄钟。
  ipcMain.handle("get-reminders", (_e) => {
    return new Promise((resolve) => {
      queryByConditions({
        db: myDb.db,
        tableName: reminderTable,
        conditions: {},
        callback: (err, rows) => {
          if (err) { resolve([]); return; }
          resolve((rows || []).map(rowToReminder).filter(Boolean));
        },
      });
    });
  });

  // 渲染端新增/编辑单条提醒：upsert 到 reminders 表（不再写 basic_info 字段）。
  // 注意：调度引擎的更新由渲染端 persist() 另发 update-reminders 驱动，
  // 这里只负责落库，避免异步读表拿到旧数据导致调度错乱。
  ipcMain.on("upsert-reminder", (e, reminder: any) => {
    persistReminder(reminder);
  });

  // 渲染端删除单条提醒：从 reminders 表删行，并停止其调度
  ipcMain.on("delete-reminder", (e, id: string) => {
    deleteReminderRow(id);
    // 立即从调度引擎移除
    if (reminderJobs[id]) { reminderJobs[id].stop(); delete reminderJobs[id]; }
    if (statefulRuntime[id]) { delete statefulRuntime[id]; delete lastStateEvents[id]; }
  });

  // 渲染端把主进程回填的「开始时间」落库后回发确认（无需主进程动作，仅保持通道对称可读）
  ipcMain.on("reminder-starttime-ack", () => {});

  // 强制切换多状态提醒到指定状态（如快捷键强制回到工作）
  ipcMain.on("reminder-force-state", (e, { reminderId, stateKey }: { reminderId: string; stateKey: string }) => {
    forceReminderState(reminderId, stateKey);
  });

  // 运行时强制插入一个「非序列状态」（如番茄钟强制锁屏），结束后自动归位序列
  ipcMain.on("reminder-inject-state", (e, { reminderId, stateKey }: { reminderId: string; stateKey: string }) => {
    injectStatefulState(reminderId, stateKey);
  });

  // 手动解除一个「被注入的非序列状态」：按该状态 continueLoop 决定归位序列或停止整体
  ipcMain.on("reminder-end-injected-state", (e, { reminderId }: { reminderId: string }) => {
    endInjectedState(reminderId);
  });

  // 渲染进程初始化后请求当前多状态运行时（补偿启动竞态，避免错过首次 state-change）。
  // 先按「当前时间」重新对齐运行时：整轮已过期则前推到包含 now 的当前轮、
  // 刷新 startedAt 与下一状态时刻并持久化新的开始时间；再下发当前状态仅用于刷新 UI/计时。
  // 彻底消除「番茄钟长时间运行/挂起后，打开页面看到的是早已过去的轮次、nextTime 倒流、startTime 不刷新」。
  // 注意：恢复补偿只 emitCurrentStateful（不带 notify），真实状态进入通知仍由 emitStatefulEnter 下发。
  ipcMain.on("request-reminder-state", () => {
    const now = Date.now();
    let hasRuntime = false;
    for (const id in statefulRuntime) {
      hasRuntime = true;
      const rt = statefulRuntime[id];
      realignStatefulRuntime(rt, now);
      // 刷新补偿：realign 已按「续跑 / 开新一轮」规则对齐时间线，此处静默重排程推进 CronJob，
      // 否则刷新后状态机卡在当前状态、下一状态不流转；并用 emitCurrentStateful 仅刷新 UI/计时（不带 notify、不锁屏）。
      rescheduleStatefulAdvance(id);
      emitCurrentStateful(id);
      // C 修复：续跑/刷新（重启 App、打开提醒页等补偿路径）时，若当前状态的 lockScreen 为 true，
      // 重新挂上强制锁屏——否则番茄钟进行中重启/刷新后，处于锁屏态却不强制锁屏（窗口行为只在 emitStatefulEnter 等
      // 真实进入路径 applyStateWindowBehavior，本补偿通道不发 notify 故原本不触发）。applyStateWindowBehavior 内部
      // 仅在 lockScreen===true 时才 focusAppToTop，非锁屏态为 no-op，安全。
      applyStateWindowBehavior(rt.reminder.states[rt.index]);
    }
    // 若 runtime 尚未建好（restore 异步链未完成）：置 pending，待建好时由 applyReminders 统一补发首帧。
    if (!hasRuntime) pendingStateRequest = true;
  });

  // 启动时恢复待办截止提醒
  restoreTodoReminders();

  // 待办新增/编辑/删除/完成切换后，重新排程截止提醒
  ipcMain.on("update-todo-reminders", () => {
    applyTodoReminders();
  });

  ipcMain.on("start-work", (e, workTimeGap: number) => {
    hideApp();
    createJob({
      win,
      msgName: "close-work",
      time: workTimeGap,
      onTick: () => {
        // 打开第二窗口
        // createOtherWindow('small')
      },
    });
  });

  ipcMain.on("start-rest", (e, restTimeGap: number) => {
    focusAppToTop();
    createJob({
      win,
      msgName: "close-rest",
      time: restTimeGap,
      onTick: () => {
        hideApp();
        // closeOtherWindow('small')
      },
    });
  });

  // 开启屏保模式
  ipcMain.on("start-screen-saver", (e, restTimeGap?: number) => {
    focusAppToTop();
    createJob({
      win,
      msgName: "close-screen-saver",
      time: restTimeGap || 1000 * 60 * 60 * 24 * 30,
      onTick: () => {
        hideApp();
        // closeOtherWindow('small')
      },
    });
  });

  // 开启job
  ipcMain.on("start-job", (e, { type, gap, auto }: { type: 'string', gap: number | string, auto: boolean }) => {
    startJobFn({ type, gap, auto });
  });

  // 停止job
  ipcMain.on("stop-job", (e, {type}: { type?: string }) => {
    console.log(type, 'stop-job');
    sJob[type] = Date.now()
    stopJob(type);
  });
}

export async function startJobFn({ type, gap, auto }: { type: 'string', gap: number | string, auto: boolean }) {
  if (!auto) {
    sJob[type] = Date.now()
    let isNaN = Number.isNaN(Number(gap));
    // 插入数据
    await upsertData({
      db: myDb.db,
      tableName: tableName,
      data: {
        key: 'job-tip:' + type,
        value: JSON.stringify({
          type,
          time: Date.now(),
          gap: isNaN ? 1000 * 60 * 60 : Number(gap),
          endTipTime: Date.now() + (isNaN ? 1000 * 60 * 60 : Number(gap)),
        })
      },
      config: {
        primaryKey: "key",
      },
      callback: async (err, result) => {
        if (err) {
          console.log(err, "err");
        } else {
          win?.webContents.send("job-start-tip", {
            type,
            time: Date.now(),
            gap: isNaN ? 1000 * 60 * 60 : Number(gap),
          });
        }
      },
    });
  }
  let sJobType = sJob[type]
  let isNaN = Number.isNaN(Number(gap));
    createJob({
      win,
      type,
      msgName: "start-" + type,
      time: isNaN ? 1000 * 60 * 60 : Number(gap),
      isTick: false,
      onTick: async () => {
        if (sJobType != sJob[type]) {
          return;
        }
        
        // 插入数据
        await upsertData({
          db: myDb.db,
          tableName: tableName,
          data: {
            key: 'job-tip:' + type,
            value: JSON.stringify({
              type,
              time: Date.now(),
              gap: isNaN ? 1000 * 60 * 60 : Number(gap),
              endTipTime: Date.now() + (isNaN ? 1000 * 60 * 60 : Number(gap)),
            })
          },
          config: {
            primaryKey: "key",
          },
          callback: async (err, result) => {
            if (err) {
              console.log(err, "err");
            } else {
              // 发送提醒
              createOtherWindow("jobTipWindow", {
                resizable: true,
                frame: false,
                width: 200,
                height: 100,
                // center: true,
                transparent: true,
                mouseEvents: true,
                fullscreenable: false,
                x: 100,
                y: 100,
              })
              win?.webContents.send("job-end-tip", {
                type,
                time: Date.now(),
                gap: isNaN ? 1000 * 60 * 60 : Number(gap),
              });
            }
          },
        });
        // 新一轮计时
        startJobFn({ type, gap, auto: true });
      },
    });
}

export default {
  createJob,
  stopJob,
};
