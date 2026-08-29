/**
 * 内置浏览器 - 站点权限管理（主进程）
 * ------------------------------------------------------------------
 * 职责：拦截 webview（persist:browser 会话）的权限请求（摄像头/麦克风/
 * 地理位置/通知等），弹出选择框由用户决定，并支持「记住选择」——
 * 决策持久化到 SQLite browser_permission 表，下次同源同权限直接放行/拒绝。
 *
 * IPC 通道：
 * - browser-permission:clear  清空全部权限记忆（含内存缓存）
 *
 * 表结构（幂等建表 + 唯一索引，对齐项目「补列 + 唯一索引」主键约定）：
 * - browser_permission：id 主键 / key(=origin|permission, 唯一) / allow(0|1) / create_time
 */
import { app, dialog, ipcMain, session } from "electron";
import { execute, query, upsert } from "./newSql.ts";

/** 权限决策表名 */
const TABLE_PERMISSION = "browser_permission";

/** 内存规则缓存：key(=origin|permission) -> allow */
const ruleCache = new Map<string, boolean>();

/** 权限请求中文名映射 */
const PERMISSION_LABELS: Record<string, string> = {
  media: "摄像头/麦克风",
  geolocation: "地理位置",
  notifications: "通知",
  midi: "MIDI 设备",
  "clipboard-read": "读取剪贴板",
  "clipboard-sanitized-write": "写入剪贴板",
  pointerLock: "鼠标指针锁定",
  fullscreen: "全屏",
};

/** 初始化完成标记（防止重复建表/挂钩） */
let inited = false;

/**
 * 解析请求来源的 origin（如 https://example.com）
 * @param requestingUrl 必填，请求来源地址
 * @returns origin；解析失败返回空串
 */
function originOf(requestingUrl: string): string {
  try {
    return new URL(requestingUrl).origin;
  } catch {
    return "";
  }
}

/**
 * 幂等建表 + 唯一索引，并把历史决策载入内存缓存
 */
async function loadRules() {
  // 建表（存在则跳过）
  await execute(
    `CREATE TABLE IF NOT EXISTS ${TABLE_PERMISSION} (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, allow INTEGER, create_time TEXT)`
  );
  // 唯一索引：等价主键（SQLite 不支持 ALTER 加主键）
  await execute(`CREATE UNIQUE INDEX IF NOT EXISTS uq_${TABLE_PERMISSION}_key ON ${TABLE_PERMISSION}(key)`);
  // 载入缓存
  try {
    const rows = await query({ tableName: TABLE_PERMISSION, SqlStr: `SELECT key, allow FROM ${TABLE_PERMISSION}` });
    rows.forEach((r) => ruleCache.set(String(r.key), Number(r.allow) === 1));
  } catch (e) {
    console.error("[browser-permission] 读取权限记忆失败:", e);
  }
}

/**
 * 记住一次决策（内存 + SQLite）
 * @param origin 必填，来源 origin
 * @param permission 必填，权限名
 * @param allow 必填，是否允许
 */
async function saveRule(origin: string, permission: string, allow: boolean) {
  const key = `${origin}|${permission}`;
  ruleCache.set(key, allow);
  try {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const time = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    await upsert({
      tableName: TABLE_PERMISSION,
      data: { key, allow: allow ? 1 : 0, create_time: time },
      config: { primaryKey: "key" },
    });
  } catch (e) {
    console.error("[browser-permission] 写入权限记忆失败:", e);
  }
}

/**
 * 弹出权限请求选择框（阻塞至用户选择）
 * @param origin 必填，请求来源
 * @param permission 必填，权限名
 * @returns { allow, remember } 用户决策
 */
async function askPermission(origin: string, permission: string): Promise<{ allow: boolean; remember: boolean }> {
  const label = PERMISSION_LABELS[permission] || permission;
  const { response } = await dialog.showMessageBox(win(), {
    type: "question",
    title: "站点权限请求",
    message: `${origin} 请求使用「${label}」`,
    detail: "选择「记住」后，同一站点同类请求将不再询问。",
    buttons: ["拒绝并记住", "仅本次拒绝", "仅本次允许", "允许并记住"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  // 按钮：0 拒绝并记住 / 1 拒绝 / 2 允许 / 3 允许并记住
  if (response === 0) return { allow: false, remember: true };
  if (response === 3) return { allow: true, remember: true };
  return { allow: response === 2, remember: false };
}

/** 主窗口引用（延迟取用，避免循环依赖） */
let winRef: (() => any) | null = null;
/**
 * 注册主窗口获取函数（在 createWindow 阶段调用）
 * @param getter 必填，返回主窗口的函数
 */
export function setPermissionWindowGetter(getter: () => any) {
  winRef = getter;
}

/** 获取当前主窗口（可能为空） */
function win(): any {
  return winRef?.() ?? null;
}

/**
 * 初始化站点权限管理（在 createWindow 中调用一次）
 */
export async function initBrowserPermission() {
  if (inited) return;
  inited = true;
  await loadRules();

  const s = session.fromPartition("persist:browser");
  s.setPermissionRequestHandler(async (_webContents, permission, callback, details) => {
    const url = details?.requestingUrl || details?.embeddingOrigin || "";
    const origin = originOf(url);
    // 非法来源一律拒绝
    if (!origin || !/^https?:/i.test(origin)) {
      callback(false);
      return;
    }
    const key = `${origin}|${permission}`;
    // 已有记忆：直接套用
    if (ruleCache.has(key)) {
      callback(ruleCache.get(key) === true);
      return;
    }
    // 无记忆：弹框询问
    try {
      const { allow, remember } = await askPermission(origin, permission);
      if (remember) {
        await saveRule(origin, permission, allow);
      }
      callback(allow);
    } catch (e) {
      console.error("[browser-permission] 处理权限请求失败:", e);
      callback(false);
    }
  });

  // 清空权限记忆（含内存缓存）
  ipcMain.handle("browser-permission:clear", async () => {
    try {
      await execute(`DELETE FROM ${TABLE_PERMISSION}`);
      ruleCache.clear();
      return { success: true };
    } catch (e) {
      console.error("[browser-permission] 清空权限记忆失败:", e);
      return { success: false, error: String(e) };
    }
  });
}

// 应用退出前清理（防御性）
app.on("will-quit", () => {
  ruleCache.clear();
});
