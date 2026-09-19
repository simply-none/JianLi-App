/**
 * 小纸条模块（P1-6，2026-09-19）—— PC ⇄ 手机 文字/链接速传
 * ----------------------------------------------------------------------------
 * 复用 syncModule 的 47124 数据面（registerDataRoute 注入 /slip/*，不新开端口），
 * 与移动端 `lib/features/note_slip` 完全对称：
 *   GET  /slip/ping  → 能力探测 {ok, role:'pc', support:true}
 *   POST /slip/push  → 收端：{id, from:{name,platform}, kind, content, ts} → 写库 + 推事件
 *
 * 双端同构表 `note_slip`（TEXT 主键 key，本机收发记录）：
 *   key / direction('in'|'out') / kind('text'|'url') / title / content /
 *   peer_name / peer_ip / read(0|1) / created_at(ms)
 * ⚠️ **不进同步白名单**（与 file_transfer 同性质：收发记录是本机行为，
 *    同步会把两端记录互相灌进对方收件箱）。
 *
 * IPC：slip:scan / slip:send / slip:send-clipboard / slip:list / slip:read /
 *      slip:delete / slip:clear / slip:targets / slip:last-peer
 * 事件（webContents.send）：slip:received {key, content, kind, from}
 *
 * ⚠️ 改本文件必须重启 Electron。
 */

import os from "node:os";
import { clipboard, ipcMain } from "electron";
import { query, upsert, del, ensureTableExists } from "./newSql.ts";
import { registerDataRoute, scanPeers } from "./sync/syncModule.ts";
import { currentNickname } from "./transfer/transferModule.ts";
import { store } from "./store.ts";
import { win } from "./mainWindow.ts";

const DATA_PORT = 47124;

/** 单条内容上限（字符），与移动端 kSlipMaxChars 一致 */
const MAX_CHARS = 8000;

/** 列表返回条数上限（本机只留最近 N 条做清理，查询按此上限） */
const KEEP_ROWS = 300;

const TARGETS_KEY = "_slip_targets";
const LAST_PEER_KEY = "_slip_last_peer";

/** note_slip 业务列（key 由 ensureTableExists 建为主键） */
const NOTE_SLIP_COLUMNS = [
  "direction",
  "kind",
  "title",
  "content",
  "peer_name",
  "peer_ip",
  "read",
  "created_at",
];

/** 一条小纸条 */
interface SlipRow {
  key: string;
  direction: string;
  kind: string;
  title: string;
  content: string;
  peer_name: string;
  peer_ip: string;
  read: number;
  created_at: number;
}

/** 发送目标 */
interface SlipTarget {
  ip: string;
  name: string;
}

/** 广播给对端的本机名（带「的PC」后缀，与文件互传一致） */
function broadcastName(): string {
  try {
    return `${currentNickname()}的PC`;
  } catch {
    return `${os.hostname()}的PC`;
  }
}

/** 启发式 URL 判定（与移动端 looksLikeSlipUrl 同规则） */
function isUrl(content: string): boolean {
  const s = content.trim();
  if (!s || s.includes("\n") || s.includes(" ")) return false;
  return s.startsWith("http://") || s.startsWith("https://");
}

/** 首行摘要（截 40 字） */
function titleOf(content: string): string {
  const line = (content.split("\n")[0] ?? "").trim();
  if (!line) return "小纸条";
  return line.length <= 40 ? line : `${line.slice(0, 40)}…`;
}

// ---------- 目标读写（electron-store） ----------

function loadTargets(): SlipTarget[] {
  try {
    const v = store.get(TARGETS_KEY);
    if (!Array.isArray(v)) return [];
    return v.filter((t): t is SlipTarget => !!t && typeof t.ip === "string");
  } catch {
    return [];
  }
}

function saveTargets(list: SlipTarget[]): void {
  try {
    store.set(TARGETS_KEY, list.slice(0, 8));
  } catch (e) {
    console.warn("[noteSlip] save targets failed:", e);
  }
}

function rememberTarget(t: SlipTarget): void {
  const next = [t, ...loadTargets().filter((x) => x.ip !== t.ip)].slice(0, 8);
  saveTargets(next);
  try {
    store.set(LAST_PEER_KEY, t.ip);
  } catch {
    /* noop */
  }
}

function lastPeerIp(): string {
  try {
    return String(store.get(LAST_PEER_KEY) ?? "");
  } catch {
    return "";
  }
}

function resolveTarget(ip?: string): SlipTarget | null {
  const explicit = (ip ?? "").trim();
  if (explicit) {
    const hit = loadTargets().find((t) => t.ip === explicit);
    return hit ?? { ip: explicit, name: explicit };
  }
  const last = lastPeerIp();
  if (!last) return null;
  const hit = loadTargets().find((t) => t.ip === last);
  return hit ?? { ip: last, name: last };
}

