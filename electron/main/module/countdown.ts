/**
 * 倒计时模块（独立调度 + 自有表 countdown）
 *
 * 设计要点：
 * - 不塞进番茄钟 / 提醒引擎，避免语义耦合（倒计时是「到某刻提醒 + 可暂停」，
 *   番茄钟是「工作/休息状态机」）。
 * - 主进程持有 Map<key, Timeout> 排程；到点 webContents.send('countdown-finished')。
 * - 启动扫描 status='running' 行 re-arm（崩溃恢复）；暂停态不排程。
 * - 计时基准用结束时间戳 end_time，渲染端实时算 end_time - now，天然抗节流漂移。
 * - 读写走 newSql 三件套（query/upsert/del），严禁 new-sql:execute。
 * - 改本文件必须重启 Electron 才生效。
 */
import { ipcMain } from "electron";
import { win } from "./mainWindow.ts";
import { query, upsert, del, ensureTableExists } from "./newSql.ts";

const TABLE = "countdown";

/** 主进程内存中的定时器索引 */
const timers: Record<string, NodeJS.Timeout> = {};

/** 取主窗口（复用 newReminder 的稳健写法，避免 win 已销毁时报错） */
function getWin() {
  if (win && !win.isDestroyed()) return win;
  return undefined;
}

/** 清掉某个 key 的定时器 */
function clearTimer(key: string) {
  if (timers[key]) {
    clearTimeout(timers[key]);
    delete timers[key];
  }
}

/** 为某个 key 排程到点触发 */
function arm(key: string, endTime: number) {
  clearTimer(key);
  const diff = endTime - Date.now();
  if (diff <= 0) {
    // 已过期，直接触发
    finish(key);
    return;
  }
  timers[key] = setTimeout(() => finish(key), diff);
}

/** 到点：写库标记 finished + 通知渲染端 */
async function finish(key: string) {
  clearTimer(key);
  let name = key;
  try {
    const rows: any[] = await query({ tableName: TABLE, conditions: { key } });
    if (rows && rows.length) name = rows[0].name;
    await upsert({
      tableName: TABLE,
      data: { key, status: "finished", finished_at: Date.now() },
      config: { primaryKey: "key" },
    });
  } catch (e) {
    console.error("[countdown] finish upsert failed:", e);
  }
  getWin()?.webContents.send("countdown-finished", { key, name });
}

export async function initCountdown() {
  // 幂等建表 + 确保 key 列唯一索引（防 upsert 退化为重复 INSERT）
  await ensureTableExists(TABLE, undefined, "key", { primaryKeyType: "TEXT" }).catch((e) =>
    console.warn("[countdown] ensure table failed:", e),
  );

  // 崩溃恢复：重新排程所有 running 的倒计时
  try {
    const rows: any[] = await query({ tableName: TABLE, conditions: { status: "running" } });
    rows.forEach((r: any) => {
      const endTime = Number(r.end_time);
      if (endTime - Date.now() <= 0) {
        finish(r.key);
      } else {
        arm(r.key, endTime);
      }
    });
  } catch (e) {
    console.error("[countdown] re-arm failed:", e);
  }

  // —— IPC 通道（渲染→主）——
  ipcMain.handle("countdown:list", async () => {
    return query({ tableName: TABLE, orderBy: "created_at", orderByDesc: true });
  });

  // 新增 / 编辑 + 排程（end_time 由渲染端算好传入）
  ipcMain.handle("countdown:save", async (_e, row: any) => {
    const data = {
      key: row.key,
      name: row.name,
      mode: row.mode,
      end_time: Number(row.end_time),
      duration: Number(row.duration || 0),
      paused_remaining: Number(row.paused_remaining || 0),
      status: row.status || "running",
      notify: Number(row.notify) ? 1 : 0,
      sound: row.sound || "",
      color: row.color || "",
      created_at: Number(row.created_at) || Date.now(),
      finished_at: Number(row.finished_at) || 0,
    };
    const res = await upsert({ tableName: TABLE, data, config: { primaryKey: "key" } });
    if (data.status === "running") {
      arm(data.key, data.end_time);
    } else {
      clearTimer(data.key);
    }
    return res;
  });

  ipcMain.handle("countdown:delete", async (_e, key: string) => {
    clearTimer(key);
    return del({ tableName: TABLE, condition: { key } });
  });

  // 从暂停恢复：end_time = now + paused_remaining
  ipcMain.handle("countdown:start", async (_e, { key, duration }: any) => {
    const endTime = Date.now() + Number(duration);
    await upsert({
      tableName: TABLE,
      data: { key, end_time: endTime, paused_remaining: 0, status: "running" },
      config: { primaryKey: "key" },
    });
    arm(key, endTime);
    return { ok: true };
  });

  // 暂停：冻结剩余时长
  ipcMain.handle("countdown:pause", async (_e, { key, remaining }: any) => {
    clearTimer(key);
    await upsert({
      tableName: TABLE,
      data: { key, paused_remaining: Number(remaining), status: "paused" },
      config: { primaryKey: "key" },
    });
    return { ok: true };
  });

  // 重置：从原始时长重新开始
  ipcMain.handle("countdown:reset", async (_e, { key, duration }: any) => {
    const endTime = Date.now() + Number(duration);
    await upsert({
      tableName: TABLE,
      data: { key, end_time: endTime, paused_remaining: 0, status: "running" },
      config: { primaryKey: "key" },
    });
    arm(key, endTime);
    return { ok: true };
  });
}
