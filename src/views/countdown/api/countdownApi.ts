/**
 * 倒计时 IPC 薄封装。
 * 渲染端严禁 import electron/*，所有读写经 ipcRenderer.handlePromise。
 * 通道与 electron/main/module/countdown.ts 一一对应。
 */
import type { CountdownRow, CountdownInput, CountdownStatus } from "../types";

/** 统一封装 invoke（preload 暴露的 handlePromise，对应主进程 ipcMain.handle） */
function invoke<T = any>(channel: string, payload?: any): Promise<T> {
  return window.ipcRenderer.handlePromise(channel, payload);
}

/** 拉取全部倒计时（按创建时间倒序） */
export function listCountdowns(): Promise<CountdownRow[]> {
  return invoke<CountdownRow[]>("countdown:list");
}

/** 新增 / 编辑。end_time 由渲染端算好后传入主进程。 */
export async function saveCountdown(input: CountdownInput): Promise<any> {
  const now = Date.now();
  let end_time: number;
  let duration: number;
  if (input.end_time != null) {
    // 编辑模式：保持原有 timing，不重算
    end_time = input.end_time;
    duration = input.duration ?? 0;
  } else {
    const durationMs =
      input.mode === "datetime"
        ? Math.max(0, (input.targetTime || now) - now)
        : input.durationMs || 0;
    end_time = now + durationMs;
    duration = durationMs;
  }
  const key = input.key || `cd_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    key,
    name: input.name,
    mode: input.mode,
    end_time,
    duration,
    paused_remaining: 0,
    status: (input.status || "running") as CountdownStatus,
    notify: input.notify ? 1 : 0,
    sound: input.sound || "",
    color: input.color || "",
    created_at: input.created_at || now,
    finished_at: 0,
  };
  return invoke("countdown:save", row);
}

/** 删除 */
export function deleteCountdown(key: string): Promise<any> {
  return invoke("countdown:delete", key);
}

/** 从暂停恢复：duration 即原 paused_remaining */
export function startCountdown(key: string, duration: number): Promise<any> {
  return invoke("countdown:start", { key, duration });
}

/** 暂停：remaining 即当前剩余(ms) */
export function pauseCountdown(key: string, remaining: number): Promise<any> {
  return invoke("countdown:pause", { key, remaining });
}

/** 重置：从原始 duration 重新开始 */
export function resetCountdown(key: string, duration: number): Promise<any> {
  return invoke("countdown:reset", { key, duration });
}