// ---------- 读库 ----------

function readBody(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    let over = false;
    req.on("data", (c: Buffer) => {
      raw += c.toString("utf8");
      if (raw.length > 4 * MAX_CHARS) over = true;
    });
    req.on("end", () => {
      if (over) return resolve({});
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function json(res: import("node:http").ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function emit(channel: string, payload: unknown): void {
  try {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  } catch {
    /* noop */
  }
}

/** 写一条记录（in/out 通用） */
async function writeRow(row: SlipRow): Promise<void> {
  await upsert({
    tableName: "note_slip",
    data: row as unknown as Record<string, unknown>,
    config: { primaryKey: "key" },
  }).catch((e) => console.warn("[noteSlip] upsert failed:", e));
}

/** 只保留最近 KEEP_ROWS 条 */
async function trim(): Promise<void> {
  try {
    const rows = (await query({
      tableName: "note_slip",
      orderBy: "created_at",
      orderByDesc: true,
    })) as SlipRow[];
    if (!Array.isArray(rows) || rows.length <= KEEP_ROWS) return;
    for (const row of rows.slice(KEEP_ROWS)) {
      await del({ tableName: "note_slip", condition: { key: row.key } }).catch(
        () => undefined,
      );
    }
  } catch (e) {
    console.warn("[noteSlip] trim failed:", e);
  }
}

/** 推送一条到对端（返回是否成功 + 错误信息） */
async function pushTo(
  ip: string,
  content: string,
  peerName: string,
): Promise<{ ok: boolean; error?: string; unsupported?: boolean }> {
  const text = content.trim();
  if (!text) return { ok: false, error: "内容为空" };
  if (text.length > MAX_CHARS) return { ok: false, error: `内容过长（上限 ${MAX_CHARS} 字）` };
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  try {
    const res = await fetch(`http://${ip}:${DATA_PORT}/slip/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        from: { name: broadcastName(), platform: "win32-electron" },
        kind: isUrl(text) ? "url" : "text",
        content: text,
        ts: Date.now(),
      }),
    });
    if (res.status === 404) {
      return { ok: false, unsupported: true, error: "对端不支持小纸条（请更新到最新版）" };
    }
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || data.ok !== true) {
      return { ok: false, error: data.error ?? `发送失败（${res.status}）` };
    }
    await writeRow({
      key: id,
      direction: "out",
      kind: isUrl(text) ? "url" : "text",
      title: titleOf(text),
      content: text,
      peer_name: peerName || ip,
      peer_ip: ip,
      read: 1,
      created_at: Date.now(),
    });
    await trim();
    rememberTarget({ ip, name: peerName || ip });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `发送失败：${String((e as Error)?.message ?? e)}` };
  }
}

/**
 * 把当前系统剪贴板文本发到目标设备（ip 省略时用最近一次成功的目标）。
 * 供 IPC（slip:send-clipboard）、全局快捷键、托盘菜单三处共用。
 */
export async function sendClipboardSlip(
  ip?: string,
): Promise<{ ok: boolean; error?: string; unsupported?: boolean; ip?: string; name?: string }> {
  const text = clipboard.readText?.() ?? "";
  if (!text.trim()) return { ok: false, error: "剪贴板为空" };
  const target = resolveTarget(ip);
  if (!target) return { ok: false, error: "未选择设备（请先在小纸条页选择）" };
  const r = await pushTo(target.ip, text, target.name);
  if (!r.ok) return { ok: false, error: r.error, unsupported: r.unsupported };
  return { ok: true, ip: target.ip, name: target.name };
}

// ---------- 接收端点 ----------

async function handlePing(_req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  json(res, { ok: true, role: "pc", support: true });
}

async function handlePush(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  try {
    const body = await readBody(req);
    const key = String(body.id ?? "").trim();
    const content = String(body.content ?? "");
    if (!key || !content.trim()) {
      json(res, { ok: false, error: "参数缺失" }, 400);
      return;
    }
    if (content.length > MAX_CHARS) {
      json(res, { ok: false, error: "内容过长" }, 413);
      return;
    }
    const from = (body.from ?? {}) as { name?: string };
    const peerName = String(from.name ?? "").trim() || "未知设备";
    const peerIp = req.socket.remoteAddress ?? "";
    // 幂等：同 key 重复推送只更新不重复通知
    const exists = (await query({
      tableName: "note_slip",
      conditions: { key },
      limit: 1,
    })) as SlipRow[];
    const fresh = !Array.isArray(exists) || exists.length === 0;
    await writeRow({
      key,
      direction: "in",
      kind: String(body.kind ?? (isUrl(content) ? "url" : "text")),
      title: titleOf(content),
      content,
      peer_name: peerName,
      peer_ip: peerIp,
      read: fresh ? 0 : 1,
      created_at: Number(body.ts ?? Date.now()),
    });
    await trim();
    if (fresh) {
      emit("slip:received", { key, content, kind: isUrl(content) ? "url" : "text", from: peerName });
    }
    json(res, { ok: true });
  } catch (e) {
    json(res, { ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
}

export function initNoteSlip(): void {
  try {
    // 1) 安全建表（与移动端 note_slip 逐列对齐）
    ensureTableExists("note_slip", NOTE_SLIP_COLUMNS, "key", {
      primaryKeyType: "TEXT",
    }).catch((e) => console.warn("[noteSlip] ensure table failed:", e));
    trim().catch(() => undefined);

    // 2) 接收端点（复用 47124 数据面）
    registerDataRoute("GET", "/slip/ping", handlePing);
    registerDataRoute("POST", "/slip/push", handlePush);

    // 3) IPC
    ipcMain.handle("slip:scan", async () => {
      // 只列手机（platform = 'android' / 'ios'），PC 之间互发无意义
      const peers = await scanPeers();
      const mobiles = (peers ?? []).filter((p) => !String(p.platform).includes("electron"));
      for (const p of peers ?? []) {
        if (!String(p.platform).includes("electron")) {
          // 扫描到的手机顺手记入目标清单，便于下拉直接选
          const hit = loadTargets().find((t) => t.ip === p.ip);
          if (!hit) rememberTarget({ ip: p.ip, name: p.name });
        }
      }
      return { success: true, data: mobiles };
    });

    ipcMain.handle("slip:targets", () => ({ success: true, data: loadTargets() }));

    ipcMain.handle("slip:last-peer", () => ({ success: true, data: lastPeerIp() }));

    ipcMain.handle(
      "slip:send",
      async (_e, args: { ip?: string; text: string; peerName?: string }) => {
        const target = resolveTarget(args?.ip);
        if (!target) {
          return { success: false, error: "请先选择设备（扫描局域网或手动输入 IP）" };
        }
        const r = await pushTo(target.ip, args?.text ?? "", args?.peerName ?? target.name);
        return r.ok
          ? { success: true, data: { ip: target.ip, name: target.name } }
          : { success: false, error: r.error, unsupported: r.unsupported };
      },
    );

    /** 快捷键 / 托盘入口：把当前系统剪贴板文本发到最近目标 */
    ipcMain.handle("slip:send-clipboard", async (_e, args: { ip?: string } = {}) => {
      const r = await sendClipboardSlip(args?.ip);
      if (!r.ok) return { success: false, error: r.error, unsupported: r.unsupported };
      return { success: true, data: { ip: r.ip, name: r.name } };
    });

    ipcMain.handle("slip:list", async () => {
      const rows = (await query({
        tableName: "note_slip",
        orderBy: "created_at",
        orderByDesc: true,
        limit: KEEP_ROWS,
      })) as SlipRow[];
      return { success: true, data: Array.isArray(rows) ? rows : [] };
    });

    ipcMain.handle("slip:read", async (_e, args: { key: string }) => {
      const updated = await query({
        tableName: "note_slip",
        conditions: { key: args?.key },
        limit: 1,
      }).catch(() => [] as SlipRow[]);
      const row = Array.isArray(updated) ? updated[0] : undefined;
      if (row) {
        await upsert({
          tableName: "note_slip",
          data: { ...row, read: 1 } as unknown as Record<string, unknown>,
          config: { primaryKey: "key" },
        }).catch((e) => console.warn("[noteSlip] mark read failed:", e));
      }
      return { success: true };
    });

    ipcMain.handle("slip:delete", async (_e, args: { key: string }) => {
      await del({ tableName: "note_slip", condition: { key: args?.key } }).catch(
        (e) => console.warn("[noteSlip] delete failed:", e),
      );
      return { success: true };
    });

    ipcMain.handle("slip:clear", async () => {
      // del 的 condition 不可空（防误删全表）→ 先取全部 key 再逐条删
      const rows = (await query({ tableName: "note_slip" }).catch(() => [])) as SlipRow[];
      for (const row of Array.isArray(rows) ? rows : []) {
        await del({ tableName: "note_slip", condition: { key: row.key } }).catch(
          () => undefined,
        );
      }
      return { success: true };
    });

    console.log("[noteSlip] /slip/* routes registered (ping + push)");
  } catch (e) {
    console.error("[noteSlip] init failed:", e);
  }
}
